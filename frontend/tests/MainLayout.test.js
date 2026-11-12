// 공통 레이아웃 동작 (MainLayout_screen.md 4. 동작, 6. 상태별 화면)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';

const realtimeHandlers = new Map();
vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  onRealtime: vi.fn((event, handler) => { realtimeHandlers.set(event, handler); return () => realtimeHandlers.delete(event); }),
}));

const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const TEAMS = [{ teamId: 1, name: '디자인팀', myRole: 'owner' }, { teamId: 2, name: '프로젝트 A 개발팀', myRole: 'member' }];
const INVITE = { notificationId: 11, notificationType: 'team_invite', teamId: 8, teamName: '마케팅팀', taskId: null, taskTitle: null, taskEndDate: null, taskEndTime: null, senderNickname: '김민수', isRead: false, createDate: '2026-11-11T05:30:00Z' };
const ASSIGNED = { notificationId: 12, notificationType: 'task_assigned', teamId: 1, teamName: '디자인팀', taskId: 31, taskTitle: '메인 화면 시안 정리', taskEndDate: null, taskEndTime: null, senderNickname: '이영희', isRead: false, createDate: '2026-11-11T02:05:00Z' };
const DUE = { notificationId: 13, notificationType: 'due_soon', teamId: null, teamName: null, taskId: 41, taskTitle: '주간 보고서 작성', taskEndDate: '2026-11-12', taskEndTime: '18:00', senderNickname: null, isRead: true, createDate: '2026-11-11T00:00:00Z' };

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });

let handlers;
let calls;

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: TEAMS }),
    'GET /api/notifications': () => ok({ notifications: [INVITE, ASSIGNED, DUE], unreadCount: 2 }),
    'POST /api/notifications/read': () => ok({ unreadCount: 0 }),
  };
  // 작업 화면이 부르는 목록 (개인·팀)
  for (const prefix of ['/api/personal', '/api/teams/1', '/api/teams/2', '/api/teams/99']) {
    handlers[`GET ${prefix}/todos`] = () => ok({ todos: [] });
    handlers[`GET ${prefix}/tasks`] = () => ok({ tasks: [] });
  }
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const key = `${options.method} ${url.split('?')[0]}`;
    calls.push({ key, body: options.body ? JSON.parse(options.body) : undefined });
    if (!handlers[key]) {
      throw new Error(`정하지 않은 요청: ${key}`);
    }
    return handlers[key](url, options);
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  realtimeHandlers.clear();
  document.body.innerHTML = '';
});

async function mountAt(path) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('.main-layout').exists() || router.currentRoute.value.path === '/login').toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const texts = (wrapper, selector) => wrapper.findAll(selector).map((el) => el.text());
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text() === label);

describe('기본 화면', () => {
  test('개인 공간: 닉네임·이메일, 팀 목록, 개인 선택, 탭 3개(작업 녹색), 배지 2', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    expect(wrapper.find('.profile-nickname').text()).toBe('홍길동');
    expect(wrapper.find('.profile-email').text()).toBe('user@example.com');
    expect(texts(wrapper, '.nav-team-list .nav-item')).toEqual(['디자인팀', '프로젝트 A 개발팀']);
    expect(wrapper.find('.nav-item.is-active').text()).toBe('개인');
    expect(texts(wrapper, '.menu-tab')).toEqual(['작업', '캘린더', '히스토리']);
    expect(wrapper.find('.menu-tab.is-active').text()).toBe('작업');
    expect(wrapper.find('.bell-badge').text()).toBe('2');
    expect(wrapper.find('.task-view').exists()).toBe(true);
  });
  test('팀 공간: 그 팀 선택, 탭 5개', async () => {
    const { wrapper } = await mountAt('/teams/2/history');
    expect(wrapper.find('.nav-item.is-active').text()).toBe('프로젝트 A 개발팀');
    expect(texts(wrapper, '.menu-tab')).toEqual(['작업', '캘린더', '팀 정보', '히스토리', '일일보고']);
    expect(wrapper.find('.menu-tab.is-active').text()).toBe('히스토리');
    expect(wrapper.findAll('.menu-tab').map((t) => t.attributes('href'))).toEqual(['/teams/2/tasks', '/teams/2/calendar', '/teams/2/info', '/teams/2/history', '/teams/2/reports']);
  });
  test('회원정보 수정: 탭 숨김, 선택 없음', async () => {
    const { wrapper } = await mountAt('/profile');
    expect(wrapper.find('.menu-tabs').exists()).toBe(false);
    expect(wrapper.find('.nav-item.is-active').exists()).toBe(false);
  });
  test('팀 없음 → 안내, 안 본 알림 0 → 배지 숨김, 100개 이상 → 99+', async () => {
    handlers['GET /api/teams'] = () => ok({ teams: [] });
    handlers['GET /api/notifications'] = () => ok({ notifications: [], unreadCount: 0 });
    const { wrapper } = await mountAt('/personal/tasks');
    expect(wrapper.find('.nav-empty').text()).toBe('아직 속한 팀이 없습니다.');
    expect(wrapper.find('.bell-badge').exists()).toBe(false);
    handlers['GET /api/notifications'] = () => ok({ notifications: [], unreadCount: 100 });
    const second = await mountAt('/personal/tasks');
    expect(second.wrapper.find('.bell-badge').text()).toBe('99+');
  });
  test.each([['/', '/personal/tasks'], ['/nothing/here', '/personal/tasks']])('%s → %s (로그인)', async (path, expected) => {
    const { router } = await mountAt(path);
    expect(router.currentRoute.value.path).toBe(expected);
  });
  test('비회원이 회원 화면·없는 주소에 오면 /login', async () => {
    handlers['GET /api/sessions/me'] = () => fail(401, 'UNAUTHORIZED');
    expect((await mountAt('/personal/tasks')).router.currentRoute.value.path).toBe('/login');
    expect((await mountAt('/nothing')).router.currentRoute.value.path).toBe('/login');
  });
  test('속하지 않은 팀 주소 → 토스트 + 팀 목록 새로고침 + /personal/tasks', async () => {
    const { wrapper, router } = await mountAt('/teams/99/tasks');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/personal/tasks'));
    expect(wrapper.find('.toast-box.is-error').text()).toContain('팀을 찾을 수 없습니다.');
    expect(calls.filter((c) => c.key === 'GET /api/teams').length).toBeGreaterThanOrEqual(2);
  });
});

describe('알림 창', () => {
  test('열면 목록을 다시 불러오고 읽음 처리 → 배지 숨김. 바깥 클릭으로 닫힘', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    calls.length = 0;
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    expect(calls.map((c) => c.key).filter((key) => key.includes('notifications'))).toEqual(['GET /api/notifications', 'POST /api/notifications/read']);
    expect(wrapper.find('.bell-badge').exists()).toBe(false);
    const items = texts(wrapper, '.notification-item');
    expect(items[0]).toContain('김민수님이 마케팅팀 팀에 초대했습니다.');
    expect(items[1]).toContain('이영희님이 디자인팀 팀의 "메인 화면 시안 정리" 작업자로 지정했습니다.');
    expect(items[2]).toContain('"주간 보고서 작성" 작업이 11.12 18:00에 마감됩니다.');
    expect(items[2]).toContain('개인');
    expect(wrapper.findAll('.notification-item.is-unread')).toHaveLength(2);
    document.body.click();
    await flushPromises();
    expect(wrapper.find('.notification-box').exists()).toBe(false);
  });
  test('알림 없음', async () => {
    handlers['GET /api/notifications'] = () => ok({ notifications: [], unreadCount: 0 });
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.notification-empty').text()).toBe('알림이 없습니다.');
  });
  test('초대 수락 → 항목 빼고 팀 목록 맨 위 + 안내 토스트 (화면은 그대로)', async () => {
    handlers['POST /api/notifications/11/accept'] = () => ok({ teamId: 8, name: '마케팅팀', myRole: 'member' });
    const { wrapper, router } = await mountAt('/personal/tasks');
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    await button(wrapper, '수락').trigger('click');
    await flushPromises();
    expect(texts(wrapper, '.nav-team-list .nav-item')[0]).toBe('마케팅팀');
    expect(wrapper.find('.toast-box').text()).toContain('마케팅팀 팀에 가입했습니다.');
    expect(wrapper.findAll('.notification-item')).toHaveLength(2);
    expect(router.currentRoute.value.path).toBe('/personal/tasks');
  });
  test('수락 실패: 20개 제한 → 오류 토스트, 알림 남음 / 404 → "이미 없어진 초대입니다." + 목록 다시', async () => {
    handlers['POST /api/notifications/11/accept'] = () => fail(409, 'TEAM_LIMIT_EXCEEDED');
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    await button(wrapper, '수락').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('가입된 팀이 20개라 더 가입할 수 없습니다.');
    expect(wrapper.findAll('.notification-item')).toHaveLength(3);
    handlers['POST /api/notifications/11/accept'] = () => fail(404, 'NOT_FOUND');
    calls.length = 0;
    await button(wrapper, '수락').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('이미 없어진 초대입니다.');
    expect(calls.map((c) => c.key)).toContain('GET /api/notifications');
  });
  test('거절, [X] 지우기 → 항목 빼기', async () => {
    handlers['POST /api/notifications/11/decline'] = () => ok({ isDeclined: true });
    handlers['POST /api/notifications/13/delete'] = () => ok({ unreadCount: 0 });
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    await button(wrapper, '거절').trigger('click');
    await flushPromises();
    await wrapper.findAll('.notification-close')[1].trigger('click');
    await flushPromises();
    expect(texts(wrapper, '.notification-item')).toHaveLength(1);
    expect(texts(wrapper, '.notification-item')[0]).toContain('작업자로 지정했습니다.');
  });
  test('작업자 지정 알림 클릭 → 창 닫고 팀 작업 화면 ?taskId', async () => {
    const { wrapper, router } = await mountAt('/personal/tasks');
    await wrapper.find('.bell-button').trigger('click');
    await flushPromises();
    await wrapper.findAll('.notification-link')[0].trigger('click');
    await flushPromises();
    // 작업 화면이 taskId 를 처리하고 주소에서 지운다. 목록에 없는 작업이라 안내 토스트
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/teams/1/tasks'));
    expect(calls.map((c) => c.key)).toContain('GET /api/teams/1/tasks');
    await vi.waitFor(() => expect(wrapper.find('.toast-box.is-error').text()).toContain('작업을 찾을 수 없습니다.'));
    expect(wrapper.find('.notification-box').exists()).toBe(false);
  });
  test('실시간 notifications:changed → 배지 바꿈', async () => {
    handlers['GET /api/notifications'] = () => ok({ notifications: [], unreadCount: 0 });
    const { wrapper } = await mountAt('/personal/tasks');
    await realtimeHandlers.get('notifications:changed')({ unreadCount: 5 });
    await flushPromises();
    expect(wrapper.find('.bell-badge').text()).toBe('5');
  });
});

describe('팀 만들기', () => {
  async function openModal(wrapper) {
    await wrapper.find('.nav-add').trigger('click');
    await flushPromises();
  }
  test('열면 입력칸 포커스, 빈 값 → 오류, 취소로 닫힘', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    await openModal(wrapper);
    expect(document.activeElement.id).toBe('team-name-input');
    await wrapper.find('#team-name-input').setValue('   ');
    await button(wrapper, '만들기').trigger('click');
    expect(wrapper.find('.modal-x .message').text()).toBe('팀 이름을 입력해 주세요.');
    await button(wrapper, '취소').trigger('click');
    expect(wrapper.find('.modal-x').exists()).toBe(false);
  });
  test('만들기 → 팀 목록 맨 위, 팀 정보 탭으로 이동', async () => {
    handlers['POST /api/teams'] = () => ok({ teamId: 9, name: '마케팅팀', myRole: 'owner' });
    // 이동한 팀 정보 탭이 부르는 API
    handlers['GET /api/teams/9'] = () => ok({ teamId: 9, name: '마케팅팀', myRole: 'owner', ownerNickname: '홍길동', memberCount: 1, createDate: '2026-11-12T00:00:00Z' });
    handlers['GET /api/teams/9/members'] = () => ok({ members: [] });
    handlers['GET /api/teams/9/invitations'] = () => ok({ invitations: [] });
    const { wrapper, router } = await mountAt('/personal/tasks');
    await openModal(wrapper);
    await wrapper.find('#team-name-input').setValue('  마케팅팀 ');
    await wrapper.find('#team-name-input').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/teams').body).toEqual({ name: '마케팅팀' });
    // 팀 정보 화면 파일을 처음 불러오는 시간이 걸린다
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/teams/9/info'), { timeout: 5000 });
    expect(texts(wrapper, '.nav-team-list .nav-item')[0]).toBe('마케팅팀');
    expect(wrapper.find('.modal-x').exists()).toBe(false);
  });
  test('20개 제한 → 입력칸 아래 오류', async () => {
    handlers['POST /api/teams'] = () => fail(409, 'TEAM_LIMIT_EXCEEDED');
    const { wrapper } = await mountAt('/personal/tasks');
    await openModal(wrapper);
    await wrapper.find('#team-name-input').setValue('마케팅팀');
    await button(wrapper, '만들기').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x .message').text()).toBe('가입된 팀이 20개라 더 만들 수 없습니다.');
  });
});

describe('회원 메뉴·실시간 팀 변경', () => {
  test('회원 메뉴 → 회원정보 수정 / 로그아웃 → /login', async () => {
    handlers['POST /api/sessions/logout'] = () => {
      handlers['GET /api/sessions/me'] = () => fail(401, 'UNAUTHORIZED');
      return ok({ isLoggedOut: true });
    };
    const { wrapper, router } = await mountAt('/personal/tasks');
    await wrapper.find('.profile-button').trigger('click');
    expect(texts(wrapper, '.profile-menu-item')).toEqual(['회원정보 수정', '로그아웃']);
    await wrapper.findAll('.profile-menu-item')[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile');
    await wrapper.find('.profile-button').trigger('click');
    await wrapper.findAll('.profile-menu-item')[1].trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'), { timeout: 5000 });
  });
  test.each([['removed', '팀에서 내보내졌습니다.'], ['dissolved', '팀이 해체되었습니다.']])('보고 있는 팀이 %s → 토스트 + /personal/tasks', async (reason, message) => {
    const { wrapper, router } = await mountAt('/teams/1/tasks');
    handlers['GET /api/teams'] = () => ok({ teams: [TEAMS[1]] });
    await realtimeHandlers.get('teams:changed')({ teamId: 1, reason });
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/personal/tasks');
    expect(wrapper.find('.toast-box.is-error').text()).toContain(message);
    expect(texts(wrapper, '.nav-team-list .nav-item')).toEqual(['프로젝트 A 개발팀']);
  });
  test('보고 있지 않은 팀이 해체 → 목록만 바꾸고 토스트 없음', async () => {
    const { wrapper, router } = await mountAt('/personal/tasks');
    handlers['GET /api/teams'] = () => ok({ teams: [TEAMS[1]] });
    await realtimeHandlers.get('teams:changed')({ teamId: 1, reason: 'dissolved' });
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/personal/tasks');
    expect(wrapper.find('.toast-box').exists()).toBe(false);
    expect(texts(wrapper, '.nav-team-list .nav-item')).toEqual(['프로젝트 A 개발팀']);
  });
});
