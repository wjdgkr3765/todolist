// 알람 표시·입력 규칙 (MainLayout_screen.md 알람, D-178, D-181). 시각은 24시간제 HH:mm, 날짜는 한국 시간
import { addDaysText, koreaToday } from './format.js';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
// 화면 순서 일~토 (값은 1(월)~7(일))
export const WEEK_ORDER = [7, 1, 2, 3, 4, 5, 6];
export const ALARM_LIMIT = 30;
export const ALARM_TITLE_MAX = 30;

export const dayName = (weekday) => DAY_NAMES[weekday % 7];

// 'YYYY-MM-DD' → 'MM.DD (요일)'
export function dayLabel(dateText) {
  const day = new Date(`${dateText}T00:00:00Z`).getUTCDay();
  return `${dateText.slice(5, 7)}.${dateText.slice(8, 10)} (${DAY_NAMES[day]})`;
}

// 반복 요약: 한 번 "11.20 (금)" / 7개 "매일" / 일부 "매주 월, 수" (일 → 토 순)
export function repeatSummary(weekdays, date) {
  if (weekdays.length === 0) {
    return date ? dayLabel(date) : '';
  }
  if (weekdays.length === 7) {
    return '매일';
  }
  return `매주 ${WEEK_ORDER.filter((day) => weekdays.includes(day)).map(dayName).join(', ')}`;
}

// 한국 시간 지금 'HH:mm'
export function koreaNowTime(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

// 날짜·요일을 고르지 않았을 때: 고른 시각이 지금보다 뒤면 오늘, 아니면 내일 (D-178)
export function autoDate(time, now = new Date()) {
  const today = koreaToday(now);
  return time > koreaNowTime(now) ? today : addDaysText(today, 1);
}

// 고른 날짜와 시각이 이미 지났는지 (한국 시간)
export function isPassed(date, time, now = new Date()) {
  const today = koreaToday(now);
  return date < today || (date === today && time <= koreaNowTime(now));
}

// ISO 시각 → 한국 시간 'MM.DD (요일) HH:mm' (안내 토스트)
export function fireText(iso) {
  const at = new Date(iso);
  return `${dayLabel(koreaToday(at))} ${koreaNowTime(at)}`;
}
