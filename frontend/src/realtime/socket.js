// 실시간 연결 (api.md 6.8). 서버 → 화면만 받는다. 화면은 받은 뒤 목록 API 를 다시 불러 그린다
import { io } from 'socket.io-client';

let socket = null;
const handlers = new Map();

function dispatch(event, data) {
  (handlers.get(event) ?? []).forEach((handler) => handler(data));
}

const EVENTS = ['notifications:changed', 'teams:changed', 'team:todos-changed', 'team:tasks-changed', 'team:reports-changed'];

// 로그인한 화면이 열리면 연결한다. 다시 연결되면 'reconnected', 끊기면 'disconnected' 를 알린다
export function connectRealtime() {
  if (socket) {
    return;
  }
  socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket'] });
  let hasConnected = false;
  socket.on('connect', () => {
    if (hasConnected) {
      dispatch('reconnected', null);
    }
    hasConnected = true;
  });
  // 연결 상태: 끊김 띠(D-123)에 쓴다
  socket.on('disconnect', () => dispatch('disconnected', null));
  EVENTS.forEach((event) => socket.on(event, (data) => dispatch(event, data)));
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

// 이벤트를 받을 함수를 등록한다. 돌려준 함수를 부르면 해제한다
export function onRealtime(event, handler) {
  if (!handlers.has(event)) {
    handlers.set(event, new Set());
  }
  handlers.get(event).add(handler);
  return () => handlers.get(event).delete(handler);
}

export function isRealtimeConnected() {
  return Boolean(socket?.connected);
}
