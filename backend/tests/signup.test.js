// 회원가입 API (api.md 6.1, 6.2): 실제 개발 DB 에 요청하고, 메일은 보내지 않고 가로챈다
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import {
  captureMails, cleanupTestRows, lastSentCode, runSql, sentMails, sql, uniqueSuffix,
} from './helpers.js';

const app = createApp();

function newMember() {
  const suffix = uniqueSuffix();
  return {
    loginId: `vt${suffix}1`.slice(0, 15),
    password: 'abcd123!',
    nickname: '테스트',
    email: `vt${suffix}@example.com`,
    phone: `099${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
  };
}

async function sendCode(email, purpose = 'signup') {
  return request(app).post('/api/email-verifications').send({ email, purpose });
}

// 인증까지 마친 회원가입 요청 본문
async function verifiedMember() {
  const member = newMember();
  const sent = await sendCode(member.email);
  const verificationId = sent.body.data.verificationId;
  await request(app).post(`/api/email-verifications/${verificationId}/verify`).send({ code: lastSentCode() });
  return { ...member, verificationId };
}

beforeAll(cleanupTestRows);
beforeEach(captureMails);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('공통 (api.md 1)', () => {
  test('GET /api/health → db ok, 보안 헤더, X-Powered-By 없음', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { db: 'ok' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  test('없는 경로 → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  test('JSON 형식 오류 → 400 INVALID_INPUT (스택 없음)', async () => {
    const res = await request(app).post('/api/users').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_INPUT', message: '입력값이 올바르지 않습니다.' } });
  });
  test('본문 100kb 경계: 정확히 100kb 는 통과해 다음 처리(없는 경로 404)로, 1바이트 넘으면 400', async () => {
    const base = JSON.stringify({ text: '' });
    const exact = { text: 'a'.repeat(100 * 1024 - base.length) };
    const over = { text: 'a'.repeat(100 * 1024 - base.length + 1) };
    const resExact = await request(app).post('/api/nothing').send(exact);
    const resOver = await request(app).post('/api/nothing').send(over);
    expect(resExact.status).toBe(404);
    expect(resOver.status).toBe(400);
    expect(resOver.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('GET /api/users/login-id-availability', () => {
  test.each(['abc12', 'abcdefghijk12345', 'abcdef', ''])('형식 오류 %s → 400', async (loginId) => {
    const res = await request(app).get('/api/users/login-id-availability').query({ loginId });
    expect(res.status).toBe(400);
  });
  test('loginId 를 두 번 보내면 (배열) → 400', async () => {
    const res = await request(app).get('/api/users/login-id-availability?loginId=abc123&loginId=abc124');
    expect(res.status).toBe(400);
  });
  test('가입 전 사용 가능, 가입 후 대소문자만 달라도 사용 중', async () => {
    const member = await verifiedMember();
    const before = await request(app).get('/api/users/login-id-availability').query({ loginId: member.loginId });
    expect(before.body.data.isAvailable).toBe(true);
    await request(app).post('/api/users').send(member);
    const after = await request(app).get('/api/users/login-id-availability').query({ loginId: member.loginId.toUpperCase() });
    expect(after.body.data.isAvailable).toBe(false);
  });
});

describe('POST /api/email-verifications', () => {
  test('발송 성공: 응답 시각, 메일 제목·본문', async () => {
    const { email } = newMember();
    const res = await sendCode(email);
    expect(res.status).toBe(200);
    const { verificationId, expireDate, resendAvailableDate } = res.body.data;
    expect(verificationId).toBeGreaterThan(0);
    const diffMs = new Date(expireDate) - new Date(resendAvailableDate);
    expect(diffMs).toBeGreaterThan(4 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(4 * 60 * 1000 + 1000);
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe(email);
    expect(sentMails[0].subject).toBe('[TODO] 회원가입 인증번호');
    expect(lastSentCode()).toMatch(/^\d{6}$/);
  });
  test.each([
    [{ email: 'vtbad@example', purpose: 'signup' }],
    [{ email: `vt${'a'.repeat(87)}@example.com`, purpose: 'signup' }],
    [{ email: 'vtok@example.com', purpose: 'other' }],
    [{ email: 'vtok@example.com', purpose: 'signup', loginId: 'abc123' }],
    [{ email: 'vtok@example.com', purpose: 'find_password' }],
    [{ email: 'vtok@example.com', purpose: 'find_password', loginId: 'a'.repeat(16) }],
    [[]],
  ])('입력 오류 %j → 400', async (body) => {
    const res = await request(app).post('/api/email-verifications').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
  test('1분 안에 재발송 → 429, 1분 지나면 발송되고 이전 번호는 무효', async () => {
    const { email } = newMember();
    const first = await sendCode(email);
    const again = await sendCode(email);
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('VERIFICATION_RESEND_TOO_SOON');
    // 발송 시각을 61초 전으로 돌려 1분이 지난 상황을 만든다
    await runSql('UPDATE email_verifications SET create_date = DATEADD(SECOND, -61, create_date) WHERE email = @email',
      { email: [sql.NVarChar(100), email] });
    const resent = await sendCode(email);
    expect(resent.status).toBe(200);
    const old = await request(app).post(`/api/email-verifications/${first.body.data.verificationId}/verify`).send({ code: '000000' });
    expect(old.status).toBe(404);
  });
  test('경계: 발송 59초 뒤는 429', async () => {
    const { email } = newMember();
    await sendCode(email);
    await runSql('UPDATE email_verifications SET create_date = DATEADD(SECOND, -59, create_date) WHERE email = @email',
      { email: [sql.NVarChar(100), email] });
    expect((await sendCode(email)).status).toBe(429);
  });
  test('메일 발송 실패 → 500 MAIL_SEND_FAILED, 기록을 지워 바로 다시 보낼 수 있음', async () => {
    const { email } = newMember();
    const { setSendMailOverride } = await import('../src/config/mail.js');
    setSendMailOverride(async () => { throw new Error('smtp down'); });
    const failed = await sendCode(email);
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe('MAIL_SEND_FAILED');
    captureMails();
    expect((await sendCode(email)).status).toBe(200);
  });
  test('가입된 이메일 (대소문자 달라도) → 409 EMAIL_DUPLICATED', async () => {
    const member = await verifiedMember();
    await request(app).post('/api/users').send(member);
    const res = await sendCode(member.email.toUpperCase().replace('@EXAMPLE.COM', '@example.com'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_DUPLICATED');
  });
});

describe('POST /api/email-verifications/{id}/verify', () => {
  async function sent() {
    const { email } = newMember();
    const res = await sendCode(email);
    return { id: res.body.data.verificationId, code: lastSentCode(), email };
  }
  const verify = (id, code) => request(app).post(`/api/email-verifications/${id}/verify`).send({ code });
  const wrongCode = (code) => (code === '000000' ? '111111' : '000000');

  test('맞는 번호 → isVerified true', async () => {
    const { id, code } = await sent();
    const res = await verify(id, code);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ isVerified: true });
  });
  test('4번 틀리면 남은 횟수 4→1, 그 뒤 맞으면 인증 (경계: 4번째 틀림까지는 유효)', async () => {
    const { id, code } = await sent();
    for (let left = 4; left >= 1; left -= 1) {
      const res = await verify(id, wrongCode(code));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VERIFICATION_CODE_MISMATCH');
      expect(res.body.error.message).toContain(`남은 횟수 ${left}회`);
    }
    expect((await verify(id, code)).body.data.isVerified).toBe(true);
  });
  test('5번째 틀림 → LOCKED, 그 뒤 맞는 번호도 LOCKED', async () => {
    const { id, code } = await sent();
    for (let i = 0; i < 4; i += 1) {
      await verify(id, wrongCode(code));
    }
    expect((await verify(id, wrongCode(code))).body.error.code).toBe('VERIFICATION_LOCKED');
    expect((await verify(id, code)).body.error.code).toBe('VERIFICATION_LOCKED');
  });
  test('만료 → VERIFICATION_EXPIRED (틀린 횟수 올리지 않음)', async () => {
    const { id, code, email } = await sent();
    await runSql('UPDATE email_verifications SET expire_date = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE email = @email',
      { email: [sql.NVarChar(100), email] });
    expect((await verify(id, code)).body.error.code).toBe('VERIFICATION_EXPIRED');
    const row = await runSql('SELECT fail_count FROM email_verifications WHERE id = @id', { id: [sql.BigInt, id] });
    expect(row.recordset[0].fail_count).toBe(0);
  });
  test.each([['12345'], ['1234567'], ['abcdef'], [123456]])('번호 형식 오류 %s → 400', async (code) => {
    const { id } = await sent();
    expect((await verify(id, code)).status).toBe(400);
  });
  test.each(['0', 'abc', '1.5'])('경로 id 오류 %s → 400', async (id) => {
    expect((await verify(id, '123456')).status).toBe(400);
  });
  test('없는 id → 404', async () => {
    expect((await verify(9007199254740991, '123456')).status).toBe(404);
  });
});

describe('POST /api/users', () => {
  test('가입 성공 → userId, 비밀번호는 bcrypt 해시, 인증 기록 삭제', async () => {
    const member = await verifiedMember();
    const res = await request(app).post('/api/users').send(member);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeGreaterThan(0);
    const user = await runSql('SELECT password_hash FROM users WHERE id = @id', { id: [sql.BigInt, res.body.data.userId] });
    expect(user.recordset[0].password_hash).toMatch(/^\$2b\$10\$/);
    const left = await runSql('SELECT COUNT(*) AS n FROM email_verifications WHERE email = @email', { email: [sql.NVarChar(100), member.email] });
    expect(left.recordset[0].n).toBe(0);
  });
  test.each([
    ['loginId', 'abc12'], ['password', 'abcd1234'], ['nickname', '홍길동abc123'],
    ['email', 'vtbad@example'], ['phone', '0101234567'], ['verificationId', 0], ['verificationId', '1'],
  ])('%s 형식 오류 → 400', async (field, value) => {
    const member = { ...newMember(), verificationId: 1, [field]: value };
    expect((await request(app).post('/api/users').send(member)).status).toBe(400);
  });
  test('인증하지 않음 → 400 EMAIL_NOT_VERIFIED', async () => {
    const member = newMember();
    const sent = await sendCode(member.email);
    const res = await request(app).post('/api/users').send({ ...member, verificationId: sent.body.data.verificationId });
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  test('다른 이메일의 인증 id → 400 EMAIL_NOT_VERIFIED', async () => {
    const member = await verifiedMember();
    const res = await request(app).post('/api/users').send({ ...member, email: newMember().email });
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  test('경계: 인증 29분 59초 뒤 가입 성공, 30분 지나면 EMAIL_NOT_VERIFIED', async () => {
    const ok = await verifiedMember();
    await runSql('UPDATE email_verifications SET verify_date = DATEADD(SECOND, -1799, verify_date) WHERE email = @email',
      { email: [sql.NVarChar(100), ok.email] });
    expect((await request(app).post('/api/users').send(ok)).status).toBe(200);
    const late = await verifiedMember();
    await runSql('UPDATE email_verifications SET verify_date = DATEADD(SECOND, -1801, verify_date) WHERE email = @email',
      { email: [sql.NVarChar(100), late.email] });
    expect((await request(app).post('/api/users').send(late)).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  test('중복은 아이디 → 이메일 → 전화번호 순서로 첫 번째만', async () => {
    const first = await verifiedMember();
    await request(app).post('/api/users').send(first);
    const second = await verifiedMember();
    const all = await request(app).post('/api/users').send({ ...second, loginId: first.loginId, phone: first.phone });
    expect(all.body.error.code).toBe('LOGIN_ID_DUPLICATED');
    const phoneOnly = await request(app).post('/api/users').send({ ...second, phone: first.phone });
    expect(phoneOnly.status).toBe(409);
    expect(phoneOnly.body.error.code).toBe('PHONE_DUPLICATED');
    const emailDup = await request(app).post('/api/users').send({ ...second, email: first.email });
    expect(emailDup.body.error.code).toBe('EMAIL_DUPLICATED');
  });
  test('동시에 같은 아이디로 가입 → 하나만 성공, 나머지는 LOGIN_ID_DUPLICATED', async () => {
    const a = await verifiedMember();
    const b = await verifiedMember();
    const [resA, resB] = await Promise.all([
      request(app).post('/api/users').send(a),
      request(app).post('/api/users').send({ ...b, loginId: a.loginId }),
    ]);
    const codes = [resA, resB].map((res) => (res.status === 200 ? 'OK' : res.body.error.code)).sort();
    expect(codes).toEqual(['LOGIN_ID_DUPLICATED', 'OK']);
  });
});
