// 일일보고 탭 동작 (DailyReportView_screen.md 4. 동작, 6. 상태별 화면). 오늘은 2026-11-11 (수, 한국 시간)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';
import { addDaysText, formatDayWithWeekday, koreaToday } from '../src/utils/format.js';

const realtime = vi.hoisted(() => ({ handlers: new Map() }));
vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  isRealtimeConnected: vi.fn(() => true),
  onRealtime: vi.fn((event, handler) => {
    realtime.handlers.set(event, handler);
    return () => {};
  }),
}));

const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const TODAY = '2026-11-11';
const item = (userId, nickname, status, over = {}) => ({
  userId, nickname, isMe: userId === 1, status, reportId: status === 'none' ? null : userId * 10,
  submitDate: status === 'submitted' ? '2026-11-11T00:12:00Z' : null, isEdited: false, ...over,
});
const section = (title, type, html, over = {}) => ({ title, type, statuses: type === 'tasks' ? ['progress'] : [], doneRange: null, html, ...over });
const draft = (over = {}) => ({
  reportId: null, reportDate: TODAY, status: 'new', nickname: '홍길동', isMine: true, header: '11/11 진행 사항입니다.',
  sections: [section('◆ 진행', 'tasks', '<ul><li><p>[11/10] 작업 - [진행]</p></li></ul>'), section('◆ 기타', 'text', '')],
  draftDate: null, submitDate: null, updateDate: null, ...over,
});
const TEMPLATE = {
  header: '{날짜} 진행 사항입니다.',
  sections: [
    { title: '◆ 통계', type: 'stats', statuses: [], doneRange: { kind: 'sinceLastReport', weekday: null, day: null }, defaultHtml: '' },
    { title: '◆ 기타', type: 'text', statuses: [], doneRange: null, defaultHtml: '' },
  ],
  canEdit: true,
};

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
let handlers;
let calls;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-11T01:00:00Z'));
  realtime.handlers.clear();
  // jsdom 에는 matchMedia 가 없다 (넓은 화면으로 둔다)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: [{ teamId: 7, name: '디자인팀', myRole: 'owner' }] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
    'GET /api/teams/7/reports': (url) => ok({
      date: new URL(url, 'http://x').searchParams.get('date'), isToday: true,
      items: [item(1, '홍길동', 'none'), item(2, '이영희', 'submitted'), item(3, '김민수', 'none')],
    }),
    'GET /api/teams/7/reports/today': () => ok({ report: draft(), isCarryOver: false }),
    'GET /api/teams/7/reports/20': () => ok(draft({
      reportId: 20, status: 'submitted', nickname: '이영희', isMine: false, submitDate: '2026-11-11T00:12:00Z',
      sections: [section('◆ 기타', 'text', '<p>이영희 보고</p>')],
    })),
    'GET /api/teams/7/report-template': () => ok(TEMPLATE),
    'GET /api/personal/todos': () => ok({ todos: [] }),
    'GET /api/personal/tasks': () => ok({ tasks: [] }),
    'GET /api/teams/7/todos': () => ok({ todos: [] }),
    'GET /api/teams/7/tasks': () => ok({ tasks: [] }),
    'GET /api/teams/7/members': () => ok({ members: [] }),
  };
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const key = `${options.method} ${url.split('?')[0]}`;
    calls.push({ key, url, body: options.body ? JSON.parse(options.body) : undefined });
    if (!handlers[key]) {
      throw new Error(`정하지 않은 요청: ${key}`);
    }
    return handlers[key](url, options);
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function mountAt(path = '/teams/7/reports') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('.report-top').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
const rows = (wrapper) => wrapper.findAll('.status-row');
const editorOf = (wrapper, index) => wrapper.findAll('.ProseMirror')[index].element.editor;
const typeInto = async (wrapper, index, text) => {
  editorOf(wrapper, index).commands.insertContent(text);
  await flushPromises();
};
const confirmButton = (label) => [...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent.trim() === label);

describe('날짜 함수', () => {
  test.each([
    ['2026-11-11T14:59:59Z', '2026-11-11'], ['2026-11-11T15:00:00Z', '2026-11-12'], ['2026-12-31T15:00:00Z', '2027-01-01'],
  ])('한국 시간 오늘: %s → %s', (iso, expected) => expect(koreaToday(new Date(iso))).toBe(expected));
  test('요일·날짜 더하기', () => {
    expect(formatDayWithWeekday('2026-11-11')).toBe('2026.11.11 (수)');
    expect(addDaysText('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysText('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('화면 열기', () => {
  test('현황 목록(내 행 맨 위·배지·제출 수)과 내 오늘 초안(쓰기)', async () => {
    const { wrapper } = await mountAt();
    expect(calls.map((c) => c.url)).toContain('/api/teams/7/reports?date=2026-11-11');
    expect(wrapper.find('.date-text').text()).toBe('2026.11.11 (수)');
    expect(button(wrapper, '오늘').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[aria-label="다음날"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.status-title small').text()).toBe('제출 1 / 전체 3');
    expect(rows(wrapper)[0].text()).toContain('홍길동(나)');
    expect(rows(wrapper)[0].classes()).toContain('is-selected');
    expect(rows(wrapper)[1].find('.rb').text()).toBe('제출 완료');
    expect(rows(wrapper)[2].find('.rb').text()).toBe('미제출');
    expect(wrapper.find('.report-state').text()).toBe('작성 전');
    expect(wrapper.find('.report-header-line').text()).toBe('11/11 진행 사항입니다.');
    expect(wrapper.findAll('.rs-title').map((t) => t.text())).toEqual(['◆ 진행 다시 불러오기', '◆ 기타']);
    expect(wrapper.findAll('.ProseMirror').every((p) => p.attributes('contenteditable') === 'true')).toBe(true);
    expect(wrapper.findAll('.count-line').map((c) => c.text())).toEqual(['17 / 5,000', '0 / 5,000']);
    expect(button(wrapper, '임시저장')).toBeDefined();
    expect(button(wrapper, '양식 설정')).toBeDefined();
  });
  test('팀원은 [양식 설정]이 없다', async () => {
    handlers['GET /api/teams'] = () => ok({ teams: [{ teamId: 7, name: '디자인팀', myRole: 'member' }] });
    const { wrapper } = await mountAt();
    expect(button(wrapper, '양식 설정')).toBeUndefined();
  });
  test('남의 보고는 읽기 전용, 미제출은 빈 보고', async () => {
    const { wrapper } = await mountAt();
    await rows(wrapper)[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.report-who').text()).toContain('이영희');
    expect(wrapper.find('.report-state').text()).toBe(`제출 완료 · ${formatDayWithWeekday(TODAY).slice(0, 10)} ${new Date('2026-11-11T00:12:00Z').toTimeString().slice(0, 5)}`);
    expect(wrapper.find('.ProseMirror').attributes('contenteditable')).toBe('false');
    expect(wrapper.find('.report-actions').exists()).toBe(false);
    expect(wrapper.find('.report-tools').exists()).toBe(false);
    await rows(wrapper)[2].trigger('click');
    await flushPromises();
    expect(wrapper.find('.empty-box').text()).toBe('제출한 보고가 없습니다.');
  });
  test('지난 날짜: [›]·[오늘] 켜짐, 내 임시저장 보고는 읽기 전용 "(제출하지 않음)"', async () => {
    handlers['GET /api/teams/7/reports/10'] = () => ok(draft({ reportId: 10, reportDate: '2026-11-10', status: 'draft', draftDate: '2026-11-10T09:40:00Z' }));
    const { wrapper } = await mountAt();
    handlers['GET /api/teams/7/reports'] = () => ok({ date: '2026-11-10', isToday: false, items: [item(1, '홍길동', 'draft')] });
    await wrapper.find('[aria-label="전날"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('.date-text').text()).toBe('2026.11.10 (화)');
    expect(button(wrapper, '오늘').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('.report-state').text()).toContain('(제출하지 않음)');
    expect(wrapper.find('.ProseMirror').attributes('contenteditable')).toBe('false');
  });
});

describe('쓰기·저장', () => {
  test('임시저장 → 상태·배지, 제출 → [수정 제출]만', async () => {
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '메모');
    handlers['POST /api/teams/7/reports/today/save'] = (url, options) => {
      const { action } = JSON.parse(options.body);
      handlers['GET /api/teams/7/reports'] = () => ok({ date: TODAY, isToday: true, items: [item(1, '홍길동', action === 'draft' ? 'draft' : 'submitted')] });
      return ok(draft({ reportId: 10, status: action === 'draft' ? 'draft' : 'submitted', draftDate: '2026-11-11T00:03:00Z', submitDate: action === 'draft' ? null : '2026-11-11T00:20:00Z' }));
    };
    await button(wrapper, '임시저장').trigger('click');
    await flushPromises();
    const body = calls.find((c) => c.key === 'POST /api/teams/7/reports/today/save').body;
    expect(body).toMatchObject({ reportDate: TODAY, action: 'draft', header: '11/11 진행 사항입니다.' });
    expect(body.sections[1]).toEqual({ title: '◆ 기타', type: 'text', statuses: [], doneRange: null, html: '<p>메모</p>' });
    expect(wrapper.find('.toast-box').text()).toContain('임시저장했습니다.');
    expect(wrapper.find('.report-state').text()).toMatch(/^임시저장 · \d\d:\d\d$/);
    expect(rows(wrapper)[0].find('.rb').text()).toBe('임시저장');
    await button(wrapper, '제출').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('보고를 제출했습니다.');
    expect(button(wrapper, '임시저장')).toBeUndefined();
    expect(button(wrapper, '수정 제출')).toBeDefined();
  });
  test('글자 수 넘침 → 빨강 + 저장 버튼 비활성 (경계 5,000 은 됨)', async () => {
    const { wrapper } = await mountAt();
    editorOf(wrapper, 1).commands.setContent(`<p>${'가'.repeat(5000)}</p>`);
    await flushPromises();
    expect(wrapper.findAll('.count-line')[1].classes()).toContain('is-warn');
    expect(button(wrapper, '제출').attributes('disabled')).toBeUndefined();
    editorOf(wrapper, 1).commands.setContent(`<p>${'가'.repeat(5001)}</p>`);
    await flushPromises();
    expect(wrapper.findAll('.count-line')[1].classes()).toContain('is-over');
    expect(button(wrapper, '제출').attributes('disabled')).toBeDefined();
    expect(button(wrapper, '임시저장').attributes('disabled')).toBeDefined();
  });
  test('REPORT_ALREADY_SUBMITTED → 토스트 + [수정 제출]로, 쓰던 내용 유지', async () => {
    handlers['POST /api/teams/7/reports/today/save'] = () => fail(409, 'REPORT_ALREADY_SUBMITTED');
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '쓰던 내용');
    await button(wrapper, '임시저장').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('이미 제출한 보고입니다.');
    expect(button(wrapper, '수정 제출')).toBeDefined();
    expect(wrapper.findAll('.ProseMirror')[1].text()).toBe('쓰던 내용');
  });
  test('REPORT_NOT_TODAY → 토스트 + 오늘로 다시 불러온다', async () => {
    handlers['POST /api/teams/7/reports/today/save'] = () => fail(409, 'REPORT_NOT_TODAY');
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '버릴 내용');
    vi.setSystemTime(new Date('2026-11-11T15:00:00Z'));
    await button(wrapper, '제출').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('날짜가 바뀌어 지난 보고는 고칠 수 없습니다.');
    expect(calls.map((c) => c.url)).toContain('/api/teams/7/reports?date=2026-11-12');
    expect(wrapper.findAll('.ProseMirror')[1].text()).toBe('');
  });
  test('[다시 불러오기]: 확인창 → 그 구역만 바꾼다', async () => {
    handlers['GET /api/teams/7/reports/section-content'] = () => ok({ html: '<ul><li><p>새 작업</p></li></ul>' });
    const { wrapper } = await mountAt();
    await button(wrapper, '다시 불러오기').trigger('click');
    expect(document.querySelector('[role=dialog]').textContent).toContain('이 구역을 지금 칸반 내용으로 다시 채울까요?');
    confirmButton('다시 불러오기').click();
    await flushPromises();
    expect(calls.find((c) => c.key === 'GET /api/teams/7/reports/section-content').url).toBe('/api/teams/7/reports/section-content?type=tasks&statuses=progress');
    expect(wrapper.findAll('.ProseMirror')[0].text()).toBe('새 작업');
  });
  test('[새 양식 적용]: 같은 제목 글 구역은 쓰던 내용을 옮긴다', async () => {
    handlers['GET /api/teams/7/reports/today/fresh'] = () => ok({ report: draft({ sections: [section('◆ 기타', 'text', ''), section('◆ 새 글', 'text', '<p>기본</p>')] }) });
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '옮길 내용');
    await button(wrapper, '새 양식 적용').trigger('click');
    confirmButton('적용').click();
    await flushPromises();
    expect(wrapper.findAll('.rs-title').map((t) => t.text())).toEqual(['◆ 기타', '◆ 새 글']);
    expect(wrapper.findAll('.ProseMirror').map((p) => p.text())).toEqual(['옮길 내용', '기본']);
    expect(wrapper.find('.toast-box').text()).toContain('새 양식을 적용했습니다. 저장해야 남습니다.');
  });
  test('이어받기 스위치: 성공 토스트, 실패하면 되돌린다', async () => {
    handlers['POST /api/users/me/report-carry-over'] = () => ok({ isCarryOver: true });
    const { wrapper } = await mountAt();
    await wrapper.find('#carry-switch').setValue(true);
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/users/me/report-carry-over').body).toEqual({ isOn: true });
    expect(wrapper.find('.toast-box').text()).toContain('지난 보고 이어받기를 켰습니다.');
    handlers['POST /api/users/me/report-carry-over'] = () => fail(500, 'INTERNAL_ERROR');
    await wrapper.find('#carry-switch').setValue(false);
    await flushPromises();
    expect(wrapper.find('#carry-switch').element.checked).toBe(true);
  });
});

describe('저장하지 않고 나가기 (D-157)', () => {
  test('다른 행: 확인창 [머무르기]는 그대로, [나가기]는 옮긴다', async () => {
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '고침');
    await rows(wrapper)[1].trigger('click');
    expect(document.querySelector('[role=dialog]').textContent).toContain('저장하지 않은 내용이 있습니다. 나갈까요?');
    confirmButton('머무르기').click();
    await flushPromises();
    expect(wrapper.find('.report-who').text()).toContain('홍길동');
    await rows(wrapper)[1].trigger('click');
    confirmButton('나가기').click();
    await flushPromises();
    expect(wrapper.find('.report-who').text()).toContain('이영희');
  });
  test('다른 탭으로 옮길 때도 묻는다', async () => {
    const { wrapper, router } = await mountAt();
    await typeInto(wrapper, 1, '고침');
    await router.push('/teams/7/tasks').catch(() => {});
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/teams/7/reports');
    confirmButton('나가기').click();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/teams/7/tasks'));
  });
});

describe('실시간 반영 (D-159)', () => {
  test('읽고 있는 남의 보고가 바뀌면 다시 불러온다, 내 보고를 쓰는 중이면 목록만', async () => {
    const { wrapper } = await mountAt();
    await typeInto(wrapper, 1, '쓰는 중');
    handlers['GET /api/teams/7/reports'] = () => ok({ date: TODAY, isToday: true, items: [item(1, '홍길동', 'none'), item(2, '이영희', 'submitted', { isEdited: true }), item(3, '김민수', 'submitted', { reportId: 30 })] });
    await realtime.handlers.get('team:reports-changed')({ teamId: 7, reportDate: TODAY, reportId: 30, userId: 3, action: 'submit', actorUserId: 3 });
    await flushPromises();
    expect(rows(wrapper)[2].find('.rb').text()).toBe('제출 완료');
    expect(wrapper.findAll('.ProseMirror')[1].text()).toBe('쓰는 중');
    editorOf(wrapper, 1).commands.clearContent();
    confirmButton('나가기')?.click();
    await rows(wrapper)[1].trigger('click');
    confirmButton('나가기')?.click();
    await flushPromises();
    handlers['GET /api/teams/7/reports/20'] = () => ok(draft({ reportId: 20, status: 'submitted', nickname: '이영희', isMine: false, submitDate: '2026-11-11T00:12:00Z', updateDate: '2026-11-11T01:00:00Z', sections: [section('◆ 기타', 'text', '<p>고친 보고</p>')] }));
    await realtime.handlers.get('team:reports-changed')({ teamId: 7, reportDate: TODAY, reportId: 20, userId: 2, action: 'update', actorUserId: 2 });
    await flushPromises();
    expect(wrapper.find('.ProseMirror').text()).toBe('고친 보고');
    expect(wrapper.find('.report-state').text()).toContain('수정됨');
  });
});

describe('양식 설정 모달 (D-152)', () => {
  test('입력 오류 문구, 구역 추가, 저장', async () => {
    handlers['POST /api/teams/7/report-template/update'] = () => ok(TEMPLATE);
    const { wrapper } = await mountAt();
    await button(wrapper, '양식 설정').trigger('click');
    await flushPromises();
    const titles = () => wrapper.findAll('.tpl-card input[type=text]');
    expect(titles().map((t) => t.element.value)).toEqual(['◆ 통계', '◆ 기타']);
    await titles()[1].setValue('◆ 통계');
    await button(wrapper, '저장').trigger('click');
    expect(wrapper.findAll('.tpl-error').map((e) => e.text())).toEqual(['구역 제목이 겹칩니다.', '구역 제목이 겹칩니다.']);
    await titles()[1].setValue('');
    await button(wrapper, '저장').trigger('click');
    expect(wrapper.findAll('.tpl-error').map((e) => e.text())).toEqual(['구역 제목을 입력해 주세요.']);
    await titles()[1].setValue('◆ 기타');
    await wrapper.findAll('.tpl-card select[aria-label="구역 종류"]')[1].setValue('tasks');
    await wrapper.findAll('.tpl-card input[type=checkbox]')[1].setValue(false);
    await button(wrapper, '저장').trigger('click');
    expect(wrapper.find('.tpl-error').text()).toBe('상태를 하나 이상 골라 주세요.');
    await wrapper.findAll('.tpl-card input[type=checkbox]')[2].setValue(true);
    expect(wrapper.findAll('.tpl-card select[aria-label="완료 범위"]')).toHaveLength(2);
    await button(wrapper, '구역 추가').trigger('click');
    expect(titles().at(-1).element.value).toBe('새 구역');
    await button(wrapper, '저장').trigger('click');
    await flushPromises();
    const body = calls.find((c) => c.key === 'POST /api/teams/7/report-template/update').body;
    expect(body.sections.map((s) => `${s.title}/${s.type}/${s.statuses}/${s.doneRange?.kind ?? ''}`))
      .toEqual(['◆ 통계/stats//sinceLastReport', '◆ 기타/tasks/done/sinceLastReport', '새 구역/text//']);
    expect(body.sections[2]).not.toHaveProperty('uid');
    expect(wrapper.find('.tpl-modal').exists()).toBe(false);
    expect(wrapper.find('.toast-box').text()).toContain('양식을 저장했습니다.');
  });
  test('403 → 모달 닫기 + [양식 설정] 숨김', async () => {
    handlers['POST /api/teams/7/report-template/update'] = () => fail(403, 'FORBIDDEN');
    const { wrapper } = await mountAt();
    await button(wrapper, '양식 설정').trigger('click');
    await flushPromises();
    await button(wrapper, '저장').trigger('click');
    await flushPromises();
    expect(wrapper.find('.tpl-modal').exists()).toBe(false);
    expect(wrapper.find('.toast-box').text()).toContain('권한이 없습니다.');
    expect(button(wrapper, '양식 설정')).toBeUndefined();
  });
});
