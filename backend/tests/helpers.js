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

// 테스트 팀: 이름이 vt 로 시작하고 테스트 회원(vt…@example.com)만 속한 팀
const TEST_TEAMS = `(SELECT t.id FROM teams t WHERE t.name LIKE 'vt%' AND NOT EXISTS (SELECT 1 FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = t.id AND u.email NOT LIKE 'vt%@example.com'))`;

export async function cleanupTestRows() {
  await runSql(`DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE team_id IN ${TEST_TEAMS}
                 OR user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com'))`);
  await runSql(`DELETE FROM teams WHERE id IN ${TEST_TEAMS}`);
  await runSql("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com') OR sender_user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM tasks WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM todos WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM team_invite_declines WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM task_assignees WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
  await runSql("UPDATE daily_reports SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'vt%@example.com')");
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

// 로그인한 테스트 회원: { ...user, cookie }
export async function loginTestUser(app, password = 'abcd123!') {
  const request = (await import('supertest')).default;
  const user = await createTestUser(password);
  const res = await request(app).post('/api/sessions').send({ loginId: user.loginId, password });
  return { ...user, cookie: sessionCookie(res) };
}
