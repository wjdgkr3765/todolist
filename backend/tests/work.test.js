// 할일·작업 API (api.md 6.4, 6.5): 실제 개발 DB 에 요청한다
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { isFiveMinuteTime, isRealDate } from '../src/utils/todoInput.js';
import { cleanupTestRows, loginTestUser, runSql, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user?.cookie ?? '').send(body);
const TODO = { title: '할일', content: '내용', isPeriodUndecided: false, startDate: '2026-11-10', endDate: '2026-11-20', startTime: null, endTime: null };

async function addTodo(user, base = '/api/personal', overrides = {}) {
  return (await post(`${base}/todos`, user, { ...TODO, ...overrides })).body.data;
}
async function startTask(user, base = '/api/personal', overrides = {}) {
  const todo = await addTodo(user, base, overrides);
  return (await post(`/api/todos/${todo.todoId}/start`, user)).body.data;
}
const taskBody = (task, overrides = {}) => ({
  title: task.title, content: task.content, isPeriodUndecided: task.isPeriodUndecided, startDate: task.startDate, endDate: task.endDate,
  startTime: task.startTime, endTime: task.endTime, status: task.status, assigneeUserIds: task.assignees.map((a) => a.userId), ...overrides,
});
const titles = (tasks, status) => tasks.filter((t) => t.status === status).map((t) => t.title);

async function teamWith(owner, ...members) {
  const team = (await post('/api/teams', owner, { name: 'vt작업팀' })).body.data;
  for (const member of members) {
    await runSql("INSERT INTO team_members (role, sort_order, team_id, user_id) VALUES ('member', 0, @teamId, @userId)",
      { teamId: [sql.BigInt, team.teamId], userId: [sql.BigInt, member.userId] });
  }
  return team;
}

beforeAll(cleanupTestRows);
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('기간 입력 규칙', () => {
  test.each([['2026-02-28', true], ['2026-02-29', false], ['2028-02-29', true], ['2026-13-01', false], ['2026-1-01', false], [null, false]])(
    '날짜 %s → %s', (value, expected) => expect(isRealDate(value)).toBe(expected),
  );
  test.each([['00:00', true], ['23:55', true], ['23:59', false], ['09:05', true], ['09:03', false], ['24:00', false], ['9:00', false]])(
    '시각 %s → %s', (value, expected) => expect(isFiveMinuteTime(value)).toBe(expected),
  );
});

describe('할일 (6.4)', () => {
  test('로그인 필요, 없는 경로는 404 그대로', async () => {
    expect((await get('/api/personal/todos')).status).toBe(401);
    expect((await post('/api/todos/1/start')).status).toBe(401);
    expect((await get('/api/nothing')).status).toBe(404);
  });
  test('추가·목록(최근 순)·수정·삭제, 앞뒤 공백 제거, 시간 있는 기간', async () => {
    const user = await loginTestUser(app);
    const first = await addTodo(user, '/api/personal', { title: '  첫 할일 ' });
    const second = await addTodo(user, '/api/personal', { title: '둘째', startTime: '09:00', endTime: '18:00', startDate: '2026-11-12', endDate: '2026-11-12' });
    expect(first.title).toBe('첫 할일');
    expect(second).toMatchObject({ startDate: '2026-11-12', endDate: '2026-11-12', startTime: '09:00', endTime: '18:00' });
    expect((await get('/api/personal/todos', user)).body.data.todos.map((t) => t.title)).toEqual(['둘째', '첫 할일']);
    const updated = (await post(`/api/todos/${first.todoId}/update`, user, { ...TODO, title: '고친 할일', isPeriodUndecided: true, startDate: null, endDate: null })).body.data;
    expect(updated).toMatchObject({ title: '고친 할일', isPeriodUndecided: true, startDate: null, endDate: null, startTime: null, endTime: null });
    expect((await post(`/api/todos/${first.todoId}/delete`, user)).body.data).toEqual({ isDeleted: true });
    expect((await post(`/api/todos/${first.todoId}/delete`, user)).status).toBe(404);
  });
  test.each([
    [{ title: '' }], [{ title: '   ' }], [{ title: 'a'.repeat(51) }], [{ content: '' }], [{ content: 'a'.repeat(2001) }],
    [{ isPeriodUndecided: 'false' }], [{ startDate: null }], [{ startDate: '2026-11-21' }], [{ endDate: '2026-02-30' }],
    [{ isPeriodUndecided: true }], [{ startTime: '09:00' }], [{ startTime: '09:03', endTime: '18:00' }],
    [{ startDate: '2026-11-12', endDate: '2026-11-12', startTime: '18:00', endTime: '09:00' }],
  ])('입력 오류 %j → 400', async (overrides) => {
    const user = await loginTestUser(app);
    expect((await post('/api/personal/todos', user, { ...TODO, ...overrides })).status).toBe(400);
  });
  test('경계: 제목 50자·내용 2000자, 같은 날 같은 시각, 다른 날이면 종료 시각이 앞이어도 된다', async () => {
    const user = await loginTestUser(app);
    expect((await post('/api/personal/todos', user, { ...TODO, title: 'a'.repeat(50), content: 'b'.repeat(2000) })).status).toBe(200);
    expect((await post('/api/personal/todos', user, { ...TODO, startDate: '2026-11-12', endDate: '2026-11-12', startTime: '09:00', endTime: '09:00' })).status).toBe(200);
    expect((await post('/api/personal/todos', user, { ...TODO, startTime: '18:00', endTime: '09:00' })).status).toBe(200);
  });
  test('남의 개인 할일 → 404, 팀원이 아니면 팀 할일 404, 팀원이면 된다', async () => {
    const owner = await loginTestUser(app);
    const member = await loginTestUser(app);
    const stranger = await loginTestUser(app);
    const mine = await addTodo(owner);
    expect((await post(`/api/todos/${mine.todoId}/update`, stranger, TODO)).status).toBe(404);
    expect((await post(`/api/todos/${mine.todoId}/start`, stranger)).status).toBe(404);
    const team = await teamWith(owner, member);
    const base = `/api/teams/${team.teamId}`;
    const teamTodo = await addTodo(member, base);
    expect((await get(`${base}/todos`, stranger)).status).toBe(404);
    expect((await post(`${base}/todos`, stranger, TODO)).status).toBe(404);
    expect((await post(`/api/todos/${teamTodo.todoId}/delete`, stranger)).status).toBe(404);
    expect((await get(`${base}/todos`, owner)).body.data.todos).toHaveLength(1);
    expect((await get('/api/teams/abc/todos', owner)).status).toBe(400);
  });
});

describe('작업 시작과 칸반 (6.5)', () => {
  test('작업 시작 → 할일 삭제, 대기 맨 위, "작업 생성" 기록(만든 사람 닉네임)', async () => {
    const user = await loginTestUser(app);
    const a = await startTask(user, '/api/personal', { title: 'A' });
    const b = await startTask(user, '/api/personal', { title: 'B' });
    expect(b).toMatchObject({ title: 'B', status: 'waiting', sortOrder: 0, assignees: [], doneDate: null });
    expect((await get('/api/personal/todos', user)).body.data.todos).toHaveLength(0);
    const tasks = (await get('/api/personal/tasks', user)).body.data.tasks;
    expect(titles(tasks, 'waiting')).toEqual(['B', 'A']);
    const logs = (await get(`/api/tasks/${a.taskId}/logs`, user)).body.data.logs;
    expect(logs).toEqual([expect.objectContaining({ logType: 'create', nickname: '테스트', status: 'waiting', title: 'A', assigneeNicknames: [] })]);
  });
  test('같은 공간 드래그 → 순서만, 기록 없음 / 다른 공간 → 상태·완료 시각·기록, 범위 넘으면 맨 아래', async () => {
    const user = await loginTestUser(app);
    const a = await startTask(user, '/api/personal', { title: 'A' });
    await startTask(user, '/api/personal', { title: 'B' });
    const c = await startTask(user, '/api/personal', { title: 'C' });
    let tasks = (await post(`/api/tasks/${c.taskId}/move`, user, { status: 'waiting', index: 2 })).body.data.tasks;
    expect(titles(tasks, 'waiting')).toEqual(['B', 'A', 'C']);
    expect((await get(`/api/tasks/${c.taskId}/logs`, user)).body.data.logs).toHaveLength(1);
    tasks = (await post(`/api/tasks/${a.taskId}/move`, user, { status: 'done', index: 99 })).body.data.tasks;
    expect(titles(tasks, 'waiting')).toEqual(['B', 'C']);
    expect(tasks.filter((t) => t.status === 'waiting').map((t) => t.sortOrder)).toEqual([0, 1]);
    const done = tasks.find((t) => t.taskId === a.taskId);
    expect(done.doneDate).not.toBeNull();
    expect((await get(`/api/tasks/${a.taskId}/logs`, user)).body.data.logs[0]).toMatchObject({ logType: 'change', beforeStatus: 'waiting', status: 'done', isContentChanged: false });
    tasks = (await post(`/api/tasks/${a.taskId}/move`, user, { status: 'progress', index: 0 })).body.data.tasks;
    expect(tasks.find((t) => t.taskId === a.taskId).doneDate).toBeNull();
  });
  test.each([[{ status: 'todo', index: 0 }], [{ status: 'done', index: -1 }], [{ status: 'done', index: '0' }]])('드래그 입력 오류 %j → 400', async (body) => {
    const user = await loginTestUser(app);
    const task = await startTask(user);
    expect((await post(`/api/tasks/${task.taskId}/move`, user, body)).status).toBe(400);
  });
  test('경계: 완료 6일 23시간은 목록에 있고, 7일 지나면 빠지고 수정·드래그·삭제는 409, 기록 보기는 된다', async () => {
    const user = await loginTestUser(app);
    const task = await startTask(user);
    await post(`/api/tasks/${task.taskId}/move`, user, { status: 'done', index: 0 });
    const setDone = (hours) => runSql('UPDATE tasks SET done_date = DATEADD(HOUR, @hours, SYSUTCDATETIME()) WHERE id = @id',
      { id: [sql.BigInt, task.taskId], hours: [sql.Int, hours] });
    await setDone(-(7 * 24 - 1));
    expect((await get('/api/personal/tasks', user)).body.data.tasks).toHaveLength(1);
    await setDone(-(7 * 24));
    expect((await get('/api/personal/tasks', user)).body.data.tasks).toHaveLength(0);
    const conflict = await post(`/api/tasks/${task.taskId}/move`, user, { status: 'waiting', index: 0 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('TASK_IN_HISTORY');
    expect((await post(`/api/tasks/${task.taskId}/update`, user, taskBody(task))).status).toBe(409);
    expect((await post(`/api/tasks/${task.taskId}/delete`, user)).status).toBe(409);
    expect((await get(`/api/tasks/${task.taskId}/logs`, user)).status).toBe(200);
  });
  test('상세 수정: 바뀐 것 없음 → 기록 없음 / 내용·상태 바꿈 → 옮긴 공간 맨 위, 기록 한 줄', async () => {
    const user = await loginTestUser(app);
    await startTask(user, '/api/personal', { title: 'P1' });
    const p1 = (await get('/api/personal/tasks', user)).body.data.tasks[0];
    await post(`/api/tasks/${p1.taskId}/move`, user, { status: 'progress', index: 0 });
    const task = await startTask(user, '/api/personal', { title: 'T' });
    const same = await post(`/api/tasks/${task.taskId}/update`, user, taskBody(task));
    expect(same.body.data.updateDate).toBeNull();
    expect((await get(`/api/tasks/${task.taskId}/logs`, user)).body.data.logs).toHaveLength(1);
    const changed = (await post(`/api/tasks/${task.taskId}/update`, user, taskBody(task, { title: '바뀐 제목', status: 'progress' }))).body.data;
    expect(changed).toMatchObject({ title: '바뀐 제목', status: 'progress', sortOrder: 0 });
    expect(changed.updateDate).not.toBeNull();
    const tasks = (await get('/api/personal/tasks', user)).body.data.tasks;
    expect(titles(tasks, 'progress')).toEqual(['바뀐 제목', 'P1']);
    expect((await get(`/api/tasks/${task.taskId}/logs`, user)).body.data.logs[0]).toMatchObject({ isContentChanged: true, isAssigneeChanged: false, beforeStatus: 'waiting' });
  });
  test('개인 작업에 작업자 → 400, 입력 오류 → 400', async () => {
    const user = await loginTestUser(app);
    const task = await startTask(user);
    expect((await post(`/api/tasks/${task.taskId}/update`, user, taskBody(task, { assigneeUserIds: [user.userId] }))).status).toBe(400);
    for (const overrides of [{ status: 'x' }, { assigneeUserIds: [1, 1] }, { assigneeUserIds: [0] }, { assigneeUserIds: 'a' }]) {
      expect((await post(`/api/tasks/${task.taskId}/update`, user, taskBody(task, overrides))).status).toBe(400);
    }
  });
  test('팀 작업자: 지정 순서 유지, 다른 팀원에게 작업자 지정 알림, 팀원이 아니면 400, 순서만 바꾸면 변경 아님', async () => {
    const owner = await loginTestUser(app);
    const member = await loginTestUser(app);
    const stranger = await loginTestUser(app);
    const team = await teamWith(owner, member);
    const task = await startTask(owner, `/api/teams/${team.teamId}`);
    expect((await post(`/api/tasks/${task.taskId}/update`, owner, taskBody(task, { assigneeUserIds: [stranger.userId] }))).status).toBe(400);
    const assigned = (await post(`/api/tasks/${task.taskId}/update`, owner, taskBody(task, { assigneeUserIds: [member.userId, owner.userId] }))).body.data;
    expect(assigned.assignees.map((a) => a.userId)).toEqual([member.userId, owner.userId]);
    const memberNotes = (await get('/api/notifications', member)).body.data.notifications;
    expect(memberNotes).toEqual([expect.objectContaining({ notificationType: 'task_assigned', taskId: task.taskId, teamName: 'vt작업팀', senderNickname: '테스트' })]);
    expect((await get('/api/notifications', owner)).body.data.notifications).toHaveLength(0);
    const logs = (await get(`/api/tasks/${task.taskId}/logs`, owner)).body.data.logs;
    expect(logs[0]).toMatchObject({ isAssigneeChanged: true, isContentChanged: false, beforeStatus: null, assigneeNicknames: ['테스트', '테스트'] });
    const reordered = await post(`/api/tasks/${task.taskId}/update`, owner, taskBody(assigned, { assigneeUserIds: [owner.userId, member.userId] }));
    expect(reordered.status).toBe(200);
    expect((await get(`/api/tasks/${task.taskId}/logs`, owner)).body.data.logs).toHaveLength(2);
    expect((await get(`/api/teams/${team.teamId}/tasks`, stranger)).status).toBe(404);
    expect((await get(`/api/tasks/${task.taskId}/logs`, stranger)).status).toBe(404);
  });
  test('작업 삭제 → 그 작업의 알림 삭제, 순서 다시 매김', async () => {
    const owner = await loginTestUser(app);
    const member = await loginTestUser(app);
    const team = await teamWith(owner, member);
    const base = `/api/teams/${team.teamId}`;
    const a = await startTask(owner, base, { title: 'A' });
    await startTask(owner, base, { title: 'B' });
    await post(`/api/tasks/${a.taskId}/update`, owner, taskBody(a, { assigneeUserIds: [member.userId] }));
    expect((await get('/api/notifications', member)).body.data.notifications).toHaveLength(1);
    const b = (await get(`${base}/tasks`, owner)).body.data.tasks.find((t) => t.title === 'B');
    expect((await post(`/api/tasks/${b.taskId}/delete`, member)).body.data).toEqual({ isDeleted: true });
    expect((await get(`${base}/tasks`, owner)).body.data.tasks.map((t) => t.sortOrder)).toEqual([0]);
    await post(`/api/tasks/${a.taskId}/delete`, owner);
    expect((await get('/api/notifications', member)).body.data.notifications).toHaveLength(0);
    expect((await post(`/api/tasks/${a.taskId}/delete`, owner)).status).toBe(404);
  });
  test('팀원 목록: 관리자 → 팀원, 합류 순', async () => {
    const owner = await loginTestUser(app);
    const member = await loginTestUser(app);
    const team = await teamWith(owner, member);
    const members = (await get(`/api/teams/${team.teamId}/members`, member)).body.data.members;
    expect(members.map((m) => [m.userId, m.role])).toEqual([[owner.userId, 'owner'], [member.userId, 'member']]);
    expect(members[0]).toEqual({ userId: owner.userId, nickname: '테스트', email: owner.email, role: 'owner', joinDate: expect.any(String) });
  });
});
