// 캘린더·공휴일·히스토리 API (api.md 6.9, 6.10). 공휴일 외부 API 는 가짜 응답으로 대신한다
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { setHolidayFetchOverride } from '../src/utils/holidayApi.js';
import { cleanupTestRows, loginTestUser, runSql, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');

async function insertTask(user, { title, startDate, endDate, status = 'waiting', doneDaysAgo = null, undecided = false }) {
  const result = await runSql(
    `INSERT INTO tasks (title, content, start_date, end_date, status, sort_order, user_id, is_period_undecided, done_date)
     OUTPUT inserted.id VALUES (@title, N'내용', @startDate, @endDate, @status, 0, @userId, @undecided,
       CASE WHEN @status = 'done' THEN DATEADD(HOUR, -24 * @doneDays, SYSUTCDATETIME()) ELSE NULL END)`,
    {
      title: [sql.NVarChar(50), title], startDate: [sql.Date, undecided ? null : startDate], endDate: [sql.Date, undecided ? null : endDate],
      status: [sql.NVarChar(10), status], userId: [sql.BigInt, user.userId], undecided: [sql.Bit, undecided], doneDays: [sql.Int, doneDaysAgo ?? 0],
    },
  );
  return Number(result.recordset[0].id);
}

beforeAll(cleanupTestRows);
afterEach(() => setHolidayFetchOverride(null));
afterAll(async () => {
  await cleanupTestRows();
  await closePool();
});

describe('캘린더 (6.9)', () => {
  test('보이는 기간과 겹치는 작업만, 미정 제외, 히스토리 표시, 시작일 → 긴 기간 순', async () => {
    const user = await loginTestUser(app);
    await insertTask(user, { title: '짧은', startDate: '2026-11-03', endDate: '2026-11-04' });
    await insertTask(user, { title: '긴', startDate: '2026-11-03', endDate: '2026-11-10', status: 'progress' });
    await insertTask(user, { title: '앞에서 걸침', startDate: '2026-10-25', endDate: '2026-11-01' });
    await insertTask(user, { title: '밖', startDate: '2026-12-10', endDate: '2026-12-11' });
    await insertTask(user, { title: '미정', undecided: true });
    await insertTask(user, { title: '히스토리', startDate: '2026-11-05', endDate: '2026-11-05', status: 'done', doneDaysAgo: 8 });
    const tasks = (await get('/api/personal/calendar?from=2026-11-01&to=2026-12-05', user)).body.data.tasks;
    expect(tasks.map((t) => t.title)).toEqual(['앞에서 걸침', '긴', '짧은', '히스토리']);
    expect(tasks.find((t) => t.title === '히스토리')).toMatchObject({ isHistory: true, status: 'done', startDate: '2026-11-05', assignees: [] });
    expect(tasks[0]).not.toHaveProperty('isPeriodUndecided');
  });
  test.each([
    ['from=2026-11-01'], ['from=2026-11-31&to=2026-12-01'], ['from=2026-11-10&to=2026-11-09'], ['from=2026-11-01&to=2027-01-03'],
  ])('기간 오류 %s → 400', async (query) => {
    const user = await loginTestUser(app);
    expect((await get(`/api/personal/calendar?${query}`, user)).status).toBe(400);
  });
  test('경계: 62일은 되고 63일은 400', async () => {
    const user = await loginTestUser(app);
    expect((await get('/api/personal/calendar?from=2026-11-01&to=2027-01-02', user)).status).toBe(200);
    expect((await get('/api/personal/calendar?from=2026-11-01&to=2027-01-03', user)).status).toBe(400);
  });
  test('로그인 필요, 남의 팀 404', async () => {
    const owner = await loginTestUser(app);
    const stranger = await loginTestUser(app);
    const team = (await request(app).post('/api/teams').set('Cookie', owner.cookie).send({ name: 'vt캘린더팀' })).body.data;
    expect((await get('/api/personal/calendar?from=2026-11-01&to=2026-11-30')).status).toBe(401);
    expect((await get(`/api/teams/${team.teamId}/calendar?from=2026-11-01&to=2026-11-30`, stranger)).status).toBe(404);
    expect((await get(`/api/teams/${team.teamId}/calendar?from=2026-11-01&to=2026-11-30`, owner)).body.data.tasks).toEqual([]);
  });
});

describe('공휴일', () => {
  const holidayResponse = (items) => ({ ok: true, json: async () => ({ response: { header: { resultCode: '00' }, body: { items } } }) });
  test('특일 정보 응답 → 날짜 순 공휴일, 하루 응답(객체)도 처리, 24시간 캐시', async () => {
    const user = await loginTestUser(app);
    let calls = 0;
    setHolidayFetchOverride(async () => {
      calls += 1;
      return holidayResponse({ item: [
        { dateName: '성탄절', isHoliday: 'Y', locdate: 20261225 }, { dateName: '1월1일', isHoliday: 'Y', locdate: 20260101 },
        { dateName: '기념일', isHoliday: 'N', locdate: 20260505 },
      ] });
    });
    const first = (await get('/api/holidays?year=2026', user)).body.data;
    expect(first).toEqual({ holidays: [{ date: '2026-01-01', name: '1월1일' }, { date: '2026-12-25', name: '성탄절' }], isAvailable: true });
    await get('/api/holidays?year=2026', user);
    expect(calls).toBe(1);
    setHolidayFetchOverride(async () => holidayResponse({ item: { dateName: '설날', isHoliday: 'Y', locdate: 20270207 } }));
    expect((await get('/api/holidays?year=2027', user)).body.data.holidays).toEqual([{ date: '2027-02-07', name: '설날' }]);
  });
  test('외부 API 실패 → 빈 배열 + isAvailable false (오류 응답 아님), 실패는 캐시하지 않는다', async () => {
    const user = await loginTestUser(app);
    let calls = 0;
    setHolidayFetchOverride(async () => { calls += 1; throw new Error('timeout'); });
    const res = await get('/api/holidays?year=2026', user);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ holidays: [], isAvailable: false });
    await get('/api/holidays?year=2026', user);
    expect(calls).toBe(2);
  });
  test.each([['1999'], ['2101'], ['20a6'], ['']])('year=%s → 400, 경계 2000·2100 은 된다', async (year) => {
    const user = await loginTestUser(app);
    setHolidayFetchOverride(async () => holidayResponse({ item: [] }));
    expect((await get(`/api/holidays?year=${year}`, user)).status).toBe(400);
    expect((await get('/api/holidays?year=2000', user)).status).toBe(200);
    expect((await get('/api/holidays?year=2100', user)).status).toBe(200);
  });
});

describe('히스토리 (6.10)', () => {
  test('경계: 완료 7일 지난 작업만, 최근 완료가 위, 한 페이지 20개', async () => {
    const user = await loginTestUser(app);
    await insertTask(user, { title: '6일', startDate: '2026-11-01', endDate: '2026-11-01', status: 'done', doneDaysAgo: 6 });
    for (let i = 0; i < 21; i += 1) {
      await insertTask(user, { title: `h${i}`, startDate: '2026-11-01', endDate: '2026-11-01', status: 'done', doneDaysAgo: 7 + i });
    }
    const page1 = (await get('/api/personal/history?page=1', user)).body.data;
    expect(page1).toMatchObject({ totalCount: 21, page: 1, pageSize: 20 });
    expect(page1.tasks).toHaveLength(20);
    expect(page1.tasks[0].title).toBe('h0');
    expect(page1.tasks[0]).toMatchObject({ isPeriodUndecided: false, assignees: [], doneDate: expect.any(String) });
    const page2 = (await get('/api/personal/history?page=2', user)).body.data;
    expect(page2.tasks.map((t) => t.title)).toEqual(['h20']);
    expect((await get('/api/personal/history?page=3', user)).body.data.tasks).toEqual([]);
  });
  test.each([['0'], ['-1'], ['a'], ['1.5'], ['']])('page=%s → 400', async (page) => {
    const user = await loginTestUser(app);
    expect((await get(`/api/personal/history?page=${page}`, user)).status).toBe(400);
  });
});
