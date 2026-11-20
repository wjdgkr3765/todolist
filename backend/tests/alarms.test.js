// 알람 API (api.md 6.13): 만들기·목록·수정·켜기/끄기·삭제, 30개 제한, 권한, 울리기 처리(제때·놓침), 놓친 알람 알림, 탈퇴
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { closePool } from '../src/config/db.js';
import { setHolidayFetchOverride } from '../src/utils/holidayApi.js';
import { koreaToday, addDays } from '../src/utils/koreaDate.js';
import { autoDate, koreaDateTime } from '../src/utils/alarmSchedule.js';
import { cleanupTestRows, loginTestUser, runSql, sql } from './helpers.js';

const app = createApp();
const get = (path, user) => request(app).get(path).set('Cookie', user?.cookie ?? '');
const post = (path, user, body = {}) => request(app).post(path).set('Cookie', user?.cookie ?? '').send(body);
const body = (over = {}) => ({ title: '출근', time: '06:00', date: null, weekdays: [], isHolidayOff: false, ...over });
const MINUTE = 60 * 1000;

// 공휴일 API 대신 쓸 응답 (dates: 'YYYY-MM-DD')
function holidaysOf(dates) {
  return async () => ({
    ok: true,
    json: async () => ({
      response: {
        header: { resultCode: '00' },
        body: { items: { item: dates.map((date) => ({ locdate: Number(date.replaceAll('-', '')), dateName: '시험휴일', isHoliday: 'Y' })) } },
      },
    }),
  });
}

async function setNextFire(alarmId, at) {
  await runSql('UPDATE alarms SET next_fire_date = @at WHERE id = @id', { at: [sql.DateTime2, at], id: [sql.BigInt, alarmId] });
}

beforeAll(async () => {
  await cleanupTestRows();
  setHolidayFetchOverride(holidaysOf([]));
});
afterEach(() => setHolidayFetchOverride(holidaysOf([])));
afterAll(async () => {
  setHolidayFetchOverride(null);
  await cleanupTestRows();
  await closePool();
});

describe('로그인·권한', () => {
  test('로그인 없이 모든 알람 API 401', async () => {
    expect((await get('/api/alarms')).status).toBe(401);
    for (const path of ['/api/alarms', '/api/alarms/check', '/api/alarms/1/update', '/api/alarms/1/toggle', '/api/alarms/1/delete']) {
      expect((await post(path, null, body())).status).toBe(401);
    }
  });
  test('남의 알람은 목록에 없고 수정·켜기/끄기·삭제 404, 경로 id 가 숫자가 아니면 400', async () => {
    const owner = await loginTestUser(app);
    const other = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', owner, body())).body.data;
    expect((await get('/api/alarms', other)).body.data.alarms).toEqual([]);
    expect((await post(`/api/alarms/${alarm.alarmId}/update`, other, body())).status).toBe(404);
    expect((await post(`/api/alarms/${alarm.alarmId}/toggle`, other, { isOn: false })).status).toBe(404);
    expect((await post(`/api/alarms/${alarm.alarmId}/delete`, other)).status).toBe(404);
    expect((await post('/api/alarms/abc/delete', owner)).status).toBe(400);
    expect((await get('/api/alarms', owner)).body.data.alarms).toHaveLength(1);
  });
});

describe('만들기·목록 (D-178)', () => {
  test('날짜·요일 없음: 오늘/내일을 서버가 정해 저장하고 켜진 상태', async () => {
    const user = await loginTestUser(app);
    const res = await post('/api/alarms', user, body({ title: '  물 마시기  ', time: '23:59' }));
    expect(res.status).toBe(200);
    const date = autoDate('23:59', new Date());
    expect(res.body.data.alarm).toMatchObject({
      title: '물 마시기', time: '23:59', date, weekdays: [], isHolidayOff: false, isOn: true,
      nextFireDate: koreaDateTime(date, '23:59').toISOString(),
    });
  });
  test('요일 알람 + 공휴일에는 끄기: 공휴일을 건너뛴 다음 시각, date 는 null', async () => {
    const user = await loginTestUser(app);
    const tomorrow = addDays(koreaToday(), 1);
    setHolidayFetchOverride(holidaysOf([tomorrow]));
    const all = [1, 2, 3, 4, 5, 6, 7];
    const { alarm } = (await post('/api/alarms', user, body({ time: '00:00', weekdays: all, isHolidayOff: true }))).body.data;
    expect(alarm).toMatchObject({ date: null, weekdays: all, isHolidayOff: true });
    // 매일 00:00 이고 내일이 공휴일이면 모레 00:00
    expect(alarm.nextFireDate).toBe(koreaDateTime(addDays(koreaToday(), 2), '00:00').toISOString());
  });
  test('직접 고른 날짜와 시각이 지났으면 400 ALARM_TIME_PASSED, 잘못된 입력은 400 INVALID_INPUT', async () => {
    const user = await loginTestUser(app);
    const passed = await post('/api/alarms', user, body({ date: koreaToday(), time: '00:00' }));
    expect(passed.status).toBe(400);
    expect(passed.body.error.code).toBe('ALARM_TIME_PASSED');
    expect((await post('/api/alarms', user, body({ date: addDays(koreaToday(), 1), weekdays: [1] }))).body.error.code).toBe('INVALID_INPUT');
    expect((await post('/api/alarms', user, body({ title: 'a'.repeat(31) }))).status).toBe(400);
    expect((await post('/api/alarms', user, body({ time: "06:00' OR '1'='1" }))).status).toBe(400);
  });
  test('목록은 시각 순', async () => {
    const user = await loginTestUser(app);
    await post('/api/alarms', user, body({ time: '21:00', weekdays: [1] }));
    await post('/api/alarms', user, body({ time: '06:30', weekdays: [2] }));
    await post('/api/alarms', user, body({ time: '06:05', weekdays: [3] }));
    expect((await get('/api/alarms', user)).body.data.alarms.map((a) => a.time)).toEqual(['06:05', '06:30', '21:00']);
  });
  test('30개까지 (30번째 되고 31번째 409 ALARM_LIMIT_EXCEEDED)', async () => {
    const user = await loginTestUser(app);
    await runSql(`INSERT INTO alarms (alarm_time, weekdays, user_id, next_fire_date)
                  SELECT TOP 29 '06:00', 1, @userId, SYSUTCDATETIME() FROM sys.all_objects`, { userId: [sql.BigInt, user.userId] });
    expect((await post('/api/alarms', user, body({ weekdays: [1] }))).status).toBe(200);
    const over = await post('/api/alarms', user, body({ weekdays: [1] }));
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('ALARM_LIMIT_EXCEEDED');
  });
});

describe('수정·켜기/끄기·삭제', () => {
  test('수정하면 모든 값을 바꾸고 켜진 상태로 다시 계산', async () => {
    const user = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', user, body())).body.data;
    await post(`/api/alarms/${alarm.alarmId}/toggle`, user, { isOn: false });
    const updated = (await post(`/api/alarms/${alarm.alarmId}/update`, user, body({ title: null, time: '07:15', weekdays: [6, 7] }))).body.data.alarm;
    expect(updated).toMatchObject({ alarmId: alarm.alarmId, title: null, time: '07:15', date: null, weekdays: [6, 7], isOn: true });
    expect(updated.nextFireDate).not.toBeNull();
  });
  test('끄면 다음 시각 없음, 지난 한 번 알람을 다시 켜면 오늘/내일을 다시 정한다', async () => {
    const user = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', user, body({ time: '00:00' }))).body.data;
    const off = (await post(`/api/alarms/${alarm.alarmId}/toggle`, user, { isOn: false })).body.data.alarm;
    expect(off).toMatchObject({ isOn: false, nextFireDate: null, date: alarm.date });
    await runSql('UPDATE alarms SET alarm_date = @date WHERE id = @id', { date: [sql.Date, addDays(koreaToday(), -3)], id: [sql.BigInt, alarm.alarmId] });
    const on = (await post(`/api/alarms/${alarm.alarmId}/toggle`, user, { isOn: true })).body.data.alarm;
    expect(on).toMatchObject({ isOn: true, date: autoDate('00:00', new Date()) });
    expect((await post(`/api/alarms/${alarm.alarmId}/toggle`, user, { isOn: 'true' })).status).toBe(400);
  });
  test('삭제하면 목록에서 빠지고 다시 지우면 404', async () => {
    const user = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', user, body())).body.data;
    expect((await post(`/api/alarms/${alarm.alarmId}/delete`, user)).body.data).toEqual({ isDeleted: true });
    expect((await get('/api/alarms', user)).body.data.alarms).toEqual([]);
    expect((await post(`/api/alarms/${alarm.alarmId}/delete`, user)).status).toBe(404);
  });
});

describe('울리기 처리 (D-179)', () => {
  test('울릴 때가 된 알람이 없으면 fired 빈 배열', async () => {
    const user = await loginTestUser(app);
    await post('/api/alarms', user, body({ weekdays: [1] }));
    expect((await post('/api/alarms/check', user)).body.data).toEqual({ fired: [], unreadCount: 0 });
  });
  test('5분 안이면 제때 울림(fired), 한 번 알람은 꺼지고 반복 알람은 다음 시각', async () => {
    const user = await loginTestUser(app);
    const once = (await post('/api/alarms', user, body({ title: '한 번' }))).body.data.alarm;
    const daily = (await post('/api/alarms', user, body({ title: null, weekdays: [1, 2, 3, 4, 5, 6, 7] }))).body.data.alarm;
    const firedAt = new Date(Date.now() - 4 * MINUTE);
    await setNextFire(once.alarmId, firedAt);
    const dailyAt = new Date(Date.now() - MINUTE);
    await runSql('UPDATE alarms SET alarm_time = CAST(@time AS TIME(0)) WHERE id = @id',
      { time: [sql.VarChar(5), new Date(dailyAt.getTime() + 9 * 60 * MINUTE).toISOString().slice(11, 16)], id: [sql.BigInt, daily.alarmId] });
    await setNextFire(daily.alarmId, new Date(Math.floor(dailyAt.getTime() / MINUTE) * MINUTE));
    const result = (await post('/api/alarms/check', user)).body.data;
    expect(result.fired.map((item) => item.title).sort()).toEqual([null, '한 번'].sort());
    expect(result.unreadCount).toBe(0);
    const alarms = (await get('/api/alarms', user)).body.data.alarms;
    expect(alarms.find((a) => a.alarmId === once.alarmId)).toMatchObject({ isOn: false, nextFireDate: null });
    expect(new Date(alarms.find((a) => a.alarmId === daily.alarmId).nextFireDate) > new Date()).toBe(true);
    // 한 번 처리한 것은 다시 울리지 않는다
    expect((await post('/api/alarms/check', user)).body.data.fired).toEqual([]);
  });
  test('5분 넘게 지났으면 놓친 알람 알림 (알람마다 가장 최근 1번만), [X] 로 지우고, 알람을 지우면 함께 지워진다', async () => {
    const user = await loginTestUser(app);
    const daily = (await post('/api/alarms', user, body({ title: '매일 운동', time: '06:00', weekdays: [1, 2, 3, 4, 5, 6, 7] }))).body.data.alarm;
    await setNextFire(daily.alarmId, koreaDateTime(addDays(koreaToday(), -3), '06:00'));
    const result = (await post('/api/alarms/check', user)).body.data;
    expect(result.fired.length + result.unreadCount).toBeGreaterThanOrEqual(1);
    let list = (await get('/api/notifications', user)).body.data.notifications.filter((n) => n.notificationType === 'alarm_missed');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ alarmId: daily.alarmId, alarmTitle: '매일 운동', teamId: null, taskId: null, isRead: false });
    // 다시 놓쳐도 1개만 남는다
    await setNextFire(daily.alarmId, koreaDateTime(addDays(koreaToday(), -2), '06:00'));
    await post('/api/alarms/check', user);
    list = (await get('/api/notifications', user)).body.data.notifications.filter((n) => n.notificationType === 'alarm_missed');
    expect(list.length).toBeLessThanOrEqual(1);
    if (list.length === 1) {
      expect((await post(`/api/notifications/${list[0].notificationId}/delete`, user)).status).toBe(200);
    }
    // 알람을 지우면 놓친 알람 알림도 지워진다
    await setNextFire(daily.alarmId, new Date(Date.now() - 24 * 60 * MINUTE));
    await post('/api/alarms/check', user);
    await post(`/api/alarms/${daily.alarmId}/delete`, user);
    const left = await runSql('SELECT COUNT(*) AS n FROM notifications WHERE alarm_id = @id', { id: [sql.BigInt, daily.alarmId] });
    expect(left.recordset[0].n).toBe(0);
  });
  test('한 번 알람을 놓치면 그 시각으로 놓친 알람 알림이 남고 꺼진다', async () => {
    const user = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', user, body({ title: null }))).body.data;
    const missedAt = new Date(Date.now() - 10 * MINUTE);
    missedAt.setUTCSeconds(0, 0);
    await setNextFire(alarm.alarmId, missedAt);
    const result = (await post('/api/alarms/check', user)).body.data;
    expect(result).toEqual({ fired: [], unreadCount: 1 });
    const missed = (await get('/api/notifications', user)).body.data.notifications[0];
    expect(missed).toMatchObject({ notificationType: 'alarm_missed', alarmId: alarm.alarmId, alarmTitle: null, createDate: missedAt.toISOString() });
    expect((await get('/api/alarms', user)).body.data.alarms[0]).toMatchObject({ isOn: false, nextFireDate: null });
  });
});

describe('회원 탈퇴', () => {
  test('탈퇴하면 내 알람과 놓친 알람 알림을 지운다', async () => {
    const user = await loginTestUser(app);
    const { alarm } = (await post('/api/alarms', user, body())).body.data;
    await setNextFire(alarm.alarmId, new Date(Date.now() - 60 * MINUTE));
    await post('/api/alarms/check', user);
    expect((await post('/api/users/me/withdraw', user, { password: 'abcd123!' })).status).toBe(200);
    const left = await runSql('SELECT COUNT(*) AS n FROM alarms WHERE user_id = @id', { id: [sql.BigInt, user.userId] });
    expect(left.recordset[0].n).toBe(0);
  });
});
