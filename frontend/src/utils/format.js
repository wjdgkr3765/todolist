// 화면 날짜·시각 표시 (브라우저 시각 기준)
const pad = (value) => String(value).padStart(2, '0');

// ISO 시각 → 'YYYY.MM.DD HH:mm'
export function formatDateTime(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 'YYYY-MM-DD' → 'MM.DD'
export function formatMonthDay(dateText) {
  return `${dateText.slice(5, 7)}.${dateText.slice(8, 10)}`;
}

// ISO 시각 → 'HH:mm'
export function formatTime(iso) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 'YYYY-MM-DD' → 'YYYY.MM.DD (요일)'
export function formatDayWithWeekday(dateText) {
  return `${dateText.replaceAll('-', '.')} (${WEEKDAYS[new Date(`${dateText}T00:00:00Z`).getUTCDay()]})`;
}

// 'YYYY-MM-DD' 에 days 일을 더한다
export function addDaysText(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// 한국 시간(Asia/Seoul) 오늘 'YYYY-MM-DD' (일일보고 D-158)
export function koreaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
