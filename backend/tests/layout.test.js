// 공통 레이아웃이 쓰는 팀·알림 API (api.md 6.6 GET/POST/move, 6.7 알림)
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { addDays, koreaTime, koreaToday } from '../src/utils/koreaDate.js';
import { cleanupTestRows, loginTestUser, runSql, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user?.cookie ?? '').send(body);
const createTeam = async (user, name) => (await post('/api/teams', user, { name })).body.data;

// 팀 초대 알림을 바로 만든다 (초대 API 는 팀 초대 기능에서 만든다)
async function insertInvite(toUser, teamId, senderNickname = '보낸이') {
  const result = await runSql(
    `INSERT INTO notifications (notification_type, sender_nickname, user_id, team_id)
     OUTPUT inserted.id VALUES ('team_invite', @sender, @userId, @teamId)`,
    { sender: [sql.NVarChar(8), senderNickname], userId: [sql.BigInt, toUser.userId], teamId: [sql.BigInt, teamId] },
  );
  return Number(result.recordset[0].id);
}

// 개인 작업을 바로 만든다
async function insertPersonalTask(user, { endDate, endTime = null, status = 'waiting', title = 'vt작업' }) {
  const result = await runSql(
    `INSERT INTO tasks (title, content, start_date, end_date, start_time, end_time, status, sort_order, user_id, done_date)
     OUTPUT inserted.id VALUES (@title, N'내용', @startDate, @endDate, @startTime, @endTime, @status, 0, @userId,
       CASE WHEN @status = 'done' THEN SYSUTCDATETIME() ELSE NULL END)`,
    {
      title: [sql.NVarChar(50), title], startDate: [sql.Date, endDate], endDate: [sql.Date, endDate],
      startTime: [sql.VarChar(8), endTime ? '00:00:00' : null], endTime: [sql.VarChar(8), endTime],
      status: [sql.NVarChar(10), status], userId: [sql.BigInt, user.userId],
    },
  );
  return Number(result.recordset[0].id);
}

beforeAll(cleanupTestRows);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('로그인 필요', () => {
  test.each([
    ['GET', '/api/teams'], ['POST', '/api/teams'], ['POST', '/api/teams/1/move'],
    ['GET', '/api/notifications'], ['POST', '/api/notifications/read'], ['POST', '/api/notifications/1/delete'],
    ['POST', '/api/notifications/1/accept'], ['POST', '/api/notifications/1/decline'],
  ])('%s %s → 401', async (method, path) => {
    const res = method === 'GET' ? await get(path) : await post(path);
    expect(res.status).toBe(401);
  });
});

describe('팀 목록·만들기', () => {
  test('팀이 없으면 빈 배열, 만들면 owner 로 맨 위 + 기본 일일보고 양식', async () => {
    const user = await loginTestUser(app);
    expect((await get('/api/teams', user)).body.data).toEqual({ teams: [] });
    const first = await createTeam(user, '  vt첫팀  ');
    expect(first).toEqual({ teamId: expect.any(Number), name: 'vt첫팀', myRole: 'owner' });
    const second = await createTeam(user, 'vt둘째팀');
    expect((await get('/api/teams', user)).body.data.teams.map((t) => t.name)).toEqual(['vt둘째팀', 'vt첫팀']);
    const template = await runSql('SELECT header, sections FROM report_templates WHERE team_id = @id', { id: [sql.BigInt, second.teamId] });
    expect(template.recordset[0].header).toBe('{날짜} 진행 사항입니다.');
    expect(JSON.parse(template.recordset[0].sections).map((s) => s.title)).toEqual(['◆ 통계', '◆ 진행', '◆ 대기', '◆ 완료', '◆ 기타']);
  });
  test.each([[''], ['   '], ['a'.repeat(21)], [1], [null]])('팀 이름 %j → 400', async (name) => {
    const user = await loginTestUser(app);
    expect((await post('/api/teams', user, { name })).status).toBe(400);
  });
  test('경계: 1자·20자 팀 이름은 만들어진다', async () => {
    const user = await loginTestUser(app);
    expect((await post('/api/teams', user, { name: 'v' })).status).toBe(200);
    await runSql("UPDATE teams SET name = 'vt1' WHERE name = 'v' AND id IN (SELECT team_id FROM team_members WHERE user_id = @id)", { id: [sql.BigInt, user.userId] });
    expect((await post('/api/teams', user, { name: `vt${'가'.repeat(18)}` })).body.data.name).toHaveLength(20);
  });
  test('경계: 팀 19개까지 만들고 20번째도 성공, 21번째는 409 TEAM_LIMIT_EXCEEDED', async () => {
    const user = await loginTestUser(app);
    for (let i = 1; i <= 20; i += 1) {
      expect((await post('/api/teams', user, { name: `vt팀${i}` })).status).toBe(200);
    }
    const over = await post('/api/teams', user, { name: 'vt팀21' });
    expect(over.status).toBe(409);
    expect(over.body.error).toEqual({ code: 'TEAM_LIMIT_EXCEEDED', message: '가입된 팀이 20개라 더 만들 수 없습니다.' });
  });
});

describe('POST /api/teams/{id}/move', () => {
  test('놓은 자리로 옮기고 0 부터 다시 매긴다, 범위를 넘으면 맨 아래', async () => {
    const user = await loginTestUser(app);
    const a = await createTeam(user, 'vtA');
    const b = await createTeam(user, 'vtB');
    const c = await createTeam(user, 'vtC');
    const names = (res) => res.body.data.teams.map((t) => t.name);
    expect(names(await post(`/api/teams/${c.teamId}/move`, user, { index: 2 }))).toEqual(['vtB', 'vtA', 'vtC']);
    expect(names(await post(`/api/teams/${a.teamId}/move`, user, { index: 0 }))).toEqual(['vtA', 'vtB', 'vtC']);
    expect(names(await post(`/api/teams/${a.teamId}/move`, user, { index: 99 }))).toEqual(['vtB', 'vtC', 'vtA']);
    const orders = await runSql('SELECT sort_order FROM team_members WHERE user_id = @id ORDER BY sort_order', { id: [sql.BigInt, user.userId] });
    expect(orders.recordset.map((r) => r.sort_order)).toEqual([0, 1, 2]);
    expect(names(await get('/api/teams', user))).toEqual(['vtB', 'vtC', 'vtA']);
    expect(b.teamId).toBeGreaterThan(0);
  });
  test.each([[-1], [1.5], ['0'], [null]])('index %j → 400', async (index) => {
    const user = await loginTestUser(app);
    const team = await createTeam(user, 'vt이동');
    expect((await post(`/api/teams/${team.teamId}/move`, user, { index })).status).toBe(400);
  });
  test('남의 팀 → 404', async () => {
    const owner = await loginTestUser(app);
    const other = await loginTestUser(app);
    const team = await createTeam(owner, 'vt남의팀');
    expect((await post(`/api/teams/${team.teamId}/move`, other, { index: 0 })).status).toBe(404);
  });
});

describe('알림', () => {
  test('목록·안 본 개수, 읽음 처리', async () => {
    const owner = await loginTestUser(app);
    const user = await loginTestUser(app);
    const team = await createTeam(owner, 'vt초대팀');
    await insertInvite(user, team.teamId, '김민수');
    const list = (await get('/api/notifications', user)).body.data;
    expect(list.unreadCount).toBe(1);
    expect(list.notifications[0]).toMatchObject({
      notificationType: 'team_invite', teamId: team.teamId, teamName: 'vt초대팀', taskId: null, senderNickname: '김민수', isRead: false,
    });
    expect((await post('/api/notifications/read', user)).body.data).toEqual({ unreadCount: 0 });
    expect((await get('/api/notifications', user)).body.data.notifications[0].isRead).toBe(true);
  });
  test('초대 수락 → member 로 내 팀 목록 맨 위, 알림 삭제', async () => {
    const owner = await loginTestUser(app);
    const user = await loginTestUser(app);
    await createTeam(user, 'vt내팀');
    const team = await createTeam(owner, 'vt수락팀');
    const id = await insertInvite(user, team.teamId);
    const res = await post(`/api/notifications/${id}/accept`, user);
    expect(res.body.data).toEqual({ teamId: team.teamId, name: 'vt수락팀', myRole: 'member' });
    expect((await get('/api/teams', user)).body.data.teams.map((t) => t.name)).toEqual(['vt수락팀', 'vt내팀']);
    expect((await get('/api/notifications', user)).body.data.notifications).toHaveLength(0);
    expect((await post(`/api/notifications/${id}/accept`, user)).status).toBe(404);
  });
  test('수락할 때 팀이 20개면 409, 알림은 남는다', async () => {
    const owner = await loginTestUser(app);
    const user = await loginTestUser(app);
    for (let i = 1; i <= 20; i += 1) {
      await createTeam(user, `vt가득${i}`);
    }
    const team = await createTeam(owner, 'vt넘침팀');
    const id = await insertInvite(user, team.teamId);
    const res = await post(`/api/notifications/${id}/accept`, user);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('가입된 팀이 20개라 더 가입할 수 없습니다.');
    expect((await get('/api/notifications', user)).body.data.notifications).toHaveLength(1);
  });
  test('초대 거절 → 알림 삭제, 거절 기록. 초대는 [X] 로 못 지움 (400)', async () => {
    const owner = await loginTestUser(app);
    const user = await loginTestUser(app);
    const team = await createTeam(owner, 'vt거절팀');
    const id = await insertInvite(user, team.teamId);
    expect((await post(`/api/notifications/${id}/delete`, user)).status).toBe(400);
    expect((await post(`/api/notifications/${id}/decline`, user)).body.data).toEqual({ isDeclined: true });
    const declines = await runSql('SELECT COUNT(*) AS n FROM team_invite_declines WHERE user_id = @id', { id: [sql.BigInt, user.userId] });
    expect(declines.recordset[0].n).toBe(1);
    expect((await get('/api/teams', user)).body.data.teams).toHaveLength(0);
  });
  test('남의 알림 id → 404, 경로 id 오류 → 400', async () => {
    const owner = await loginTestUser(app);
    const user = await loginTestUser(app);
    const team = await createTeam(owner, 'vt남알림');
    const id = await insertInvite(user, team.teamId);
    for (const action of ['accept', 'decline', 'delete']) {
      expect((await post(`/api/notifications/${id}/${action}`, owner)).status).toBe(404);
    }
    expect((await post('/api/notifications/abc/delete', user)).status).toBe(400);
  });
});

describe('마감 임박 알림 (D-128, D-138)', () => {
  test('내일·오늘 마감 대기·진행 작업만, 작업마다 한 번', async () => {
    const user = await loginTestUser(app);
    const today = koreaToday();
    const tomorrow = await insertPersonalTask(user, { endDate: addDays(today, 1), title: '내일마감' });
    const todayTask = await insertPersonalTask(user, { endDate: today, status: 'progress', title: '오늘마감' });
    await insertPersonalTask(user, { endDate: addDays(today, 2), title: '모레마감' });
    await insertPersonalTask(user, { endDate: addDays(today, -1), title: '지난마감' });
    await insertPersonalTask(user, { endDate: today, status: 'done', title: '완료작업' });
    const first = (await get('/api/notifications', user)).body.data.notifications;
    expect(first.map((n) => n.taskId).sort()).toEqual([tomorrow, todayTask].sort());
    expect(first.find((n) => n.taskId === tomorrow)).toMatchObject({
      notificationType: 'due_soon', teamId: null, teamName: null, taskTitle: '내일마감', taskEndDate: addDays(today, 1), taskEndTime: null, senderNickname: null,
    });
    expect((await get('/api/notifications', user)).body.data.notifications).toHaveLength(2);
    const id = first[0].notificationId;
    expect((await post(`/api/notifications/${id}/delete`, user)).body.data.unreadCount).toBe(1);
  });
  test('경계: 오늘 마감 시각이 지난 작업은 만들지 않는다, 아직이면 만든다 (시각 HH:mm)', async () => {
    const user = await loginTestUser(app);
    const today = koreaToday();
    const [hour, minute] = koreaTime().split(':').map(Number);
    if (hour === 0 && minute < 10) {
      return; // 자정 직후에는 지난 시각을 만들 수 없어 건너뛴다
    }
    const past = `${String(hour).padStart(2, '0')}:${String(minute - (minute % 5)).padStart(2, '0')}:00`;
    await insertPersonalTask(user, { endDate: today, endTime: past === '00:00:00' ? '00:00:00' : past, title: '지난시각' });
    const later = hour < 23 ? `${String(hour + 1).padStart(2, '0')}:00:00` : null;
    const laterId = later ? await insertPersonalTask(user, { endDate: today, endTime: later, title: '남은시각' }) : null;
    const list = (await get('/api/notifications', user)).body.data.notifications;
    expect(list.some((n) => n.taskTitle === '지난시각')).toBe(false);
    if (laterId) {
      expect(list.find((n) => n.taskId === laterId).taskEndTime).toBe(later.slice(0, 5));
    }
  });
});
