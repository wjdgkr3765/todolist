// 로그인/로그아웃 API (api.md 6.3, D-049, D-050): 실제 개발 DB 에 요청한다
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import {
  captureMails, cleanupTestRows, createTestUser, runSql, sentMails, sessionCookie, sessionCookieLine, sql,
} from './helpers.js';

const app = createApp();
const login = (loginId, password) => request(app).post('/api/sessions').send({ loginId, password });
const me = (cookie) => request(app).get('/api/sessions/me').set('Cookie', cookie ?? '');
const userState = async (userId) => (await runSql(
  'SELECT login_fail_count, lock_expire_date FROM users WHERE id = @id', { id: [sql.BigInt, userId] },
)).recordset[0];

beforeAll(cleanupTestRows);
beforeEach(captureMails);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('POST /api/sessions', () => {
  test('성공 → 회원 정보, httpOnly·SameSite=Strict·Path=/·24시간 쿠키, 토큰은 해시로 저장', async () => {
    const user = await createTestUser();
    const res = await login(user.loginId, user.password);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: user.userId, loginId: user.loginId, nickname: '테스트', email: user.email });
    const line = sessionCookieLine(res);
    expect(line).toMatch(/^todo_session=[A-Za-z0-9_-]{43};/);
    expect(line).toContain('HttpOnly');
    expect(line).toContain('SameSite=Strict');
    expect(line).toContain('Path=/');
    expect(line).toContain('Max-Age=86400');
    expect(line).not.toContain('Secure');
    const token = sessionCookie(res).split('=')[1];
    const rows = await runSql(
      'SELECT token_hash, DATEDIFF(MINUTE, SYSUTCDATETIME(), expire_date) AS minutes FROM login_tokens WHERE user_id = @id',
      { id: [sql.BigInt, user.userId] },
    );
    expect(rows.recordset).toHaveLength(1);
    expect(rows.recordset[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.recordset[0].token_hash).not.toContain(token);
    expect(rows.recordset[0].minutes).toBeGreaterThanOrEqual(24 * 60 - 1);
  });
  test('아이디는 대소문자를 구분하지 않는다', async () => {
    const user = await createTestUser();
    expect((await login(user.loginId.toUpperCase(), user.password)).status).toBe(200);
  });
  test('없는 아이디와 틀린 비밀번호는 같은 응답', async () => {
    const user = await createTestUser();
    const noUser = await login('vtnobody999', user.password);
    const wrong = await login(user.loginId, 'wrong123!');
    expect(noUser.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(noUser.body).toEqual(wrong.body);
    expect(wrong.body.error).toEqual({ code: 'LOGIN_FAILED', message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  });
  test.each([
    [{ loginId: '', password: 'a' }], [{ loginId: 'a', password: '' }],
    [{ loginId: 'a'.repeat(16), password: 'a' }], [{ loginId: 'a', password: 'a'.repeat(16) }],
    [{ loginId: 1, password: 'a' }], [{ loginId: 'a' }], [[]],
  ])('입력 오류 %j → 400', async (body) => {
    const res = await request(app).post('/api/sessions').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
  test('경계: 1자·15자 입력은 검사를 통과해 LOGIN_FAILED', async () => {
    expect((await login('a', 'b')).body.error.code).toBe('LOGIN_FAILED');
    expect((await login('a'.repeat(15), 'b'.repeat(15))).body.error.code).toBe('LOGIN_FAILED');
  });
  test('4번 틀린 뒤 성공하면 틀린 횟수 0', async () => {
    const user = await createTestUser();
    for (let i = 0; i < 4; i += 1) {
      expect((await login(user.loginId, 'wrong123!')).body.error.code).toBe('LOGIN_FAILED');
    }
    expect((await userState(user.userId)).login_fail_count).toBe(4);
    expect((await login(user.loginId, user.password)).status).toBe(200);
    expect((await userState(user.userId)).login_fail_count).toBe(0);
  });
  test('5번째 틀림 → 423 LOGIN_LOCKED (10분), 잠긴 동안은 맞는 비밀번호도 LOCKED', async () => {
    const user = await createTestUser();
    for (let i = 0; i < 4; i += 1) {
      await login(user.loginId, 'wrong123!');
    }
    const fifth = await login(user.loginId, 'wrong123!');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error).toEqual({ code: 'LOGIN_LOCKED', message: '비밀번호를 5번 틀려 로그인이 잠겼습니다. 10분 뒤 다시 시도해 주세요.' });
    const state = await userState(user.userId);
    expect(state.login_fail_count).toBe(0);
    expect(state.lock_expire_date.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    const correct = await login(user.loginId, user.password);
    expect(correct.status).toBe(423);
    expect(sessionCookieLine(correct)).toBeNull();
  });
  test('경계: 잠금이 1초 남으면 LOCKED (1분), 잠금 시각이 지나면 로그인', async () => {
    const user = await createTestUser();
    const setLock = (seconds) => runSql(
      'UPDATE users SET lock_expire_date = DATEADD(SECOND, @seconds, SYSUTCDATETIME()) WHERE id = @id',
      { id: [sql.BigInt, user.userId], seconds: [sql.Int, seconds] },
    );
    await setLock(1);
    expect((await login(user.loginId, user.password)).body.error.message).toContain('1분 뒤');
    await setLock(-1);
    expect((await login(user.loginId, user.password)).status).toBe(200);
    expect((await userState(user.userId)).lock_expire_date).toBeNull();
  });
  test('잠그기 전에 멈춰 횟수가 5로 남은 경우 → 그때부터 10분 잠금 (영구 잠김 방지)', async () => {
    const user = await createTestUser();
    await runSql('UPDATE users SET login_fail_count = 5, lock_expire_date = NULL WHERE id = @id', { id: [sql.BigInt, user.userId] });
    const res = await login(user.loginId, user.password);
    expect(res.body.error.message).toContain('10분 뒤');
    const state = await userState(user.userId);
    expect(state.login_fail_count).toBe(0);
    expect(state.lock_expire_date).not.toBeNull();
  });
  test('동시에 틀린 비밀번호 8번 → 잠금은 한 번, 틀린 횟수는 5를 넘지 않음', async () => {
    const user = await createTestUser();
    const results = await Promise.all(Array.from({ length: 8 }, () => login(user.loginId, 'wrong123!')));
    const codes = results.map((res) => res.body.error.code);
    expect(codes.filter((code) => code === 'LOGIN_FAILED')).toHaveLength(4);
    expect(codes.filter((code) => code === 'LOGIN_LOCKED')).toHaveLength(4);
    expect((await userState(user.userId)).lock_expire_date).not.toBeNull();
  });
  test('새로 로그인하면 이전 로그인은 무효 (D-050)', async () => {
    const user = await createTestUser();
    const first = sessionCookie(await login(user.loginId, user.password));
    const second = sessionCookie(await login(user.loginId, user.password));
    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(200);
  });
  test('로그인할 때 만료된 토큰(다른 회원 것도)을 지운다 (D-122)', async () => {
    const other = await createTestUser();
    await login(other.loginId, other.password);
    await runSql('UPDATE login_tokens SET expire_date = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE user_id = @id', { id: [sql.BigInt, other.userId] });
    const user = await createTestUser();
    await login(user.loginId, user.password);
    const left = await runSql('SELECT COUNT(*) AS n FROM login_tokens WHERE user_id = @id', { id: [sql.BigInt, other.userId] });
    expect(left.recordset[0].n).toBe(0);
  });
});

describe('GET /api/sessions/me', () => {
  test('로그인 쿠키 → 회원 정보', async () => {
    const user = await createTestUser();
    const cookie = sessionCookie(await login(user.loginId, user.password));
    const res = await me(cookie);
    expect(res.body.data).toEqual({ userId: user.userId, loginId: user.loginId, nickname: '테스트', email: user.email });
  });
  test.each([
    [''], ['todo_session='], ['todo_session=abc'], [`todo_session=${'a'.repeat(43)}`], [`todo_session=${'a'.repeat(42)}!`],
  ])('쿠키 %s → 401 UNAUTHORIZED', async (cookie) => {
    const res = await me(cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
  test('경계: 만료 1초 전은 로그인, 만료 시각이 지나면 401', async () => {
    const user = await createTestUser();
    const cookie = sessionCookie(await login(user.loginId, user.password));
    const setExpire = (seconds) => runSql(
      'UPDATE login_tokens SET expire_date = DATEADD(SECOND, @seconds, SYSUTCDATETIME()) WHERE user_id = @id',
      { id: [sql.BigInt, user.userId], seconds: [sql.Int, seconds] },
    );
    await setExpire(2);
    expect((await me(cookie)).status).toBe(200);
    await setExpire(-1);
    expect((await me(cookie)).status).toBe(401);
  });
});

describe('POST /api/sessions/logout', () => {
  test('로그아웃 → 토큰 삭제, 쿠키 만료, 같은 쿠키로 401', async () => {
    const user = await createTestUser();
    const cookie = sessionCookie(await login(user.loginId, user.password));
    const res = await request(app).post('/api/sessions/logout').set('Cookie', cookie);
    expect(res.body.data).toEqual({ isLoggedOut: true });
    expect(sessionCookieLine(res)).toMatch(/^todo_session=;.*Expires=Thu, 01 Jan 1970/);
    expect((await me(cookie)).status).toBe(401);
  });
  test.each([[''], ['todo_session=abc']])('로그인하지 않았어도 성공 (쿠키 %s)', async (cookie) => {
    const res = await request(app).post('/api/sessions/logout').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.isLoggedOut).toBe(true);
  });
});

describe('POST /api/email-verifications (change_email, 로그인 필요)', () => {
  const send = (email, cookie = '') => request(app).post('/api/email-verifications').set('Cookie', cookie).send({ email, purpose: 'change_email' });
  test('로그인하지 않으면 401', async () => {
    const res = await send('vtnew@example.com');
    expect(res.status).toBe(401);
    expect(sentMails).toHaveLength(0);
  });
  test('내 이메일 → 409 EMAIL_DUPLICATED, 새 이메일 → 발송 (제목 이메일 변경)', async () => {
    const user = await createTestUser();
    const cookie = sessionCookie(await login(user.loginId, user.password));
    expect((await send(user.email, cookie)).body.error.code).toBe('EMAIL_DUPLICATED');
    const res = await send(`vt${user.userId}new@example.com`, cookie);
    expect(res.status).toBe(200);
    expect(sentMails[0].subject).toBe('[TODO] 이메일 변경 인증번호');
  });
});
