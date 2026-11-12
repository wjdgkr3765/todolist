// 할일·작업 요청 형식 검사 (api.md 6.4 할일 요청 형식, D-010, D-058, D-135, D-136)
import { invalidInput } from './appError.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// 실제 있는 날짜인지 (2026-02-30 같은 값 거부)
export function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// HH:mm, 00:00~23:55, 분은 5의 배수
export function isFiveMinuteTime(value) {
  const match = typeof value === 'string' ? TIME_PATTERN.exec(value) : null;
  return Boolean(match) && Number(match[2]) % 5 === 0;
}

function readText(value, max) {
  if (typeof value !== 'string') {
    throw invalidInput();
  }
  const text = value.trim();
  if (text.length < 1 || text.length > max) {
    throw invalidInput();
  }
  return text;
}

// 틀리면 400 INVALID_INPUT. 맞으면 저장할 값
export function readTodoInput(body) {
  const title = readText(body.title, 50);
  const content = readText(body.content, 2000);
  const { isPeriodUndecided, startDate, endDate, startTime, endTime } = body;
  if (typeof isPeriodUndecided !== 'boolean') {
    throw invalidInput();
  }
  if (isPeriodUndecided) {
    if (startDate !== null || endDate !== null || startTime !== null || endTime !== null) {
      throw invalidInput();
    }
    return { title, content, isPeriodUndecided, startDate: null, endDate: null, startTime: null, endTime: null };
  }
  if (!isRealDate(startDate) || !isRealDate(endDate) || endDate < startDate) {
    throw invalidInput();
  }
  const hasTime = startTime !== null || endTime !== null;
  if (hasTime) {
    if (!isFiveMinuteTime(startTime) || !isFiveMinuteTime(endTime)) {
      throw invalidInput();
    }
    if (startDate === endDate && endTime < startTime) {
      throw invalidInput();
    }
  }
  return {
    title, content, isPeriodUndecided, startDate, endDate,
    startTime: hasTime ? startTime : null, endTime: hasTime ? endTime : null,
  };
}
