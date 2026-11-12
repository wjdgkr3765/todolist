// 회원정보 수정/탈퇴 API (api.md 6.11, D-129~D-131, D-041)
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { captureMails, cleanupTestRows, lastSentCode, loginTestUser, runSql, sessionCookieLine, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user?.cookie ?? '').send(body);
const TODO = { title: '작업', content: '내용', isPeriodUndecided: true, startDate: null, endDate: null, startTime: null, endTime: null };

beforeAll(cleanupTestRows);
beforeEach(captureMails);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('내 정보·닉네임·전화번호', () => {
  test('로그인 필요', async () => {
    for (const path of ['/api/users/me', '/api/users/me/withdrawal-check']) {
      expect((await get(path)).status).toBe(401);
    }
    expect((await post('/api/users/me/nickname', null, { nickname: 'a' })).status).toBe(401);
  });
  test('내 정보, 닉네임 변경 (경계 1·8자, 9자·특수문자 400)', async () => {
    const user = await loginTestUser(app);
    expect((await get('/api/users/me', user)).body.data).toEqual({ loginId: user.loginId, nickname: '테스트', email: user.email, phone: user.phone, createDate: expect.any(String) });
    expect((await post('/api/users/me/nickname', user, { nickname: '가' })).body.data.nickname).toBe('가');
    expect((await post('/api/users/me/nickname', user, { nickname: '가나다라abcd' })).body.data.nickname).toBe('가나다라abcd');
    expect((await post('/api/users/me/nickname', user, { nickname: '가나다라abcde' })).status).toBe(400);
    expect((await post('/api/users/me/nickname', user, { nickname: '홍_1' })).status).toBe(400);
    expect((await get('/api/sessions/me', user)).body.data.nickname).toBe('가나다라abcd');
  });
  test('전화번호: 다른 회원 번호 409, 지금 번호와 같으면 그대로 성공, 형식 400', async () => {
    const user = await loginTestUser(app);
    const other = await loginTestUser(app);
    expect((await post('/api/users/me/phone', user, { phone: other.phone })).body.error.code).toBe('PHONE_DUPLICATED');
    expect((await post('/api/users/me/phone', user, { phone: user.phone })).status).toBe(200);
    expect((await post('/api/users/me/phone', user, { phone: '0101234567' })).status).toBe(400);
    expect((await post('/api/users/me/phone', user, { phone: '09700000001' })).body.data.phone).toBe('09700000001');
  });
});

describe('이메일 변경', () => {
  test('change_email 인증 → 변경, 인증 기록 한 번만, 다른 용도 인증은 EMAIL_NOT_VERIFIED', async () => {
    const user = await loginTestUser(app);
    const newEmail = `vt${user.userId}chg@example.com`;
    const sent = await post('/api/email-verifications', user, { email: newEmail, purpose: 'change_email' });
    const verificationId = sent.body.data.verificationId;
    await post(`/api/email-verifications/${verificationId}/verify`, user, { code: lastSentCode() });
    expect((await post('/api/users/me/email', user, { email: newEmail, verificationId })).body.data.email).toBe(newEmail);
    expect((await post('/api/users/me/email', user, { email: newEmail, verificationId })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await get('/api/sessions/me', user)).body.data.email).toBe(newEmail);
  });
  test('경계: 인증 30분 지나면 EMAIL_NOT_VERIFIED', async () => {
    const user = await loginTestUser(app);
    const newEmail = `vt${user.userId}late@example.com`;
    const verificationId = (await post('/api/email-verifications', user, { email: newEmail, purpose: 'change_email' })).body.data.verificationId;
    await post(`/api/email-verifications/${verificationId}/verify`, user, { code: lastSentCode() });
    await runSql('UPDATE email_verifications SET verify_date = DATEADD(SECOND, -1801, verify_date) WHERE id = @id', { id: [sql.BigInt, verificationId] });
    expect((await post('/api/users/me/email', user, { email: newEmail, verificationId })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('비밀번호 변경 (D-130)', () => {
  test('현재 비밀번호 틀림 400, 5번째 423, 맞으면 변경되고 지금 로그인은 유지', async () => {
    const user = await loginTestUser(app);
    for (let i = 0; i < 4; i += 1) {
      expect((await post('/api/users/me/password', user, { currentPassword: 'wrong123!', newPassword: 'newpw123!' })).body.error.code).toBe('CURRENT_PASSWORD_MISMATCH');
    }
    expect((await post('/api/users/me/password', user, { currentPassword: user.password, newPassword: 'newpw123!' })).body.data).toEqual({ isChanged: true });
    expect((await get('/api/sessions/me', user)).status).toBe(200);
    const state = await runSql('SELECT login_fail_count FROM users WHERE id = @id', { id: [sql.BigInt, user.userId] });
    expect(state.recordset[0].login_fail_count).toBe(0);
    for (let i = 0; i < 4; i += 1) {
      await post('/api/users/me/password', user, { currentPassword: 'wrong123!', newPassword: 'newpw123!' });
    }
    expect((await post('/api/users/me/password', user, { currentPassword: 'wrong123!', newPassword: 'newpw123!' })).status).toBe(423);
  });
  test.each([[{ currentPassword: '', newPassword: 'newpw123!' }], [{ currentPassword: 'a', newPassword: 'short' }]])('입력 오류 %j → 400', async (body) => {
    const user = await loginTestUser(app);
    expect((await post('/api/users/me/password', user, body)).status).toBe(400);
  });
});

describe('회원 탈퇴 (D-041, D-131)', () => {
  async function teamOf(owner, name, ...members) {
    const team = (await post('/api/teams', owner, { name })).body.data;
    for (const member of members) {
      await runSql("INSERT INTO team_members (role, sort_order, team_id, user_id) VALUES ('member', 0, @teamId, @userId)",
        { teamId: [sql.BigInt, team.teamId], userId: [sql.BigInt, member.userId] });
    }
    return team;
  }
  test('다른 팀원이 있는 팀의 관리자 → 확인에 막는 팀, 탈퇴 409 + teams', async () => {
    const owner = await loginTestUser(app);
    const member = await loginTestUser(app);
    const team = await teamOf(owner, 'vt막는팀', member);
    const solo = await teamOf(owner, 'vt혼자팀');
    expect((await get('/api/users/me/withdrawal-check', owner)).body.data).toEqual({
      blockingTeams: [{ teamId: team.teamId, name: 'vt막는팀' }], soloTeams: [{ teamId: solo.teamId, name: 'vt혼자팀' }],
    });
    const res = await post('/api/users/me/withdraw', owner, { password: owner.password });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TEAM_OWNER_CANNOT_WITHDRAW', teams: [{ teamId: team.teamId, name: 'vt막는팀' }] });
  });
  test('비밀번호 틀림 400, 탈퇴 → 혼자인 팀 해체, 남은 팀 작업자 정리(기록 닉네임은 탈퇴 회원), 개인 데이터 삭제, 쿠키 만료, 재가입 가능', async () => {
    const owner = await loginTestUser(app);
    const leaver = await loginTestUser(app);
    await runSql("UPDATE users SET nickname = N'떠날사람' WHERE id = @id", { id: [sql.BigInt, leaver.userId] });
    const leaverCookie = (await request(app).post('/api/sessions').send({ loginId: leaver.loginId, password: leaver.password })).headers['set-cookie'][0].split(';')[0];
    const me = { ...leaver, cookie: leaverCookie };
    const team = await teamOf(owner, 'vt남는팀', leaver);
    const solo = await teamOf(me, 'vt혼자팀');
    const todo = (await post(`/api/teams/${team.teamId}/todos`, owner, TODO)).body.data;
    const task = (await post(`/api/todos/${todo.todoId}/start`, owner)).body.data;
    await post(`/api/tasks/${task.taskId}/update`, owner, { ...TODO, status: 'waiting', assigneeUserIds: [leaver.userId] });
    const myTodo = (await post('/api/personal/todos', me, TODO)).body.data;
    await post(`/api/todos/${myTodo.todoId}/start`, me);
    expect((await post('/api/users/me/withdraw', me, { password: 'wrong123!' })).body.error.code).toBe('CURRENT_PASSWORD_MISMATCH');
    const res = await post('/api/users/me/withdraw', me, { password: leaver.password });
    expect(res.body.data).toEqual({ isWithdrawn: true });
    expect(sessionCookieLine(res)).toMatch(/^todo_session=;/);
    const left = await runSql(`SELECT (SELECT COUNT(*) FROM users WHERE id = @id) AS users, (SELECT COUNT(*) FROM teams WHERE id = @solo) AS solo,
      (SELECT COUNT(*) FROM tasks WHERE user_id = @id) AS tasks, (SELECT COUNT(*) FROM team_members WHERE user_id = @id) AS members`,
    { id: [sql.BigInt, leaver.userId], solo: [sql.BigInt, solo.teamId] });
    expect(left.recordset[0]).toEqual({ users: 0, solo: 0, tasks: 0, members: 0 });
    const teamTask = (await get(`/api/teams/${team.teamId}/tasks`, owner)).body.data.tasks[0];
    expect(teamTask.assignees).toEqual([]);
    const log = (await get(`/api/tasks/${task.taskId}/logs`, owner)).body.data.logs[0];
    expect(log).toMatchObject({ isAssigneeChanged: true, nickname: '떠날사람' });
    expect((await get('/api/sessions/me', me)).status).toBe(401);
    expect((await request(app).post('/api/sessions').send({ loginId: leaver.loginId, password: leaver.password })).status).toBe(401);
  });
});
