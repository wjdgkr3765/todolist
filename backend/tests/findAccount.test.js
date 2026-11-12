// 아이디 찾기·비밀번호 재설정 (api.md 6.2 find-id, reset-password, D-114~D-117)
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { captureMails, cleanupTestRows, createTestUser, lastSentCode, runSql, sentMails, sessionCookie, sql } from './helpers.js';

const app = createApp();
const post = (path, body) => request(app).post(path).send(body);

async function verified(email, purpose, extra = {}) {
  const sent = await post('/api/email-verifications', { email, purpose, ...extra });
  const verificationId = sent.body.data.verificationId;
  await post(`/api/email-verifications/${verificationId}/verify`, { code: lastSentCode() });
  return verificationId;
}

beforeAll(cleanupTestRows);
beforeEach(captureMails);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('아이디 찾기', () => {
  test('가입되지 않은 이메일 → 발송 단계에서 404 EMAIL_NOT_REGISTERED', async () => {
    const res = await post('/api/email-verifications', { email: 'vtnone@example.com', purpose: 'find_id' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EMAIL_NOT_REGISTERED');
  });
  test('인증 → 아이디 전체 + 가입일, 인증 기록은 한 번만 쓴다', async () => {
    const user = await createTestUser();
    const verificationId = await verified(user.email, 'find_id');
    expect(sentMails[0].subject).toBe('[TODO] 아이디 찾기 인증번호');
    const res = await post('/api/users/find-id', { email: user.email, verificationId });
    expect(res.body.data).toEqual({ loginId: user.loginId, createDate: expect.any(String) });
    expect((await post('/api/users/find-id', { email: user.email, verificationId })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  test('다른 용도의 인증, 30분 지난 인증 → EMAIL_NOT_VERIFIED, 입력 오류 400', async () => {
    const user = await createTestUser();
    const passwordVerification = await verified(user.email, 'find_password', { loginId: user.loginId });
    expect((await post('/api/users/find-id', { email: user.email, verificationId: passwordVerification })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const verificationId = await verified(user.email, 'find_id');
    await runSql("UPDATE email_verifications SET verify_date = DATEADD(MINUTE, -31, verify_date) WHERE email = @email AND purpose = 'find_id'",
      { email: [sql.NVarChar(100), user.email] });
    expect((await post('/api/users/find-id', { email: user.email, verificationId })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await post('/api/users/find-id', { email: 'bad', verificationId })).status).toBe(400);
  });
});

describe('비밀번호 재설정', () => {
  test('아이디·이메일이 다르면 발송 단계에서 404 ACCOUNT_NOT_FOUND (아이디 대소문자 구분 없음)', async () => {
    const user = await createTestUser();
    const wrong = await post('/api/email-verifications', { email: user.email, purpose: 'find_password', loginId: 'vtother1' });
    expect(wrong.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    const upper = await post('/api/email-verifications', { email: user.email, purpose: 'find_password', loginId: user.loginId.toUpperCase() });
    expect(upper.status).toBe(200);
    expect(sentMails[0].subject).toBe('[TODO] 비밀번호 찾기 인증번호');
  });
  test('재설정 → 새 비밀번호로 로그인, 이전 로그인 무효, 잠금·틀린 횟수 초기화', async () => {
    const user = await createTestUser();
    const before = sessionCookie(await post('/api/sessions', { loginId: user.loginId, password: user.password }));
    await runSql('UPDATE users SET login_fail_count = 3 WHERE id = @id', { id: [sql.BigInt, user.userId] });
    const verificationId = await verified(user.email, 'find_password', { loginId: user.loginId });
    const res = await post('/api/users/reset-password', { loginId: user.loginId, email: user.email, verificationId, password: 'newpw123!' });
    expect(res.body.data).toEqual({ isReset: true });
    expect((await request(app).get('/api/sessions/me').set('Cookie', before)).status).toBe(401);
    expect((await post('/api/sessions', { loginId: user.loginId, password: user.password })).status).toBe(401);
    expect((await post('/api/sessions', { loginId: user.loginId, password: 'newpw123!' })).status).toBe(200);
    const again = await post('/api/users/reset-password', { loginId: user.loginId, email: user.email, verificationId, password: 'newpw123!' });
    expect(again.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  test.each([
    [{ password: 'short1!' }], [{ password: 'nospecial1' }], [{ loginId: '' }], [{ loginId: 'a'.repeat(16) }], [{ verificationId: 0 }],
  ])('입력 오류 %j → 400', async (overrides) => {
    const user = await createTestUser();
    const body = { loginId: user.loginId, email: user.email, verificationId: 1, password: 'newpw123!', ...overrides };
    expect((await post('/api/users/reset-password', body)).status).toBe(400);
  });
  test('일치하는 회원 없음 → 404, 인증 없음 → EMAIL_NOT_VERIFIED', async () => {
    const user = await createTestUser();
    expect((await post('/api/users/reset-password', { loginId: 'vtnobody1', email: user.email, verificationId: 1, password: 'newpw123!' })).body.error.code).toBe('ACCOUNT_NOT_FOUND');
    expect((await post('/api/users/reset-password', { loginId: user.loginId, email: user.email, verificationId: 1, password: 'newpw123!' })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});
