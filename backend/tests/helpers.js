// 테스트 공통: 실제 메일 대신 보낸 인증번호를 모으고, 테스트가 만든 행을 지운다
import { getPool, sql } from '../src/config/db.js';
import { setSendMailOverride } from '../src/config/mail.js';

export const sentMails = [];

export function captureMails() {
  sentMails.length = 0;
  setSendMailOverride(async (mail) => {
    sentMails.push(mail);
  });
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

export async function cleanupTestRows() {
  await runSql("DELETE FROM email_verifications WHERE email LIKE 'vt%@example.com'");
  await runSql("DELETE FROM login_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM users WHERE email LIKE 'vt%@example.com'");
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
    phone: `098${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  };
  const result = await runSql(
    `INSERT INTO users (login_id, password_hash, nickname, email, phone)
     OUTPUT inserted.id VALUES (@loginId, @passwordHash, @nickname, @email, @phone)`,
    {
      loginId: [sql.NVarChar(15), user.loginId],
      passwordHash: [sql.NVarChar(60), await bcrypt.hash(password, 10)],
      nickname: [sql.NVarChar(8), user.nickname],
      email: [sql.NVarChar(100), user.email],
      phone: [sql.NVarChar(11), user.phone],
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

export { sql };
