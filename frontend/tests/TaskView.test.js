// 작업 화면 동작 (TaskView_screen.md 4. 동작, 6. 상태별 화면)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import KanbanBoard from '../src/components/KanbanBoard.vue';
import { createAppRouter } from '../src/router/index.js';
import { formatPeriodFull, formatPeriodShort, isOverdue, logTypeText, validatePeriodForm } from '../src/utils/period.js';

const realtimeHandlers = new Map();
vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  isRealtimeConnected: vi.fn(() => false),
  onRealtime: vi.fn((event, handler) => {
    if (!realtimeHandlers.has(event)) { realtimeHandlers.set(event, new Set()); }
    realtimeHandlers.get(event).add(handler);
    return () => realtimeHandlers.get(event).delete(handler);
  }),
}));
const fire = async (event, data) => { for (const handler of realtimeHandlers.get(event) ?? []) { await handler(data); } };

const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const TODO = { todoId: 5, title: '보고서 쓰기', content: '내용', startDate: '2026-11-10', endDate: '2026-11-20', startTime: null, endTime: null, isPeriodUndecided: false, createDate: '2026-11-10T00:00:00Z' };
const TASK = { taskId: 31, title: '시안 정리', content: '시안 내용', startDate: '2026-11-10', endDate: '2026-11-12', startTime: '09:00', endTime: '18:00', isPeriodUndecided: false, status: 'waiting', sortOrder: 0, assignees: [], doneDate: null, updateDate: null, createDate: '2026-11-10T00:00:00Z' };
const LOG = { logId: 1, logType: 'create', isContentChanged: false, isAssigneeChanged: false, beforeStatus: null, nickname: '홍길동', ...TASK, assigneeNicknames: [], createDate: '2026-11-10T05:30:00Z' };

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
let handlers;
let calls;

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: [{ teamId: 2, name: '디자인팀', myRole: 'owner' }] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
    'GET /api/personal/todos': () => ok({ todos: [TODO] }),
    'GET /api/personal/tasks': () => ok({ tasks: [TASK] }),
    'GET /api/tasks/31/logs': () => ok({ logs: [LOG] }),
  };
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
  await vi.waitFor(() => expect(wrapper.find('.task-view').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
// 오른쪽 UI 안의 버튼 (할일 목록에도 같은 이름 버튼이 있다)
const panelButton = (wrapper, label) => wrapper.find('.side-panel').findAll('button').find((b) => b.text().trim() === label);
const messages = (wrapper) => wrapper.findAll('.message').map((m) => m.text());
const toast = (wrapper) => wrapper.find('.toast-box').text();

describe('기간 표시·검사 (D-137, D-139, D-142)', () => {
  test.each([
    [{ ...TODO }, '~ 2026.11.20', '2026.11.10 ~ 2026.11.20'],
    [{ ...TODO, startDate: '2026-11-12', endDate: '2026-11-12' }, '~ 2026.11.12', '2026.11.12'],
    [{ ...TASK }, '~ 2026.11.12 18:00', '2026.11.10 09:00 ~ 2026.11.12 18:00'],
    [{ ...TASK, startDate: '2026-11-12' }, '~ 2026.11.12 18:00', '2026.11.12 09:00 ~ 18:00'],
    [{ ...TODO, isPeriodUndecided: true }, null, null],
  ])('%#', (item, short, full) => {
    expect(formatPeriodShort(item)).toBe(short);
    expect(formatPeriodFull(item)).toBe(full);
  });
  test('기한 지남: 시간 없으면 종료일 < 오늘, 있으면 종료 시각 < 지금, 완료·미정은 아님', () => {
    const now = new Date(2026, 10, 12, 18, 1);
    expect(isOverdue({ ...TODO, status: 'waiting', endDate: '2026-11-11' }, now)).toBe(true);
    expect(isOverdue({ ...TODO, status: 'waiting', endDate: '2026-11-12' }, now)).toBe(false);
    expect(isOverdue({ ...TASK, endTime: '18:00' }, now)).toBe(true);
    expect(isOverdue({ ...TASK, endTime: '18:05' }, now)).toBe(false);
    expect(isOverdue({ ...TASK, status: 'done', endDate: '2026-11-01' }, now)).toBe(false);
    expect(isOverdue({ ...TODO, status: 'progress', isPeriodUndecided: true }, now)).toBe(false);
  });
  test('수정 내역 종류 문구 순서', () => {
    expect(logTypeText(LOG)).toBe('작업 생성');
    expect(logTypeText({ ...LOG, logType: 'change', isContentChanged: true, isAssigneeChanged: true, beforeStatus: 'progress', status: 'done' }))
      .toBe('작업 수정 · 작업자 변경 · 상태 변경 (진행 → 완료)');
  });
  test.each([
    [{ title: '' }, 'title', '제목을 입력해 주세요.'],
    [{ content: ' ' }, 'content', '내용을 입력해 주세요.'],
    [{ startDate: '' }, 'period', '시작일과 종료일을 선택해 주세요.'],
    [{ endDate: '2026-11-01' }, 'period', '종료일은 시작일과 같거나 뒤여야 합니다.'],
    [{ hasTime: true, startTime: '' }, 'period', '시작 시각과 종료 시각을 선택해 주세요.'],
    [{ hasTime: true, startTime: '09:03', endTime: '18:00' }, 'period', '시간은 5분 단위로 선택해 주세요.'],
    [{ hasTime: true, endDate: '2026-11-10', startTime: '18:00', endTime: '09:00' }, 'period', '종료 시각은 시작 시각과 같거나 뒤여야 합니다.'],
  ])('검사 %j', (overrides, key, message) => {
    const form = { title: 'a', content: 'b', isPeriodUndecided: false, startDate: '2026-11-10', endDate: '2026-11-20', hasTime: false, startTime: '', endTime: '', ...overrides };
    expect(validatePeriodForm(form)[key]).toBe(message);
  });
});

describe('할일 목록', () => {
  test('목록·개수, 행 선택으로 버튼 활성, 다시 누르면 해제', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    expect(wrapper.find('.todo-table tbody tr').text()).toContain('보고서 쓰기');
    expect(wrapper.find('.todo-table tbody tr').text()).toContain('~ 2026.11.20');
    expect(wrapper.find('.todo-table tbody tr td:last-child').attributes('title')).toBe('2026.11.10 ~ 2026.11.20');
    expect(button(wrapper, '수정').attributes('disabled')).toBeDefined();
    await wrapper.find('.todo-table tbody tr').trigger('click');
    expect(wrapper.find('tr.is-selected').exists()).toBe(true);
    expect(button(wrapper, '수정').attributes('disabled')).toBeUndefined();
    await wrapper.find('.todo-table tbody tr').trigger('click');
    expect(wrapper.find('tr.is-selected').exists()).toBe(false);
  });
  test('빈 목록 안내', async () => {
    handlers['GET /api/personal/todos'] = () => ok({ todos: [] });
    const { wrapper } = await mountAt('/personal/tasks');
    expect(wrapper.find('.empty-box').text()).toContain('할일이 없습니다.');
  });
  test('추가: 빈 값 오류 → 기간 미정·시간 지정 → 저장 → 닫기, 다시 불러와 선택, 토스트', async () => {
    const saved = { ...TODO, todoId: 6, title: '새 할일' };
    handlers['POST /api/personal/todos'] = () => {
      handlers['GET /api/personal/todos'] = () => ok({ todos: [saved, TODO] });
      return ok(saved);
    };
    const { wrapper } = await mountAt('/personal/tasks');
    await button(wrapper, '추가').trigger('click');
    expect(wrapper.find('.side-panel .panel-title').text()).toBe('할일 추가');
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    expect(messages(wrapper)).toEqual(['제목을 입력해 주세요.', '내용을 입력해 주세요.', '시작일과 종료일을 선택해 주세요.']);
    expect(document.activeElement.id).toBe('todo-title');
    await wrapper.find('#todo-title').setValue('  새 할일 ');
    await wrapper.find('#todo-content').setValue('내용');
    await wrapper.findAll('.undecided-check input')[1].setValue(true);
    expect(wrapper.find('#todo-start-time').element.value).toBe('09:00');
    expect(wrapper.find('#todo-end-time').element.value).toBe('18:00');
    await wrapper.findAll('.undecided-check input')[0].setValue(true);
    expect(wrapper.find('#todo-start-time').exists()).toBe(false);
    expect(wrapper.find('#todo-start').attributes('disabled')).toBeDefined();
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/personal/todos').body).toEqual({
      title: '새 할일', content: '내용', isPeriodUndecided: true, startDate: null, endDate: null, startTime: null, endTime: null,
    });
    expect(wrapper.find('.side-panel').exists()).toBe(false);
    expect(wrapper.find('tr.is-selected').text()).toContain('새 할일');
    expect(toast(wrapper)).toContain('할일을 추가했습니다.');
  });
  test('수정: 지금 값으로 채움 → 저장', async () => {
    handlers['POST /api/todos/5/update'] = () => ok({ ...TODO, title: '고침' });
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.todo-table tbody tr').trigger('click');
    await button(wrapper, '수정').trigger('click');
    expect(wrapper.find('.side-panel .panel-title').text()).toBe('할일 수정');
    expect(wrapper.find('#todo-title').element.value).toBe('보고서 쓰기');
    expect(wrapper.find('#todo-start').element.value).toBe('2026-11-10');
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    await flushPromises();
    expect(toast(wrapper)).toContain('할일을 수정했습니다.');
  });
  test('삭제: 확인창 → 삭제 → 토스트 / 404 → "이미 삭제된 할일입니다."', async () => {
    handlers['POST /api/todos/5/delete'] = () => fail(404, 'NOT_FOUND');
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.todo-table tbody tr').trigger('click');
    await button(wrapper, '삭제').trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('할일을 삭제할까요?');
    expect(wrapper.find('.confirm-target').text()).toBe('보고서 쓰기');
    await wrapper.findAll('.modal-x button').at(-1).trigger('click');
    await flushPromises();
    expect(toast(wrapper)).toContain('이미 삭제된 할일입니다.');
    expect(wrapper.find('.modal-x').exists()).toBe(false);
  });
  test('작업 시작 → 할일 빠지고 칸반 다시 불러오기, 토스트', async () => {
    handlers['POST /api/todos/5/start'] = () => {
      handlers['GET /api/personal/todos'] = () => ok({ todos: [] });
      handlers['GET /api/personal/tasks'] = () => ok({ tasks: [{ ...TASK, taskId: 40, title: '보고서 쓰기' }, { ...TASK, sortOrder: 1 }] });
      return ok({ ...TASK, taskId: 40 });
    };
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.todo-table tbody tr').trigger('click');
    await button(wrapper, '작업 시작').trigger('click');
    await flushPromises();
    expect(wrapper.find('.empty-box').exists()).toBe(true);
    expect(wrapper.findAll('.status-waiting .task-card').map((c) => c.find('.card-title').text())).toEqual(['보고서 쓰기', '시안 정리']);
    expect(toast(wrapper)).toContain('작업을 시작했습니다.');
  });
});

describe('칸반·작업 상세', () => {
  test('카드: 제목, "~ 종료일 시각", 마우스 올림 전체 기간 / 개인 공간에는 작업자·내 작업만 없음', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    const card = wrapper.find('.status-waiting .task-card');
    expect(card.find('.card-title').text()).toBe('시안 정리');
    expect(card.find('.period-text').text()).toBe('~ 2026.11.12 18:00');
    expect(card.find('.card-period').attributes('title')).toBe('2026.11.10 09:00 ~ 2026.11.12 18:00');
    expect(wrapper.find('.my-only').exists()).toBe(false);
    expect(wrapper.find('.panel-title').text()).toBe('칸반보드(1개)');
    expect(wrapper.find('.status-progress .column-empty').text()).toBe('작업이 없습니다');
  });
  test('카드 클릭 → 상세(읽기) + 수정 내역, 수정 내역 줄 → 모달', async () => {
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.task-card').trigger('click');
    await flushPromises();
    expect(wrapper.find('.task-card.is-selected').exists()).toBe(true);
    expect(wrapper.find('.side-panel .panel-title').text()).toBe('작업 상세');
    expect(wrapper.find('.side-panel').text()).toContain('2026.11.10 09:00 ~ 2026.11.12 18:00');
    expect(wrapper.find('.side-panel').text()).not.toContain('작업자');
    expect(wrapper.find('.log-row').text()).toContain('작업 생성');
    expect(wrapper.find('.log-row').text()).toContain('만든 사람 홍길동');
    await wrapper.find('.log-row').trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('수정 내역');
    expect(wrapper.find('.modal-x').text()).toContain('시안 내용');
  });
  test('상세 수정: 바뀐 것 없음 → "바뀐 내용이 없습니다." / 상태 바꿈 → "작업을 수정했습니다."', async () => {
    let next = TASK;
    handlers['POST /api/tasks/31/update'] = () => ok(next);
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.task-card').trigger('click');
    await flushPromises();
    await panelButton(wrapper, '수정').trigger('click');
    expect(wrapper.find('.side-panel .panel-title').text()).toBe('작업 수정');
    expect(wrapper.find('#edit-title').element.value).toBe('시안 정리');
    expect(wrapper.find('#edit-start-time').element.value).toBe('09:00');
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    await flushPromises();
    expect(toast(wrapper)).toContain('바뀐 내용이 없습니다.');
    next = { ...TASK, status: 'progress', updateDate: '2026-11-12T00:00:00Z' };
    await panelButton(wrapper, '수정').trigger('click');
    await wrapper.find('#edit-status').setValue('progress');
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    await flushPromises();
    expect(calls.filter((c) => c.key === 'POST /api/tasks/31/update').at(-1).body).toMatchObject({ status: 'progress', assigneeUserIds: [], startTime: '09:00' });
    expect(toast(wrapper)).toContain('작업을 수정했습니다.');
  });
  test('작업 삭제 확인창 → 삭제 / 404 → 상세 닫고 "이미 삭제된 작업입니다."', async () => {
    handlers['POST /api/tasks/31/delete'] = () => ok({ isDeleted: true });
    const { wrapper } = await mountAt('/personal/tasks');
    await wrapper.find('.task-card').trigger('click');
    await flushPromises();
    await panelButton(wrapper, '삭제').trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('삭제한 작업과 수정 내역은 되돌릴 수 없습니다.');
    handlers['GET /api/personal/tasks'] = () => ok({ tasks: [] });
    await wrapper.findAll('.modal-x button').at(-1).trigger('click');
    await flushPromises();
    expect(toast(wrapper)).toContain('작업을 삭제했습니다.');
    expect(wrapper.find('.side-panel').exists()).toBe(false);
  });
  test('드래그 → move API, 서버 목록으로 다시 그림 / 409 → "히스토리로 옮겨진 작업입니다."', async () => {
    handlers['POST /api/tasks/31/move'] = () => ok({ tasks: [{ ...TASK, status: 'progress' }] });
    const { wrapper } = await mountAt('/personal/tasks');
    wrapper.findComponent(KanbanBoard).vm.$emit('move', { taskId: 31, status: 'progress', index: 0 });
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/tasks/31/move').body).toEqual({ status: 'progress', index: 0 });
    expect(wrapper.findAll('.status-progress .task-card')).toHaveLength(1);
    handlers['POST /api/tasks/31/move'] = () => fail(409, 'TASK_IN_HISTORY');
    wrapper.findComponent(KanbanBoard).vm.$emit('move', { taskId: 31, status: 'done', index: 0 });
    await flushPromises();
    expect(toast(wrapper)).toContain('히스토리로 옮겨진 작업입니다.');
  });
  test('?taskId= 로 오면 그 작업 상세를 열고 주소에서 지운다', async () => {
    const { wrapper, router } = await mountAt('/personal/tasks?taskId=31');
    await flushPromises();
    expect(wrapper.find('.side-panel .panel-title').text()).toBe('작업 상세');
    expect(router.currentRoute.value.fullPath).toBe('/personal/tasks');
  });
});

describe('팀 공간', () => {
  const TEAM_TASK = { ...TASK, assignees: [{ userId: 1, nickname: '홍길동' }, { userId: 3, nickname: '김민수' }] };
  beforeEach(() => {
    handlers['GET /api/teams/2/todos'] = () => ok({ todos: [TODO] });
    handlers['GET /api/teams/2/tasks'] = () => ok({ tasks: [TEAM_TASK, { ...TASK, taskId: 32, title: '남의 작업', sortOrder: 1 }] });
    handlers['GET /api/tasks/32/logs'] = () => ok({ logs: [LOG] });
    handlers['GET /api/teams/2/members'] = () => ok({ members: [
      { userId: 1, nickname: '홍길동', email: 'user@example.com', role: 'owner', joinDate: '' },
      { userId: 3, nickname: '김민수', email: 'kim@example.com', role: 'member', joinDate: '' },
    ] });
  });
  test('카드 작업자 "첫 닉네임 외 N명", 내 작업만 → 내 카드만·개수·순서 변경 불가', async () => {
    const { wrapper } = await mountAt('/teams/2/tasks');
    const card = wrapper.find('.task-card');
    expect(card.find('.card-assignee').text()).toBe('홍길동 외 1명');
    expect(card.find('.card-assignee').attributes('title')).toBe('홍길동, 김민수');
    await wrapper.find('.my-only input').setValue(true);
    expect(wrapper.findAll('.task-card')).toHaveLength(1);
    expect(wrapper.find('.panel-title').text()).toBe('칸반보드(1개)');
    expect(wrapper.find('.my-only-note').text()).toBe('순서 변경 불가');
  });
  test('작업자 드롭다운: 팀원 목록, 체크 순서대로 저장', async () => {
    handlers['POST /api/tasks/32/update'] = () => ok({ ...TASK, taskId: 32, updateDate: 'x' });
    const { wrapper } = await mountAt('/teams/2/tasks');
    await wrapper.findAll('.task-card')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.side-panel').text()).toContain('없음');
    await panelButton(wrapper, '수정').trigger('click');
    await flushPromises();
    expect(wrapper.find('.assignee-picker .placeholder-text').text()).toBe('작업자 선택');
    await wrapper.find('.assignee-picker .control').trigger('click');
    const options = wrapper.findAll('.assignee-option');
    expect(options.map((o) => o.text())).toEqual(['홍길동user@example.com', '김민수kim@example.com']);
    await options[1].find('input').setValue(true);
    await options[0].find('input').setValue(true);
    expect(wrapper.find('.assignee-picker .value').text()).toBe('김민수 외 1명');
    await wrapper.find('.side-panel .btn-submit').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/tasks/32/update').body.assigneeUserIds).toEqual([3, 1]);
  });
  test('실시간: 다른 팀원이 수정 중인 할일을 바꿈 → 안내 띠, 보고 있는 작업 삭제 → 상세 닫고 토스트', async () => {
    const { wrapper } = await mountAt('/teams/2/tasks');
    await wrapper.find('.todo-table tbody tr').trigger('click');
    await button(wrapper, '수정').trigger('click');
    await fire('team:todos-changed', { teamId: 2, todoId: 5, action: 'update', actorUserId: 3 });
    await flushPromises();
    expect(wrapper.find('.side-panel .warn-strip').text()).toBe('다른 팀원이 이 할일을 바꿨습니다.');
    await wrapper.find('.task-card').trigger('click');
    await flushPromises();
    calls.length = 0;
    await fire('team:tasks-changed', { teamId: 2, taskIds: [31], action: 'delete', actorUserId: 3 });
    await flushPromises();
    expect(calls.map((c) => c.key)).toContain('GET /api/teams/2/tasks');
    expect(wrapper.find('.side-panel').exists()).toBe(false);
    expect(toast(wrapper)).toContain('다른 팀원이 이 작업을 삭제했습니다.');
  });
  test('실시간: 내가 바꾼 이벤트는 목록만 다시 불러온다', async () => {
    const { wrapper } = await mountAt('/teams/2/tasks');
    await wrapper.find('.task-card').trigger('click');
    await flushPromises();
    await fire('team:tasks-changed', { teamId: 2, taskIds: [31], action: 'delete', actorUserId: 1 });
    await flushPromises();
    expect(wrapper.find('.toast-box').exists()).toBe(false);
  });
});
