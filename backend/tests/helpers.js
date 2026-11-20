// 테스트 공통: 실제 메일 대신 보낸 인증번호를 모으고, 테스트가 만든 행을 지운다
import { getPool, sql } from '../src/config/db.js';
import { setSendMailOverride } from '../src/config/mail.js';
import { setSendSmsOverride } from '../src/config/sms.js';
import { decryptText, encryptText, hashEmail, hashPhone } from '../src/utils/personalData.js';

export const sentMails = [];
export const sentSms = [];

export function captureMails() {
  sentMails.length = 0;
  setSendMailOverride(async (mail) => {
    sentMails.push(mail);
  });
}

// 실제 문자 대신 보낸 인증번호를 모은다 (D-168)
export function captureSms() {
  sentSms.length = 0;
  setSendSmsOverride(async (sms) => {
    sentSms.push(sms);
  });
}

export function lastSentSmsCode() {
  return sentSms.at(-1).text.match(/\[(\d{6})\]/)[1];
}

// 테스트 전화번호의 인증 기록을 지운다. 테스트끼리 같은 IP 라 IP 하루 제한(D-169)에 걸리지 않게 테스트마다 부른다
export async function clearTestPhoneVerifications() {
  await deleteDecryptedMatches('phone_verifications', 'phone', TEST_PHONE_PATTERN);
}

const TEST_EMAIL_PATTERN = /^vt.+@example\.com$/i;
const TEST_PHONE_PATTERN = /^01098\d{6}$/;

// 이메일·전화번호는 암호화되어 있어 LIKE 로 못 찾는다 (D-172). 풀어서 테스트 값인 행의 id 만 고른다
async function decryptedMatchIds(table, column, pattern, where = '') {
  const rows = (await runSql(`SELECT id, ${column} AS value FROM ${table} ${where}`)).recordset;
  return rows.filter((row) => pattern.test(decryptText(row.value))).map((row) => Number(row.id));
}

async function deleteDecryptedMatches(table, column, pattern) {
  const ids = await decryptedMatchIds(table, column, pattern);
  if (ids.length > 0) {
    await runSql(`DELETE FROM ${table} WHERE id IN (SELECT CAST(value AS BIGINT) FROM OPENJSON(@ids))`, { ids: [sql.NVarChar(sql.MAX), JSON.stringify(ids)] });
  }
}

// 테스트 전화번호: 01098 로 시작 (정리할 때 찾는다)
export function testPhone() {
  return `01098${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
}

export function lastSentCode() {
  const mail = sentMails.at(-1);
  return mail.text.match(/\n(\d{6})\n/)[1];
}

// 테스트마다 겹치지 않는 값 (이메일은 vt 로 시작해 정리할 때 찾는다)
export function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(-9);
}

export async function runSql(query, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  Object.entries(params).forEach(([name, [type, value]]) => request.input(name, type, value));
  return request.query(query);
}

// 테스트 회원: 아이디가 vt 로 시작하고 이메일이 vt…@example.com 인 회원 (@ids 로 넘긴다)
const TEST_USERS = '(SELECT CAST(value AS BIGINT) FROM OPENJSON(@ids))';
// 테스트 팀: 이름이 vt 로 시작하고 테스트 회원만 속한 팀
const TEST_TEAMS = `(SELECT t.id FROM teams t WHERE t.name LIKE 'vt%' AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = t.id AND m.user_id NOT IN ${TEST_USERS}))`;

export async function cleanupTestRows() {
  const userIds = await decryptedMatchIds('users', 'email', TEST_EMAIL_PATTERN, "WHERE login_id LIKE 'vt%'");
  const ids = { ids: [sql.NVarChar(sql.MAX), JSON.stringify(userIds)] };
  await runSql(`DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE team_id IN ${TEST_TEAMS}
                 OR user_id IN ${TEST_USERS})`, ids);
  await runSql(`DELETE FROM teams WHERE id IN ${TEST_TEAMS}`, ids);
  await runSql(`DELETE FROM notifications WHERE user_id IN ${TEST_USERS} OR sender_user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM alarms WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM tasks WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM todos WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM team_invite_declines WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM task_assignees WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM team_members WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`UPDATE daily_reports SET user_id = NULL WHERE user_id IN ${TEST_USERS}`, ids);
  await deleteDecryptedMatches('email_verifications', 'email', TEST_EMAIL_PATTERN);
  await deleteDecryptedMatches('phone_verifications', 'phone', TEST_PHONE_PATTERN);
  await runSql(`DELETE FROM login_tokens WHERE user_id IN ${TEST_USERS}`, ids);
  await runSql(`DELETE FROM users WHERE id IN ${TEST_USERS}`, ids);
}

// 회원가입 절차 없이 테스트 회원을 바로 만든다 (비밀번호는 bcrypt 해시)
export async function createTestUser(password = 'abcd123!') {
  const bcrypt = (await import('bcrypt')).default;
  const suffix = uniqueSuffix();
  const user = {
    loginId: `vt${suffix}1`.slice(0, 15),
    password,
    nickname: '테스트',
    email: `vt${suffix}@example.com`,
    phone: testPhone(),
  };
  const result = await runSql(
    `INSERT INTO users (login_id, password_hash, nickname, email, email_hash, phone, phone_hash)
     OUTPUT inserted.id VALUES (@loginId, @passwordHash, @nickname, @email, @emailHash, @phone, @phoneHash)`,
    {
      loginId: [sql.NVarChar(15), user.loginId],
      passwordHash: [sql.NVarChar(60), await bcrypt.hash(password, 10)],
      nickname: [sql.NVarChar(8), user.nickname],
      email: [sql.NVarChar(200), encryptText(user.email)],
      emailHash: [sql.NVarChar(64), hashEmail(user.email)],
      phone: [sql.NVarChar(80), encryptText(user.phone)],
      phoneHash: [sql.NVarChar(64), hashPhone(user.phone)],
    },
  );
  return { ...user, userId: Number(result.recordset[0].id) };
}

// 응답의 Set-Cookie 에서 로그인 쿠키 줄을 꺼낸다
export function sessionCookieLine(res) {
  return (res.headers['set-cookie'] ?? []).find((line) => line.startsWith('todo_session=')) ?? null;
}

export function sessionCookie(res) {
  return sessionCookieLine(res)?.split(';')[0] ?? null;
}

export { sql, hashEmail, hashPhone, encryptText, decryptText };

// 로그인한 테스트 회원: { ...user, cookie }
export async function loginTestUser(app, password = 'abcd123!') {
  const request = (await import('supertest')).default;
  const user = await createTestUser(password);
  const res = await request(app).post('/api/sessions').send({ loginId: user.loginId, password });
  return { ...user, cookie: sessionCookie(res) };
}
