// API 호출 공통 처리 (api.md 3 공통 응답 형식)
// - 서버 오류(5xx)·연결 실패: 공통 오류 토스트 (overview.md 9)
// - 401: 로그인 만료 토스트 후 로그인 화면 (D-118). 로그인 API 와 로그인 확인(GET /api/sessions/me)은 화면이 직접 처리한다
import { useToastStore } from '../stores/toast.js';

export class ApiError extends Error {
  // extra: 오류 응답에 함께 온 값 (예: 탈퇴를 막는 팀 목록 teams)
  constructor(status, code, message, extra = {}) {
    super(message);
    Object.assign(this, extra);
    this.status = status;
    this.code = code;
  }
}

const PATHS_WITHOUT_EXPIRE_HANDLING = ['/api/sessions', '/api/sessions/me'];
let onSessionExpired = null;

// 로그인 만료 때 할 일 (router/index.js 에서 정한다)
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// method: 'GET' | 'POST', path: '/api/...', options: { query, body }
export async function apiRequest(method, path, { query, body } = {}) {
  const url = query ? `${path}?${new URLSearchParams(query)}` : path;
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    useToastStore().showServerError();
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다.');
  }

  const payload = await response.json().catch(() => null);
  if (response.ok && payload && 'data' in payload) {
    return payload.data;
  }
  const error = payload?.error;
  if (response.status >= 500 || !error) {
    useToastStore().showServerError();
  } else if (response.status === 401 && !PATHS_WITHOUT_EXPIRE_HANDLING.includes(path)) {
    useToastStore().show('error', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    await onSessionExpired?.();
  }
  const { code, message, ...extra } = error ?? {};
  throw new ApiError(response.status, code ?? 'INTERNAL_ERROR', message ?? '', extra);
}
