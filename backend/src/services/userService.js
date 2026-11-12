// 회원가입·아이디 중복 확인 (api.md 6.2, D-006, D-042, D-044)
import bcrypt from 'bcrypt';
import { getPool, withTransaction, isUniqueViolation, sql } from '../config/db.js';
import { AppError } from '../utils/appError.js';

const PASSWORD_HASH_ROUNDS = 10;

export async function isLoginIdAvailable(loginId) {
  const pool = await getPool();
  const result = await pool.request().input('loginId', sql.NVarChar(15), loginId)
    .query('SELECT TOP 1 id FROM users WHERE login_id = @loginId');
  return result.recordset.length === 0;
}

// 아이디 → 이메일 → 전화번호 순서로 첫 번째 중복만 오류로 낸다
async function checkDuplicates(pool, { loginId, email, phone }) {
  const result = await pool.request()
    .input('loginId', sql.NVarChar(15), loginId)
    .input('email', sql.NVarChar(100), email)
    .input('phone', sql.NVarChar(11), phone)
    .query(`SELECT
              CASE WHEN EXISTS (SELECT 1 FROM users WHERE login_id = @loginId) THEN 1 ELSE 0 END AS is_login_id_used,
              CASE WHEN EXISTS (SELECT 1 FROM users WHERE email = @email) THEN 1 ELSE 0 END AS is_email_used,
              CASE WHEN EXISTS (SELECT 1 FROM users WHERE phone = @phone) THEN 1 ELSE 0 END AS is_phone_used`);
  const row = result.recordset[0];
  if (row.is_login_id_used) {
    throw new AppError(409, 'LOGIN_ID_DUPLICATED', '이미 사용 중인 아이디입니다.');
  }
  if (row.is_email_used) {
    throw new AppError(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
  }
  if (row.is_phone_used) {
    throw new AppError(409, 'PHONE_DUPLICATED', '이미 가입된 전화번호입니다.');
  }
}

// 인증 완료 후 30분 안의 회원가입 인증인지 확인한다 (D-044)
async function checkEmailVerified(pool, { email, verificationId }) {
  const result = await pool.request()
    .input('id', sql.BigInt, verificationId)
    .input('email', sql.NVarChar(100), email)
    .query(`SELECT TOP 1 id FROM email_verifications
            WHERE id = @id AND email = @email AND purpose = 'signup' AND is_verified = 1
              AND verify_date > DATEADD(MINUTE, -30, SYSUTCDATETIME())`);
  if (result.recordset.length === 0) {
    throw new AppError(400, 'EMAIL_NOT_VERIFIED', '이메일 인증을 완료해 주세요.');
  }
}

export async function createUser({ loginId, password, nickname, email, phone, verificationId }) {
  const pool = await getPool();
  await checkDuplicates(pool, { loginId, email, phone });
  await checkEmailVerified(pool, { email, verificationId });

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  try {
    return await withTransaction(async (transaction) => {
      const inserted = await new sql.Request(transaction)
        .input('loginId', sql.NVarChar(15), loginId)
        .input('passwordHash', sql.NVarChar(60), passwordHash)
        .input('nickname', sql.NVarChar(8), nickname)
        .input('email', sql.NVarChar(100), email)
        .input('phone', sql.NVarChar(11), phone)
        .query(`INSERT INTO users (login_id, password_hash, nickname, email, phone)
                OUTPUT inserted.id
                VALUES (@loginId, @passwordHash, @nickname, @email, @phone)`);
      // 가입에 성공하면 그 이메일의 인증 기록을 지운다
      await new sql.Request(transaction).input('email', sql.NVarChar(100), email)
        .query('DELETE FROM email_verifications WHERE email = @email');
      return { userId: Number(inserted.recordset[0].id) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // 저장 순간 다른 가입과 겹치면 다시 확인해 해당 중복 오류로 응답한다
      await checkDuplicates(pool, { loginId, email, phone });
    }
    throw error;
  }
}

// 인증 완료 후 30분 안의 그 용도 인증인지 (D-044, D-116)
async function checkPurposeVerified(pool, { email, verificationId, purpose }) {
  const result = await pool.request()
    .input('id', sql.BigInt, verificationId)
    .input('email', sql.NVarChar(100), email)
    .input('purpose', sql.NVarChar(20), purpose)
    .query(`SELECT TOP 1 id FROM email_verifications
            WHERE id = @id AND email = @email AND purpose = @purpose AND is_verified = 1
              AND verify_date > DATEADD(MINUTE, -30, SYSUTCDATETIME())`);
  if (result.recordset.length === 0) {
    throw new AppError(400, 'EMAIL_NOT_VERIFIED', '이메일 인증을 완료해 주세요.');
  }
}

// 아이디 찾기 결과 (api.md POST /api/users/find-id, D-114). 성공하면 그 이메일의 find_id 인증 기록을 지운다
export async function findLoginId({ email, verificationId }) {
  const pool = await getPool();
  await checkPurposeVerified(pool, { email, verificationId, purpose: 'find_id' });
  const result = await pool.request().input('email', sql.NVarChar(100), email)
    .query(`SELECT login_id, create_date FROM users WHERE email = @email;
            DELETE FROM email_verifications WHERE email = @email AND purpose = 'find_id';`);
  const user = result.recordset[0];
  if (!user) {
    throw new AppError(404, 'EMAIL_NOT_REGISTERED', '가입되지 않은 이메일입니다.');
  }
  return { loginId: user.login_id, createDate: user.create_date.toISOString() };
}

// 비밀번호 재설정 (api.md POST /api/users/reset-password, D-115, D-116). 커밋 뒤 실시간 연결 끊기는 라우트에서
export async function resetPassword({ loginId, email, verificationId, password }) {
  const pool = await getPool();
  const found = await pool.request().input('loginId', sql.NVarChar(15), loginId).input('email', sql.NVarChar(100), email)
    .query('SELECT id FROM users WHERE login_id = @loginId AND email = @email');
  if (!found.recordset[0]) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', '아이디와 이메일이 일치하는 회원이 없습니다.');
  }
  const userId = Number(found.recordset[0].id);
  await checkPurposeVerified(pool, { email, verificationId, purpose: 'find_password' });
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  await withTransaction(async (transaction) => {
    await new sql.Request(transaction)
      .input('id', sql.BigInt, userId).input('passwordHash', sql.NVarChar(60), passwordHash).input('email', sql.NVarChar(100), email)
      .query(`UPDATE users SET password_hash = @passwordHash, login_fail_count = 0, lock_expire_date = NULL WHERE id = @id;
              DELETE FROM login_tokens WHERE user_id = @id;
              DELETE FROM email_verifications WHERE email = @email AND purpose = 'find_password';`);
  });
  return userId;
}
