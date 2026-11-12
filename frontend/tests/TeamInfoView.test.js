// 팀 정보 탭 동작 (TeamInfoView_screen.md 4. 동작, 6. 상태별 화면)
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
const member = (userId, nickname, role) => ({ userId, nickname, email: `${nickname}@example.com`, role, joinDate: '2026-11-10T00:00:00Z' });
const MEMBERS = [member(1, '홍길동', 'owner'), member(2, '이영희', 'manager'), member(3, '김민수', 'member')];
const TEAM = (myRole) => ({ teamId: 7, name: '디자인팀', myRole, ownerNickname: '홍길동', memberCount: 3, createDate: '2026-11-01T00:00:00Z' });

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
let handlers;
let calls;

function setRole(myRole) {
  handlers['GET /api/teams/7'] = () => ok(TEAM(myRole));
}

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: [{ teamId: 7, name: '디자인팀', myRole: 'owner' }] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
    'GET /api/teams/7/members': () => ok({ members: MEMBERS }),
    'GET /api/teams/7/invitations': () => ok({ invitations: [] }),
    'GET /api/personal/todos': () => ok({ todos: [] }),
    'GET /api/personal/tasks': () => ok({ tasks: [] }),
  };
  setRole('owner');
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
  document.body.innerHTML = '';
});

async function mountAt(path = '/teams/7/info') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('.team-info .card-x').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
const menuOf = async (wrapper, rowIndex) => {
  await wrapper.findAll('.member-table tbody tr')[rowIndex].find('.icon-button').trigger('click');
  return wrapper.findAll('.row-menu-item').map((b) => b.text());
};

describe('역할별 화면', () => {
  test('관리자: 이름 수정, 부관리자·팀원 행에 메뉴, 팀 해체', async () => {
    const { wrapper } = await mountAt();
    expect(wrapper.find('.team-name').text()).toBe('디자인팀');
    expect(wrapper.find('.team-meta').text()).toContain('3명');
    expect(wrapper.find('.team-meta').text()).toContain('2026.11.01');
    expect(wrapper.find('.card-title-x').text()).toContain('팀원 (3명)');
    expect(wrapper.find('.me-mark').text()).toBe('(나)');
    expect(button(wrapper, '이름 수정')).toBeDefined();
    const rows = wrapper.findAll('.member-table tbody tr');
    expect(rows[0].find('.icon-button').exists()).toBe(false);
    expect(await menuOf(wrapper, 1)).toEqual(['부관리자 해제', '관리자 넘기기', '내보내기']);
    expect(await menuOf(wrapper, 2)).toEqual(['부관리자 지정', '관리자 넘기기', '내보내기']);
    expect(button(wrapper, '팀 해체')).toBeDefined();
    expect(button(wrapper, '팀 탈퇴')).toBeUndefined();
  });
  test('부관리자: 팀원 행에만 내보내기, 팀 탈퇴', async () => {
    handlers['GET /api/sessions/me'] = () => ok({ ...ME, userId: 2 });
    setRole('manager');
    const { wrapper } = await mountAt();
    const rows = wrapper.findAll('.member-table tbody tr');
    expect(rows[0].find('.icon-button').exists()).toBe(false);
    expect(rows[1].find('.icon-button').exists()).toBe(false);
    expect(await menuOf(wrapper, 2)).toEqual(['내보내기']);
    expect(button(wrapper, '팀 탈퇴')).toBeDefined();
  });
  test('팀원: 이름 수정·메뉴 없음, 팀 탈퇴', async () => {
    handlers['GET /api/sessions/me'] = () => ok({ ...ME, userId: 3 });
    setRole('member');
    const { wrapper } = await mountAt();
    expect(button(wrapper, '이름 수정')).toBeUndefined();
    expect(wrapper.findAll('.member-table .icon-button')).toHaveLength(0);
    expect(button(wrapper, '팀 탈퇴')).toBeDefined();
  });
  test('속하지 않은 팀 → 토스트 + /personal/tasks', async () => {
    handlers['GET /api/teams/7'] = () => fail(404, 'NOT_FOUND');
    handlers['GET /api/teams/7/members'] = () => fail(404, 'NOT_FOUND');
    handlers['GET /api/teams/7/invitations'] = () => fail(404, 'NOT_FOUND');
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createAppRouter(createMemoryHistory());
    router.push('/teams/7/info');
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/personal/tasks'), { timeout: 5000 });
    expect(wrapper.find('.toast-box.is-error').text()).toContain('팀을 찾을 수 없습니다.');
  });
});

describe('동작', () => {
  test('이름 수정: 빈 값 오류 → 저장 → 좌측 네비도 바뀜', async () => {
    handlers['POST /api/teams/7/update'] = () => {
      handlers['GET /api/teams'] = () => ok({ teams: [{ teamId: 7, name: '새이름', myRole: 'owner' }] });
      return ok({ ...TEAM('owner'), name: '새이름' });
    };
    const { wrapper } = await mountAt();
    await button(wrapper, '이름 수정').trigger('click');
    expect(document.activeElement.getAttribute('aria-label')).toBe('팀 이름');
    await wrapper.find('.name-edit input').setValue('  ');
    await button(wrapper, '저장').trigger('click');
    expect(wrapper.find('.name-edit .message').text()).toBe('팀 이름을 입력해 주세요.');
    await wrapper.find('.name-edit input').setValue(' 새이름 ');
    await wrapper.find('.name-edit input').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/teams/7/update').body).toEqual({ name: '새이름' });
    expect(wrapper.find('.team-name').text()).toBe('새이름');
    expect(wrapper.find('.nav-team-list').text()).toContain('새이름');
    expect(wrapper.find('.toast-box').text()).toContain('팀 이름을 바꿨습니다.');
  });
  test.each([
    ['USER_NOT_FOUND', 404, '가입된 회원이 아닙니다.'],
    ['ALREADY_TEAM_MEMBER', 409, '이미 팀원인 회원입니다.'],
    ['INVITATION_DUPLICATED', 409, '이미 초대한 회원입니다.'],
    ['INVITATION_RECENTLY_DECLINED', 429, '초대를 거절한 회원입니다. 거절한 때부터 24시간 뒤에 다시 초대할 수 있습니다.'],
  ])('초대 오류 %s → 입력칸 아래 문구, 모달 유지', async (code, status, message) => {
    handlers['POST /api/teams/7/invitations'] = () => fail(status, code);
    const { wrapper } = await mountAt();
    await button(wrapper, '초대').trigger('click');
    await wrapper.find('#invite-email').setValue('guest@example.com');
    await wrapper.findAll('.modal-x button').at(-1).trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x .message').text()).toBe(message);
  });
  test('초대: 형식 오류 → 문구, 성공 → 모달 닫기 + 토스트 + 초대 목록', async () => {
    handlers['POST /api/teams/7/invitations'] = () => {
      handlers['GET /api/teams/7/invitations'] = () => ok({ invitations: [
        { notificationId: 9, nickname: '손님', email: 'guest@example.com', senderNickname: '홍길동', canCancel: true, createDate: '2026-11-12T00:00:00Z' },
      ] });
      return ok({ isMailSent: false });
    };
    const { wrapper } = await mountAt();
    await button(wrapper, '초대').trigger('click');
    expect(document.activeElement.id).toBe('invite-email');
    await wrapper.find('#invite-email').setValue('guest@example');
    await wrapper.find('#invite-email').trigger('keydown', { key: 'Enter' });
    expect(wrapper.find('.modal-x .message').text()).toBe('이메일 형식이 올바르지 않습니다.');
    await wrapper.find('#invite-email').setValue(' guest@example.com ');
    await wrapper.find('#invite-email').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/teams/7/invitations').body).toEqual({ email: 'guest@example.com' });
    expect(wrapper.find('.modal-x').exists()).toBe(false);
    expect(wrapper.find('.toast-box').text()).toContain('초대했지만 안내 메일은 보내지 못했습니다.');
    expect(wrapper.find('.invite-row').text()).toContain('홍길동님이 초대 · 2026.11.12');
  });
  test('부관리자 지정 → 토스트, 내보내기 확인창 → 토스트', async () => {
    handlers['POST /api/teams/7/members/3/role'] = () => ok({ members: [MEMBERS[0], MEMBERS[1], { ...MEMBERS[2], role: 'manager' }] });
    handlers['POST /api/teams/7/members/2/remove'] = () => ok({ members: [MEMBERS[0], MEMBERS[2]] });
    const { wrapper } = await mountAt();
    await menuOf(wrapper, 2);
    await wrapper.findAll('.row-menu-item')[0].trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/teams/7/members/3/role').body).toEqual({ role: 'manager' });
    expect(wrapper.find('.toast-box').text()).toContain('부관리자로 지정했습니다.');
    await menuOf(wrapper, 1);
    await wrapper.findAll('.row-menu-item').at(-1).trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('이영희님을 팀에서 내보낼까요?');
    await wrapper.findAll('.modal-x button').at(-1).trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('이영희님을 내보냈습니다.');
  });
  test('팀 해체: 이름이 같아야 [다음] → 2단계 [삭제] → /personal/tasks', async () => {
    handlers['POST /api/teams/7/delete'] = () => ok({ isDeleted: true });
    const { wrapper, router } = await mountAt();
    await button(wrapper, '팀 해체').trigger('click');
    const next = () => wrapper.findAll('.modal-x button').at(-1);
    expect(next().attributes('disabled')).toBeDefined();
    await wrapper.find('.modal-x input').setValue('디자인');
    expect(next().attributes('disabled')).toBeDefined();
    await wrapper.find('.modal-x input').setValue(' 디자인팀 ');
    expect(next().attributes('disabled')).toBeUndefined();
    await next().trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('정말 삭제할까요? 되돌릴 수 없습니다.');
    handlers['GET /api/teams'] = () => ok({ teams: [] });
    await next().trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/personal/tasks'), { timeout: 5000 });
    expect(calls.find((c) => c.key === 'POST /api/teams/7/delete').body).toEqual({ name: '디자인팀' });
  });
  test('403 → "권한이 없습니다." + 다시 불러오기', async () => {
    handlers['POST /api/teams/7/members/3/role'] = () => fail(403, 'FORBIDDEN');
    const { wrapper } = await mountAt();
    await menuOf(wrapper, 2);
    calls.length = 0;
    await wrapper.findAll('.row-menu-item')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('권한이 없습니다.');
    expect(calls.map((c) => c.key)).toEqual(expect.arrayContaining(['GET /api/teams/7', 'GET /api/teams/7/members']));
  });
});
