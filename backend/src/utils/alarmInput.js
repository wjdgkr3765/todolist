// 알람 입력 검사 (api.md 6.13 "알람 입력", D-178, security.md 4번)
import { invalidInput } from './appError.js';
import { requireBodyObject } from './validation.js';
import { addDays } from './koreaDate.js';

export const ALARM_TITLE_MAX = 30;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_RANGE_DAYS = 365;

function isRealDate(text) {
  if (typeof text !== 'string' || !DATE_PATTERN.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// 이름: 없거나 null 이면 null, 문자열이면 앞뒤 공백을 지우고 0~30자 (빈 값은 null)
function readTitle(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalidInput();
  }
  const title = value.trim();
  if (title.length > ALARM_TITLE_MAX) {
    throw invalidInput();
  }
  return title || null;
}

// 요일: 0~7개, 1(월)~7(일) 정수, 겹침 없음. 작은 순으로 돌려준다
function readWeekdays(value) {
  if (!Array.isArray(value) || value.length > 7
    || value.some((day) => !Number.isSafeInteger(day) || day < 1 || day > 7) || new Set(value).size !== value.length) {
    throw invalidInput();
  }
  return [...value].sort((a, b) => a - b);
}

// today: 한국 시간 오늘 'YYYY-MM-DD'. 날짜는 오늘~오늘+365일
export function readAlarmInput(body, today) {
  requireBodyObject(body);
  const title = readTitle(body.title);
  if (typeof body.time !== 'string' || !TIME_PATTERN.test(body.time)) {
    throw invalidInput();
  }
  const weekdays = readWeekdays(body.weekdays);
  const date = body.date === undefined ? null : body.date;
  if (date !== null && (!isRealDate(date) || date < today || date > addDays(today, DATE_RANGE_DAYS))) {
    throw invalidInput();
  }
  // 날짜와 요일은 둘 중 하나 (D-178)
  if (date !== null && weekdays.length > 0) {
    throw invalidInput();
  }
  // 공휴일에는 끄기는 요일 알람만 (D-178)
  if (typeof body.isHolidayOff !== 'boolean' || (body.isHolidayOff && weekdays.length === 0)) {
    throw invalidInput();
  }
  return { title, time: body.time, date, weekdays, isHolidayOff: body.isHolidayOff };
}

export function readToggleInput(body) {
  requireBodyObject(body);
  if (typeof body.isOn !== 'boolean') {
    throw invalidInput();
  }
  return body.isOn;
}
