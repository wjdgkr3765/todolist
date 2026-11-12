// API 호출 공통 처리 (api.md 3 공통 응답 형식). 서버 오류(5xx)·연결 실패는 공통 오류 토스트를 띄운다 (overview.md 9)
// 사용 중 로그인 만료(401) 처리(D-118)는 로그인 기능을 만들 때 넣는다
import { useToastStore } from '../stores/toast.js';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
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
  }
  throw new ApiError(response.status, error?.code ?? 'INTERNAL_ERROR', error?.message ?? '');
}
