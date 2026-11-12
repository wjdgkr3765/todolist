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
