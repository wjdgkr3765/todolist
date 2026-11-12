// 로그인·로그아웃·로그인 확인 (api.md 6.3, D-007, D-028, D-049, D-050, D-122)
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError } from '../utils/appError.js';

export const SESSION_COOKIE_NAME = 'todo_session';
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FAIL_COUNT = 5;
const LOCK_MINUTES = 10;
// 없는 아이디도 같은 시간이 걸리도록 비교할 가짜 해시 (bcrypt 10 라운드)
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

// 쿠키 값: 32바이트 무작위 값의 base64url (43자)
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function loginFailed() {
  return new AppError(401, 'LOGIN_FAILED', '아이디 또는 비밀번호가 올바르지 않습니다.');
}

// remainingSeconds: DB 시계로 계산한 남은 잠금 시간 (서버와 DB 시계가 달라도 맞도록)
function loginLocked(remainingSeconds) {
  const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  return new AppError(423, 'LOGIN_LOCKED', `비밀번호를 5번 틀려 로그인이 잠겼습니다. ${minutes}분 뒤 다시 시도해 주세요.`);
}

function toSessionUser(row) {
  return { userId: Number(row.id), loginId: row.login_id, nickname: row.nickname, email: row.email };
}

// 잠금 시작: 지금 + 10분, 틀린 횟수 0 (D-049). 남은 초를 돌려준다
async function lockUser(pool, userId) {
  const result = await pool.request()
    .input('id', sql.BigInt, userId)
    .input('lockMinutes', sql.Int, LOCK_MINUTES)
    .query(`UPDATE users SET login_fail_count = 0, lock_expire_date = DATEADD(MINUTE, @lockMinutes, SYSUTCDATETIME())
            OUTPUT DATEDIFF(SECOND, SYSUTCDATETIME(), inserted.lock_expire_date) AS remaining_seconds
            WHERE id = @id`);
  return result.recordset[0].remaining_seconds;
}

// 비밀번호 확인 + 실패 제한 (D-049, D-130): 틀리면 횟수를 올리고 5번이면 10분 잠금(423). 잠겨 있으면 423.
// 맞으면 true, 틀리면 false (틀린 횟수 초기화는 부르는 쪽에서 한다)
export async function checkPasswordWithLimit(pool, user, password) {
  // 비교 전에 틀린 횟수를 먼저 1 올린다. 잠겨 있거나 이미 5면 올리지 못한다
  const counted = await pool.request()
    .input('id', sql.BigInt, user.id)
    .input('maxFailCount', sql.Int, MAX_FAIL_COUNT)
    .query(`UPDATE users SET login_fail_count = login_fail_count + 1
            OUTPUT inserted.login_fail_count
            WHERE id = @id AND login_fail_count < @maxFailCount
              AND (lock_expire_date IS NULL OR lock_expire_date <= SYSUTCDATETIME())`);
  if (counted.recordset.length === 0) {
    const state = await pool.request().input('id', sql.BigInt, user.id)
      .query(`SELECT CASE WHEN lock_expire_date > SYSUTCDATETIME()
                THEN DATEDIFF(SECOND, SYSUTCDATETIME(), lock_expire_date) ELSE NULL END AS remaining_seconds
              FROM users WHERE id = @id`);
    const remainingSeconds = state.recordset[0].remaining_seconds;
    // 잠그기 전에 멈춰 횟수가 5로 남은 경우: 그때부터 10분 잠금 (영구 잠김 방지)
    throw loginLocked(remainingSeconds ?? await lockUser(pool, user.id));
  }
  const failCount = counted.recordset[0].login_fail_count;
  if (!(await bcrypt.compare(password, user.password_hash))) {
    if (failCount >= MAX_FAIL_COUNT) {
      throw loginLocked(await lockUser(pool, user.id));
    }
    return false;
  }
  return true;
}

export async function login({ loginId, password }) {
  const pool = await getPool();
  const found = await pool.request().input('loginId', sql.NVarChar(15), loginId)
    .query('SELECT id, login_id, password_hash, nickname, email FROM users WHERE login_id = @loginId');
  const user = found.recordset[0];
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw loginFailed();
  }

  if (!(await checkPasswordWithLimit(pool, user, password))) {
    throw loginFailed();
  }

  const token = randomBytes(32).toString('base64url');
  await withTransaction(async (transaction) => {
    // 그 회원의 다른 로그인(D-050)과 만료된 토큰(모든 회원, D-122)을 지운다
    await new sql.Request(transaction).input('userId', sql.BigInt, user.id)
      .query('DELETE FROM login_tokens WHERE user_id = @userId OR expire_date <= SYSUTCDATETIME()');
    await new sql.Request(transaction)
      .input('tokenHash', sql.NVarChar(64), hashToken(token))
      .input('userId', sql.BigInt, user.id)
      .query(`INSERT INTO login_tokens (token_hash, user_id, expire_date)
              VALUES (@tokenHash, @userId, DATEADD(HOUR, 24, SYSUTCDATETIME()))`);
    await new sql.Request(transaction).input('id', sql.BigInt, user.id)
      .query('UPDATE users SET login_fail_count = 0, lock_expire_date = NULL WHERE id = @id');
  });
  return { token, user: toSessionUser(user) };
}

// 쿠키의 토큰으로 로그인한 회원을 찾는다. 없거나 만료면 null
export async function findSessionUser(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return null;
  }
  const pool = await getPool();
  const result = await pool.request().input('tokenHash', sql.NVarChar(64), hashToken(token))
    .query(`SELECT u.id, u.login_id, u.nickname, u.email
            FROM login_tokens t JOIN users u ON u.id = t.user_id
            WHERE t.token_hash = @tokenHash AND t.expire_date > SYSUTCDATETIME()`);
  return result.recordset[0] ? toSessionUser(result.recordset[0]) : null;
}

export async function logout(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    return;
  }
  const pool = await getPool();
  await pool.request().input('tokenHash', sql.NVarChar(64), hashToken(token))
    .query('DELETE FROM login_tokens WHERE token_hash = @tokenHash');
}
