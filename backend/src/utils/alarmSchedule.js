// 알람 울릴 시각 계산 (api.md 6.13 "다음 울릴 시각 계산", D-178). 날짜·시각은 한국 시간, 돌려주는 Date 는 그 순간
import { addDays, koreaToday } from './koreaDate.js';

const SEARCH_DAYS = 400;

// 한국 시간 'YYYY-MM-DD' + 'HH:mm' → 그 순간의 Date
export function koreaDateTime(date, time) {
  return new Date(`${date}T${time}:00+09:00`);
}

// 'YYYY-MM-DD' 의 요일 1(월)~7(일)
export function weekdayOf(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// 요일 배열 ↔ DB 비트 (월 1, 화 2, 수 4, 목 8, 금 16, 토 32, 일 64)
export function weekdaysToBits(weekdays) {
  return weekdays.reduce((bits, day) => bits | (1 << (day - 1)), 0);
}
export function bitsToWeekdays(bits) {
  return [1, 2, 3, 4, 5, 6, 7].filter((day) => (bits & (1 << (day - 1))) !== 0);
}

// 날짜·요일을 고르지 않았을 때: time 이 지금보다 뒤면 오늘, 아니면 내일 (D-178)
export function autoDate(time, now) {
  const today = koreaToday(now);
  return koreaDateTime(today, time) > now ? today : addDays(today, 1);
}

// 그 요일 알람이 울리는 날인지. 공휴일에는 끄기면 공휴일인 날은 아니다
function isRepeatDay(alarm, date, holidays, isHolidaySkipped) {
  return alarm.weekdays.includes(weekdayOf(date)) && !(isHolidaySkipped && alarm.isHolidayOff && holidays.has(date));
}

// 요일 알람의 다음 울릴 시각 (지금보다 뒤). 400일 안에 없으면 공휴일을 보지 않고 다시 찾는다
// alarm: { time, weekdays, isHolidayOff }, holidays: 'YYYY-MM-DD' Set
export function nextRepeatFire(alarm, now, holidays) {
  const today = koreaToday(now);
  const find = (isHolidaySkipped) => {
    for (let day = 0; day < SEARCH_DAYS; day += 1) {
      const date = addDays(today, day);
      const at = koreaDateTime(date, alarm.time);
      if (at > now && isRepeatDay(alarm, date, holidays, isHolidaySkipped)) {
        return at;
      }
    }
    return null;
  };
  return find(true) ?? find(false);
}

// 요일 알람이 지금까지 마지막으로 울렸어야 할 시각 (지금 이하, from 이후). 놓친 알람은 가장 최근 1번만 (D-179)
export function lastRepeatFire(alarm, now, from, holidays) {
  const today = koreaToday(now);
  for (let day = 0; day < SEARCH_DAYS; day += 1) {
    const date = addDays(today, -day);
    const at = koreaDateTime(date, alarm.time);
    if (at < from) {
      return null;
    }
    if (at <= now && isRepeatDay(alarm, date, holidays, true)) {
      return at;
    }
  }
  return null;
}
