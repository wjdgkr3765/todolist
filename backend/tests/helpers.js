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
  await runSql("DELETE FROM users WHERE email LIKE 'vt%@example.com'");
}

export { sql };
