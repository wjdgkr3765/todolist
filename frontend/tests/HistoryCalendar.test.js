// 히스토리 화면 (HistoryView_screen.md), 캘린더 화면의 데이터 요청 (CalendarView_screen.md)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';

vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(), disconnectRealtime: vi.fn(), isRealtimeConnected: vi.fn(() => true), onRealtime: vi.fn(() => () => {}),
}));

const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const historyTask = (taskId, overrides = {}) => ({
  taskId, title: `작업${taskId}`, content: '내용', startDate: '2026-10-20', endDate: '2026-10-27', startTime: null, endTime: null,
  isPeriodUndecided: false, doneDate: '2026-10-28T03:00:00Z', assignees: [], ...overrides,
});
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
let handlers;
let calls;

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: [{ teamId: 2, name: '디자인팀', myRole: 'owner' }] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const [path, query] = url.split('?');
    const key = `${options.method} ${path}`;
    calls.push({ key, query: new URLSearchParams(query ?? '') });
    if (!handlers[key]) {
      throw new Error(`정하지 않은 요청: ${key}`);
    }
    return handlers[key](url, options);
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

async function mountAt(path, selector) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find(selector).exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}

describe('히스토리', () => {
  test('표: 기간 두 줄(날짜만)·하루 한 줄·미정 배지, 완료일, 팀이면 작업자 "외 N명"', async () => {
    handlers['GET /api/teams/2/history'] = () => ok({ tasks: [
      historyTask(1, { assignees: [{ userId: 1, nickname: '홍길동' }, { userId: 3, nickname: '김민수' }], startTime: '09:00', endTime: '18:00' }),
      historyTask(2, { startDate: '2026-10-15', endDate: '2026-10-15' }),
      historyTask(3, { isPeriodUndecided: true, startDate: null, endDate: null }),
    ], totalCount: 3, page: 1, pageSize: 20 });
    const { wrapper } = await mountAt('/teams/2/history', '.history-card table');
    expect(wrapper.find('.history-title').text()).toBe('히스토리(3개)');
    const rows = wrapper.findAll('tbody tr');
    expect(rows[0].findAll('.col-period div').map((d) => d.text())).toEqual(['2026.10.20 ~', '2026.10.27']);
    expect(rows[0].find('.col-assignee').text()).toBe('홍길동 외 1명');
    expect(rows[0].find('.col-done').text()).toBe('2026.10.28');
    expect(rows[1].find('.col-period').text()).toBe('2026.10.15');
    expect(rows[2].find('.col-period .badge-undecided').text()).toBe('미정');
    expect(rows[2].find('.col-assignee').text()).toBe('없음');
    expect(wrapper.find('.pager').exists()).toBe(false);
  });
  test('개인: 작업자 열 없음, 빈 목록 안내', async () => {
    handlers['GET /api/personal/history'] = () => ok({ tasks: [], totalCount: 0, page: 1, pageSize: 20 });
    const { wrapper } = await mountAt('/personal/history', '.history-card');
    await vi.waitFor(() => expect(wrapper.find('.empty-box').exists()).toBe(true));
    expect(wrapper.find('.empty-box').text()).toContain('히스토리가 없습니다.');
  });
  test('페이지 번호: 현재 주변 5개, 첫 페이지 [‹] 비활성, 누르면 그 페이지', async () => {
    handlers['GET /api/personal/history'] = (url) => {
      const page = Number(new URLSearchParams(url.split('?')[1]).get('page'));
      return ok({ tasks: [historyTask(page)], totalCount: 141, page, pageSize: 20 });
    };
    const { wrapper } = await mountAt('/personal/history', '.history-card table');
    const numbers = () => wrapper.findAll('.pager button').map((b) => b.text()).slice(1, -1);
    expect(numbers()).toEqual(['1', '2', '3', '4', '5']);
    expect(wrapper.find('.pager button').attributes('disabled')).toBeDefined();
    await wrapper.findAll('.pager button')[4].trigger('click');
    await flushPromises();
    expect(calls.at(-1).query.get('page')).toBe('4');
    expect(numbers()).toEqual(['2', '3', '4', '5', '6']);
    expect(wrapper.find('.pager .is-current').text()).toBe('4');
  });
  test('빈 페이지가 오면(그사이 줄어듦) 마지막 페이지를 다시 불러온다', async () => {
    handlers['GET /api/personal/history'] = (url) => {
      const page = Number(new URLSearchParams(url.split('?')[1]).get('page'));
      return page === 1
        ? ok({ tasks: [historyTask(1)], totalCount: 41, page: 1, pageSize: 20 })
        : ok({ tasks: page === 3 ? [] : [historyTask(9)], totalCount: 40, page, pageSize: 20 });
    };
    const { wrapper } = await mountAt('/personal/history', '.history-card table');
    await wrapper.findAll('.pager button').find((b) => b.text() === '3').trigger('click');
    await flushPromises();
    expect(calls.map((c) => c.query.get('page')).filter(Boolean)).toEqual(['1', '3', '2']);
  });
  test('행 → 상세 모달: 히스토리 배지, 시간 포함 기간, 완료일 시각, 수정 내역(보기만)', async () => {
    handlers['GET /api/personal/history'] = () => ok({ tasks: [historyTask(5, { startTime: '09:00', endTime: '18:00' })], totalCount: 1, page: 1, pageSize: 20 });
    handlers['GET /api/tasks/5/logs'] = () => ok({ logs: [
      { logId: 1, logType: 'create', isContentChanged: false, isAssigneeChanged: false, beforeStatus: null, nickname: '홍길동', ...historyTask(5), status: 'waiting', assigneeNicknames: [], createDate: '2026-10-20T00:00:00Z' },
    ] });
    const { wrapper } = await mountAt('/personal/history', '.history-card table');
    await wrapper.find('tbody tr').trigger('click');
    await flushPromises();
    const modal = wrapper.find('.modal-x');
    expect(modal.find('.badge-history').text()).toBe('히스토리');
    expect(modal.text()).toContain('2026.10.20 09:00 ~ 2026.10.27 18:00');
    expect(modal.text()).toContain('완료일');
    expect(modal.find('.log-row').text()).toContain('작업 생성');
    expect(modal.find('.log-row').text()).toContain('만든 사람 홍길동');
    expect(modal.find('.bi-chevron-right').exists()).toBe(false);
    expect(modal.text()).not.toContain('작업자');
  });
});

describe('캘린더 데이터 요청', () => {
  test('보이는 기간(첫 칸 ~ 마지막 칸)과 그 해 공휴일을 부른다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
    handlers['GET /api/personal/calendar'] = () => ok({ tasks: [] });
    handlers['GET /api/holidays'] = () => ok({ holidays: [], isAvailable: true });
    const { wrapper } = await mountAt('/personal/calendar', '.cal-card');
    await vi.waitFor(() => expect(calls.some((c) => c.key === 'GET /api/personal/calendar')).toBe(true), { timeout: 5000 });
    const range = calls.find((c) => c.key === 'GET /api/personal/calendar').query;
    // 2026년 11월: 일요일 시작 6주 → 11.1(일) ~ 12.12(토)
    expect(range.get('from')).toBe('2026-11-01');
    expect(range.get('to')).toBe('2026-12-12');
    expect(calls.filter((c) => c.key === 'GET /api/holidays').map((c) => c.query.get('year'))).toEqual(['2026']);
    expect(wrapper.find('.cal-month').text()).toBe('2026.11');
    expect(wrapper.find('.cal-today').attributes('disabled')).toBeDefined();
  });
});
