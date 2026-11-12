// 팀 관리·초대 API (api.md 6.6, 6.7): 권한 표, 작업자 정리, 초대 규칙
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { captureMails, cleanupTestRows, loginTestUser, runSql, sentMails, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user.cookie);
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user.cookie).send(body);
const TODO = { title: '작업', content: '내용', isPeriodUndecided: true, startDate: null, endDate: null, startTime: null, endTime: null };

// 관리자 + 부관리자 + 팀원 2명인 팀
async function setupTeam() {
  const owner = await loginTestUser(app);
  const manager = await loginTestUser(app);
  const member = await loginTestUser(app);
  const member2 = await loginTestUser(app);
  const team = (await post('/api/teams', owner, { name: 'vt관리팀' })).body.data;
  for (const [user, role] of [[manager, 'manager'], [member, 'member'], [member2, 'member']]) {
    await runSql('INSERT INTO team_members (role, sort_order, team_id, user_id) VALUES (@role, 0, @teamId, @userId)',
      { role: [sql.NVarChar(10), role], teamId: [sql.BigInt, team.teamId], userId: [sql.BigInt, user.userId] });
  }
  return { owner, manager, member, member2, teamId: team.teamId, base: `/api/teams/${team.teamId}` };
}

beforeAll(cleanupTestRows);
beforeEach(captureMails);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('팀 정보·이름 수정', () => {
  test('팀 정보: 관리자 닉네임, 팀원 수, 내 역할', async () => {
    const { member, base, teamId } = await setupTeam();
    expect((await get(base, member)).body.data).toEqual({
      teamId, name: 'vt관리팀', myRole: 'member', ownerNickname: '테스트', memberCount: 4, createDate: expect.any(String),
    });
  });
  test('이름 수정: 관리자·부관리자 O, 팀원 403, 남 404', async () => {
    const { owner, manager, member, base } = await setupTeam();
    const stranger = await loginTestUser(app);
    expect((await post(`${base}/update`, manager, { name: ' vt새이름 ' })).body.data.name).toBe('vt새이름');
    expect((await post(`${base}/update`, owner, { name: 'vt또이름' })).status).toBe(200);
    expect((await post(`${base}/update`, member, { name: 'vt안됨' })).status).toBe(403);
    expect((await post(`${base}/update`, stranger, { name: 'vt안됨' })).status).toBe(404);
    expect((await post(`${base}/update`, owner, { name: 'a'.repeat(21) })).status).toBe(400);
  });
});

describe('내보내기·역할·관리자 넘기기 (D-030 권한 표)', () => {
  test('부관리자는 팀원만 내보낼 수 있고, 관리자·자기 자신은 대상이 될 수 없다', async () => {
    const { owner, manager, member, member2, base } = await setupTeam();
    expect((await post(`${base}/members/${owner.userId}/remove`, manager)).status).toBe(403);
    expect((await post(`${base}/members/${manager.userId}/remove`, manager)).status).toBe(400);
    expect((await post(`${base}/members/${member.userId}/remove`, member2)).status).toBe(403);
    const res = await post(`${base}/members/${member.userId}/remove`, manager);
    expect(res.body.data.members.map((m) => m.userId)).not.toContain(member.userId);
    expect((await post(`${base}/members/${member.userId}/remove`, manager)).status).toBe(404);
    expect((await post(`${base}/members/${manager.userId}/remove`, owner)).status).toBe(200);
    expect((await get('/api/teams', member)).body.data.teams).toHaveLength(0);
  });
  test('내보내면 작업자에서 빠지고 기록(닉네임은 내보낸 회원), 그 팀 알림도 지운다', async () => {
    const { owner, member, base } = await setupTeam();
    await runSql("UPDATE users SET nickname = N'관리자' WHERE id = @id", { id: [sql.BigInt, owner.userId] });
    await runSql("UPDATE users SET nickname = N'팀원' WHERE id = @id", { id: [sql.BigInt, member.userId] });
    const todo = (await post(`${base}/todos`, owner, TODO)).body.data;
    const task = (await post(`/api/todos/${todo.todoId}/start`, owner)).body.data;
    await post(`/api/tasks/${task.taskId}/update`, owner, { ...TODO, status: 'waiting', assigneeUserIds: [member.userId, owner.userId] });
    expect((await get('/api/notifications', member)).body.data.notifications).toHaveLength(1);
    await post(`${base}/members/${member.userId}/remove`, owner);
    const after = (await get(`${base}/tasks`, owner)).body.data.tasks[0];
    expect(after.assignees.map((a) => a.userId)).toEqual([owner.userId]);
    const log = (await get(`/api/tasks/${task.taskId}/logs`, owner)).body.data.logs[0];
    expect(log).toMatchObject({ logType: 'change', isAssigneeChanged: true, nickname: '관리자', assigneeNicknames: ['관리자'] });
    expect((await get('/api/notifications', member)).body.data.notifications).toHaveLength(0);
  });
  test('부관리자 지정·해제는 관리자만, 같은 역할이면 그대로 성공', async () => {
    const { owner, manager, member, base } = await setupTeam();
    expect((await post(`${base}/members/${member.userId}/role`, manager, { role: 'manager' })).status).toBe(403);
    const roleOf = (res, id) => res.body.data.members.find((m) => m.userId === id).role;
    expect(roleOf(await post(`${base}/members/${member.userId}/role`, owner, { role: 'manager' }), member.userId)).toBe('manager');
    expect(roleOf(await post(`${base}/members/${member.userId}/role`, owner, { role: 'manager' }), member.userId)).toBe('manager');
    expect(roleOf(await post(`${base}/members/${manager.userId}/role`, owner, { role: 'member' }), manager.userId)).toBe('member');
    expect((await post(`${base}/members/${member.userId}/role`, owner, { role: 'owner' })).status).toBe(400);
  });
  test('관리자 넘기기 → 대상 owner, 나는 manager. 관리자만', async () => {
    const { owner, manager, member, base } = await setupTeam();
    expect((await post(`${base}/owner`, manager, { userId: member.userId })).status).toBe(403);
    expect((await post(`${base}/owner`, owner, { userId: owner.userId })).status).toBe(400);
    expect((await post(`${base}/owner`, owner, { userId: '1' })).status).toBe(400);
    const res = (await post(`${base}/owner`, owner, { userId: member.userId })).body.data;
    expect(res.myRole).toBe('manager');
    expect(res.members[0]).toMatchObject({ userId: member.userId, role: 'owner' });
    expect(res.members.filter((m) => m.role === 'owner')).toHaveLength(1);
  });
});

describe('탈퇴·해체', () => {
  test('관리자는 탈퇴 403, 팀원은 탈퇴하면 팀 목록에서 빠진다', async () => {
    const { owner, member, base } = await setupTeam();
    expect((await post(`${base}/leave`, owner)).status).toBe(403);
    expect((await post(`${base}/leave`, member)).body.data).toEqual({ isLeft: true });
    expect((await get('/api/teams', member)).body.data.teams).toHaveLength(0);
    expect((await post(`${base}/leave`, member)).status).toBe(404);
  });
  test('해체: 관리자만, 팀 이름이 다르면 400 TEAM_NAME_MISMATCH, 맞으면 팀·할일·작업·알림 모두 삭제', async () => {
    const { owner, manager, member, base, teamId } = await setupTeam();
    const todo = (await post(`${base}/todos`, owner, TODO)).body.data;
    const task = (await post(`/api/todos/${todo.todoId}/start`, owner)).body.data;
    await post(`/api/tasks/${task.taskId}/update`, owner, { ...TODO, status: 'waiting', assigneeUserIds: [member.userId] });
    expect((await post(`${base}/delete`, manager, { name: 'vt관리팀' })).status).toBe(403);
    const mismatch = await post(`${base}/delete`, owner, { name: 'vt다른팀' });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe('TEAM_NAME_MISMATCH');
    expect((await post(`${base}/delete`, owner, { name: '  vt관리팀  ' })).body.data).toEqual({ isDeleted: true });
    const left = await runSql(`SELECT (SELECT COUNT(*) FROM teams WHERE id = @id) AS teams, (SELECT COUNT(*) FROM tasks WHERE team_id = @id) AS tasks,
      (SELECT COUNT(*) FROM report_templates WHERE team_id = @id) AS templates, (SELECT COUNT(*) FROM notifications WHERE task_id = @taskId) AS notes`,
    { id: [sql.BigInt, teamId], taskId: [sql.BigInt, task.taskId] });
    expect(left.recordset[0]).toEqual({ teams: 0, tasks: 0, templates: 0, notes: 0 });
    expect((await get(base, owner)).status).toBe(404);
  });
});

describe('초대 (6.7)', () => {
  test('초대 → 알림 + 안내 메일(이스케이프), 목록, 수락하면 팀원', async () => {
    const { owner, base, teamId } = await setupTeam();
    const guest = await loginTestUser(app);
    await runSql("UPDATE users SET nickname = N'<b>나</b>' WHERE id = @id", { id: [sql.BigInt, owner.userId] });
    const owner2 = { ...owner, cookie: (await request(app).post('/api/sessions').send({ loginId: owner.loginId, password: owner.password })).headers['set-cookie'][0].split(';')[0] };
    expect((await post(`${base}/invitations`, owner2, { email: ` ${guest.email.toUpperCase().replace('@EXAMPLE.COM', '@example.com')} ` })).body.data).toEqual({ isMailSent: true });
    expect(sentMails[0].subject).toBe('[TODO] 팀 초대 안내');
    expect(sentMails[0].html).toContain('&lt;b&gt;나&lt;/b&gt;님이 vt관리팀 팀에 초대했습니다.');
    const list = (await get(`${base}/invitations`, owner2)).body.data.invitations;
    expect(list).toEqual([expect.objectContaining({ nickname: '테스트', email: guest.email, senderNickname: '<b>나</b>', canCancel: true })]);
    const note = (await get('/api/notifications', guest)).body.data.notifications[0];
    expect(note).toMatchObject({ notificationType: 'team_invite', teamId });
    expect((await post(`/api/notifications/${note.notificationId}/accept`, guest)).body.data.myRole).toBe('member');
  });
  test.each([
    ['vtnobody@example.com', 404, 'USER_NOT_FOUND'],
  ])('없는 회원 %s → %s', async (email, status, code) => {
    const { owner, base } = await setupTeam();
    const res = await post(`${base}/invitations`, owner, { email });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });
  test('이미 팀원(자기 자신 포함) 409, 이미 초대 409, 거절 뒤 24시간 429, 지나면 다시 초대', async () => {
    const { owner, member, base } = await setupTeam();
    const guest = await loginTestUser(app);
    expect((await post(`${base}/invitations`, owner, { email: owner.email })).body.error.code).toBe('ALREADY_TEAM_MEMBER');
    expect((await post(`${base}/invitations`, owner, { email: member.email })).body.error.code).toBe('ALREADY_TEAM_MEMBER');
    await post(`${base}/invitations`, member, { email: guest.email });
    expect((await post(`${base}/invitations`, owner, { email: guest.email })).body.error.code).toBe('INVITATION_DUPLICATED');
    const note = (await get('/api/notifications', guest)).body.data.notifications[0];
    await post(`/api/notifications/${note.notificationId}/decline`, guest);
    const declined = await post(`${base}/invitations`, owner, { email: guest.email });
    expect(declined.status).toBe(429);
    expect(declined.body.error.code).toBe('INVITATION_RECENTLY_DECLINED');
    await runSql('UPDATE team_invite_declines SET create_date = DATEADD(HOUR, -24, create_date) WHERE user_id = @id', { id: [sql.BigInt, guest.userId] });
    expect((await post(`${base}/invitations`, owner, { email: guest.email })).status).toBe(200);
  });
  test.each([[''], ['vtbad@example'], [`vt${'a'.repeat(87)}@example.com`]])('이메일 %s → 400', async (email) => {
    const { owner, base } = await setupTeam();
    expect((await post(`${base}/invitations`, owner, { email })).status).toBe(400);
  });
  test('메일 발송 실패 → 초대는 남고 isMailSent false', async () => {
    const { owner, base } = await setupTeam();
    const guest = await loginTestUser(app);
    const { setSendMailOverride } = await import('../src/config/mail.js');
    setSendMailOverride(async () => { throw new Error('smtp'); });
    expect((await post(`${base}/invitations`, owner, { email: guest.email })).body.data).toEqual({ isMailSent: false });
    expect((await get(`${base}/invitations`, owner)).body.data.invitations).toHaveLength(1);
  });
  test('초대 취소: 초대한 본인·관리자·부관리자만 (canCancel), 팀원은 남의 초대 403', async () => {
    const { owner, member, member2, base } = await setupTeam();
    const guest = await loginTestUser(app);
    await post(`${base}/invitations`, member, { email: guest.email });
    const [invite] = (await get(`${base}/invitations`, member2)).body.data.invitations;
    expect(invite.canCancel).toBe(false);
    expect((await post(`${base}/invitations/${invite.notificationId}/cancel`, member2)).status).toBe(403);
    expect((await get(`${base}/invitations`, owner)).body.data.invitations[0].canCancel).toBe(true);
    expect((await post(`${base}/invitations/${invite.notificationId}/cancel`, member)).body.data.invitations).toEqual([]);
    expect((await post(`${base}/invitations/${invite.notificationId}/cancel`, owner)).status).toBe(404);
    expect((await get('/api/notifications', guest)).body.data.notifications).toHaveLength(0);
  });
});
