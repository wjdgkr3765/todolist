// 알람 목록·만들기·수정·켜기/끄기·삭제·울리기 처리 (api.md 6.13, D-177~D-180)
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError, notFound } from '../utils/appError.js';
import { addDays, koreaToday, toDateText, toTimeText } from '../utils/koreaDate.js';
import { getHolidays } from '../utils/holidayApi.js';
import { readAlarmInput, readToggleInput } from '../utils/alarmInput.js';
import {
  autoDate, bitsToWeekdays, koreaDateTime, lastRepeatFire, nextRepeatFire, weekdaysToBits,
} from '../utils/alarmSchedule.js';
import { emitToUser } from '../realtime/index.js';
import { countUnread, notifyUnreadChanged } from './notificationService.js';

export const ALARM_LIMIT = 30;
// 알람 시각에서 이 시간 안에 확인하면 제때 울림, 넘으면 놓친 알람 (D-179)
export const ON_TIME_MS = 5 * 60 * 1000;

const limitError = () => new AppError(409, 'ALARM_LIMIT_EXCEEDED', '알람은 30개까지 만들 수 있습니다.');
const passedError = () => new AppError(400, 'ALARM_TIME_PASSED', '이미 지난 시각입니다. 시간이나 날짜를 바꿔 주세요.');

const ALARM_COLUMNS = 'id, title, alarm_time, alarm_date, weekdays, is_on, is_holiday_off, next_fire_date';

function toAlarm(row) {
  return {
    alarmId: Number(row.id),
    title: row.title,
    time: toTimeText(row.alarm_time),
    date: row.weekdays > 0 ? null : toDateText(row.alarm_date),
    weekdays: bitsToWeekdays(row.weekdays),
    isHolidayOff: Boolean(row.is_holiday_off),
    isOn: Boolean(row.is_on),
    nextFireDate: row.next_fire_date ? row.next_fire_date.toISOString() : null,
  };
}

// 계산에 쓰는 모양 { time, weekdays, isHolidayOff }
const scheduleShape = (row) => ({ time: toTimeText(row.alarm_time), weekdays: bitsToWeekdays(row.weekdays), isHolidayOff: Boolean(row.is_holiday_off) });

// 지금부터 400일 안의 공휴일 (공휴일 API 를 가져오지 못한 해는 공휴일이 없는 것으로 본다, D-178)
async function holidaySet(now) {
  const firstYear = Number(koreaToday(now).slice(0, 4));
  const lastYear = Number(addDays(koreaToday(now), 400).slice(0, 4));
  const dates = new Set();
  for (let year = firstYear - 1; year <= lastYear; year += 1) {
    (await getHolidays(year)).holidays.forEach((holiday) => dates.add(holiday.date));
  }
  return dates;
}

// 입력으로 저장할 날짜와 다음 울릴 시각 (만들기·수정)
async function scheduleOf(input, now) {
  if (input.weekdays.length > 0) {
    const holidays = input.isHolidayOff ? await holidaySet(now) : new Set();
    return { date: null, nextFire: nextRepeatFire(input, now, holidays) };
  }
  if (input.date) {
    const at = koreaDateTime(input.date, input.time);
    if (at <= now) {
      throw passedError();
    }
    return { date: input.date, nextFire: at };
  }
  const date = autoDate(input.time, now);
  return { date, nextFire: koreaDateTime(date, input.time) };
}

function alarmChanged(userId, action) {
  emitToUser(userId, 'alarms:changed', { action });
}

function bindAlarm(request, input, schedule) {
  return request
    .input('title', sql.NVarChar(30), input.title)
    .input('time', sql.VarChar(5), input.time)
    .input('date', sql.Date, schedule.date)
    .input('weekdays', sql.TinyInt, weekdaysToBits(input.weekdays))
    .input('isHolidayOff', sql.Bit, input.isHolidayOff)
    .input('nextFire', sql.DateTime2, schedule.nextFire);
}

export async function listAlarms(userId) {
  const pool = await getPool();
  const result = await pool.request().input('userId', sql.BigInt, userId)
    .query(`SELECT ${ALARM_COLUMNS} FROM alarms WHERE user_id = @userId ORDER BY alarm_time, id`);
  return { alarms: result.recordset.map(toAlarm) };
}

export async function createAlarm(userId, body) {
  const now = new Date();
  const input = readAlarmInput(body, koreaToday(now));
  const schedule = await scheduleOf(input, now);
  const alarm = await withTransaction(async (transaction) => {
    // 내 users 행을 잠그고 개수를 센다 (D-180)
    const count = await new sql.Request(transaction).input('userId', sql.BigInt, userId)
      .query(`SELECT id FROM users WITH (UPDLOCK, HOLDLOCK) WHERE id = @userId;
              SELECT COUNT(*) AS n FROM alarms WHERE user_id = @userId;`);
    if (count.recordsets[1][0].n >= ALARM_LIMIT) {
      throw limitError();
    }
    const inserted = await bindAlarm(new sql.Request(transaction), input, schedule).input('userId', sql.BigInt, userId)
      .query(`INSERT INTO alarms (title, alarm_time, alarm_date, weekdays, user_id, is_on, is_holiday_off, next_fire_date)
              OUTPUT inserted.id, inserted.title, inserted.alarm_time, inserted.alarm_date, inserted.weekdays,
                     inserted.is_on, inserted.is_holiday_off, inserted.next_fire_date
              VALUES (@title, CAST(@time AS TIME(0)), @date, @weekdays, @userId, 1, @isHolidayOff, @nextFire)`);
    return toAlarm(inserted.recordset[0]);
  });
  alarmChanged(userId, 'create');
  return { alarm };
}

export async function updateAlarm(userId, alarmId, body) {
  const now = new Date();
  const input = readAlarmInput(body, koreaToday(now));
  const schedule = await scheduleOf(input, now);
  const pool = await getPool();
  const updated = await bindAlarm(pool.request(), input, schedule)
    .input('id', sql.BigInt, alarmId).input('userId', sql.BigInt, userId)
    .query(`UPDATE alarms SET title = @title, alarm_time = CAST(@time AS TIME(0)), alarm_date = @date, weekdays = @weekdays,
                   is_on = 1, is_holiday_off = @isHolidayOff, next_fire_date = @nextFire
            OUTPUT inserted.id, inserted.title, inserted.alarm_time, inserted.alarm_date, inserted.weekdays,
                   inserted.is_on, inserted.is_holiday_off, inserted.next_fire_date
            WHERE id = @id AND user_id = @userId`);
  if (!updated.recordset[0]) {
    throw notFound();
  }
  alarmChanged(userId, 'update');
  return { alarm: toAlarm(updated.recordset[0]) };
}

async function findMyAlarm(pool, userId, alarmId) {
  const result = await pool.request().input('id', sql.BigInt, alarmId).input('userId', sql.BigInt, userId)
    .query(`SELECT ${ALARM_COLUMNS} FROM alarms WHERE id = @id AND user_id = @userId`);
  if (!result.recordset[0]) {
    throw notFound();
  }
  return result.recordset[0];
}

// 켜면 다음 울릴 시각을 다시 계산한다. 한 번 알람의 날짜·시각이 지났으면 오늘/내일을 다시 정한다 (D-178)
export async function toggleAlarm(userId, alarmId, body) {
  const isOn = readToggleInput(body);
  const now = new Date();
  const pool = await getPool();
  const row = await findMyAlarm(pool, userId, alarmId);
  let date = row.weekdays > 0 ? null : toDateText(row.alarm_date);
  let nextFire = null;
  if (isOn) {
    const shape = scheduleShape(row);
    if (row.weekdays > 0) {
      nextFire = nextRepeatFire(shape, now, shape.isHolidayOff ? await holidaySet(now) : new Set());
    } else {
      if (koreaDateTime(date, shape.time) <= now) {
        date = autoDate(shape.time, now);
      }
      nextFire = koreaDateTime(date, shape.time);
    }
  }
  const updated = await pool.request()
    .input('id', sql.BigInt, alarmId).input('userId', sql.BigInt, userId)
    .input('isOn', sql.Bit, isOn).input('date', sql.Date, date).input('nextFire', sql.DateTime2, nextFire)
    .query(`UPDATE alarms SET is_on = @isOn, alarm_date = @date, next_fire_date = @nextFire
            OUTPUT inserted.id, inserted.title, inserted.alarm_time, inserted.alarm_date, inserted.weekdays,
                   inserted.is_on, inserted.is_holiday_off, inserted.next_fire_date
            WHERE id = @id AND user_id = @userId`);
  if (!updated.recordset[0]) {
    throw notFound();
  }
  alarmChanged(userId, 'toggle');
  return { alarm: toAlarm(updated.recordset[0]) };
}

// 놓친 알람 알림도 함께 지워진다 (ON DELETE CASCADE)
export async function deleteAlarm(userId, alarmId) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.BigInt, alarmId).input('userId', sql.BigInt, userId)
    .query('DELETE FROM alarms WHERE id = @id AND user_id = @userId');
  if (result.rowsAffected[0] === 0) {
    throw notFound();
  }
  alarmChanged(userId, 'delete');
  await notifyUnreadChanged(userId);
  return { isDeleted: true };
}

// 울릴 때가 된 내 알람 처리 (api.md 6.13 "울리기 처리", D-179). 예약 작업 없이 화면이 부를 때 한다
export async function checkAlarms(userId) {
  const now = new Date();
  const pool = await getPool();
  const due = await pool.request().input('userId', sql.BigInt, userId).input('now', sql.DateTime2, now)
    .query(`SELECT COUNT(*) AS n, MAX(CAST(is_holiday_off AS INT)) AS holiday_off FROM alarms
            WHERE user_id = @userId AND is_on = 1 AND next_fire_date <= @now`);
  if (due.recordset[0].n === 0) {
    return { fired: [], unreadCount: await countUnread(userId) };
  }
  // 공휴일 정보는 트랜잭션 밖에서 가져온다 (외부 API)
  const holidays = due.recordset[0].holiday_off ? await holidaySet(now) : new Set();
  const { fired, missedCount } = await withTransaction(async (transaction) => {
    const rows = await new sql.Request(transaction).input('userId', sql.BigInt, userId).input('now', sql.DateTime2, now)
      .query(`SELECT ${ALARM_COLUMNS} FROM alarms WITH (UPDLOCK, HOLDLOCK)
              WHERE user_id = @userId AND is_on = 1 AND next_fire_date <= @now ORDER BY next_fire_date, id`);
    const firedList = [];
    let missed = 0;
    for (const row of rows.recordset) {
      const shape = scheduleShape(row);
      const latest = row.weekdays > 0 ? (lastRepeatFire(shape, now, row.next_fire_date, holidays) ?? row.next_fire_date) : row.next_fire_date;
      if (now - latest <= ON_TIME_MS) {
        firedList.push({ alarmId: Number(row.id), title: row.title, fireDate: latest.toISOString() });
      } else {
        // 놓친 알람은 알람마다 가장 최근 1번만 (D-179)
        await new sql.Request(transaction)
          .input('userId', sql.BigInt, userId).input('alarmId', sql.BigInt, row.id).input('missedAt', sql.DateTime2, latest)
          .query(`DELETE FROM notifications WHERE user_id = @userId AND alarm_id = @alarmId AND notification_type = 'alarm_missed';
                  INSERT INTO notifications (notification_type, user_id, alarm_id, create_date)
                  VALUES ('alarm_missed', @userId, @alarmId, @missedAt);`);
        missed += 1;
      }
      // 반복 알람은 다음 시각으로, 한 번 알람은 끈다 (D-178)
      const next = row.weekdays > 0 ? nextRepeatFire(shape, now, holidays) : null;
      await new sql.Request(transaction).input('id', sql.BigInt, row.id).input('next', sql.DateTime2, next)
        .query(`UPDATE alarms SET next_fire_date = @next, is_on = CASE WHEN @next IS NULL THEN 0 ELSE 1 END WHERE id = @id`);
    }
    return { fired: firedList, missedCount: missed };
  });
  alarmChanged(userId, 'check');
  if (missedCount > 0) {
    await notifyUnreadChanged(userId);
  }
  return { fired, unreadCount: await countUnread(userId) };
}
