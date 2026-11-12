// 한국 시간(Asia/Seoul) 날짜·시각 (api.md 1 "오늘 날짜", D-128, D-158)
const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(date) {
  return Object.fromEntries(FORMATTER.formatToParts(date).map((part) => [part.type, part.value]));
}

// 'YYYY-MM-DD'
export function koreaToday(now = new Date()) {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

// 'HH:mm:ss'
export function koreaTime(now = new Date()) {
  const p = parts(now);
  return `${p.hour}:${p.minute}:${p.second}`;
}

// 'YYYY-MM-DD' 에 days 일을 더한다
export function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// DB 의 DATE 값(자정 UTC 로 읽힘)을 'YYYY-MM-DD' 로
export function toDateText(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

// DB 의 TIME(0) 값(1970-01-01 기준 UTC 로 읽힘)을 'HH:mm' 으로
export function toTimeText(value) {
  return value ? value.toISOString().slice(11, 16) : null;
}
