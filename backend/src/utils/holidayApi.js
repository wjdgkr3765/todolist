// 공휴일 (api.md GET /api/holidays, D-107): 공공데이터포털 한국천문연구원 특일 정보 getRestDeInfo
// 키는 쿼리로만 보내고 요청 주소를 로그에 남기지 않는다 (security.md 1). 해마다 24시간 메모리 캐시, 실패는 캐시하지 않는다
import { env } from '../config/env.js';

const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const CACHE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;
const cache = new Map();

let fetchOverride = null;
// 테스트에서 외부 API 대신 쓴다 (null 이면 원래대로)
export function setHolidayFetchOverride(fn) {
  fetchOverride = fn;
  cache.clear();
}

function toHolidays(payload) {
  const item = payload?.response?.body?.items?.item;
  const items = Array.isArray(item) ? item : (item ? [item] : []);
  return items
    .filter((row) => row.isHoliday === 'Y' && /^\d{8}$/.test(String(row.locdate)))
    .map((row) => {
      const text = String(row.locdate);
      return { date: `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`, name: String(row.dateName) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getHolidays(year) {
  const cached = cache.get(year);
  if (cached && Date.now() - cached.savedAt < CACHE_MS) {
    return { holidays: cached.holidays, isAvailable: true };
  }
  if (!env.holidayApiKey && !fetchOverride) {
    return { holidays: [], isAvailable: false };
  }
  try {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({ serviceKey: env.holidayApiKey, solYear: String(year), numOfRows: '100', _type: 'json' });
    const response = await (fetchOverride ?? fetch)(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const payload = await response.json();
    if (!response.ok || payload?.response?.header?.resultCode !== '00') {
      throw new Error('공휴일 API 응답 오류');
    }
    const holidays = toHolidays(payload);
    cache.set(year, { holidays, savedAt: Date.now() });
    return { holidays, isAvailable: true };
  } catch (error) {
    console.error('공휴일 정보 가져오기 실패:', error?.name);
    return { holidays: [], isAvailable: false };
  }
}
