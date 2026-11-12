// 로그인 화면 동작 (LoginView_screen.md 4. 동작, 6. 상태별 화면), 화면 이동 제한 (D-051), 로그인 만료 (D-118)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';
import { apiRequest } from '../src/api/client.js';
import { useAuthStore } from '../src/stores/auth.js';

// 실시간 연결은 이 테스트에서 쓰지 않는다
vi.mock('../src/realtime/socket.js', () => ({ connectRealtime: vi.fn(), disconnectRealtime: vi.fn(), onRealtime: vi.fn(() => () => {}) }));

const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });

let fetchMock;
let handlers;

beforeEach(() => {
  handlers = {
    'GET /api/sessions/me': () => fail(401, 'UNAUTHORIZED'),
    'GET /api/teams': () => ok({ teams: [] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
  };
  fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method} ${url.split('?')[0]}`;
    if (!handlers[key]) {
      throw new Error(`정하지 않은 요청: ${key}`);
    }
    return handlers[key](url, options);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

async function mountAt(path, state) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(state ? { path, state } : path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { wrapper, router };
}

const submit = async (wrapper) => {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
};

describe('로그인 화면', () => {
  test('빈 칸 → 칸 아래 오류, 첫 빈 칸으로 포커스, API 없음', async () => {
    const { wrapper } = await mountAt('/login');
    fetchMock.mockClear();
    await submit(wrapper);
    expect(wrapper.findAll('.message').map((m) => m.text())).toEqual(['아이디를 입력해 주세요.', '비밀번호를 입력해 주세요.']);
    expect(wrapper.findAll('.control.is-invalid')).toHaveLength(2);
    expect(document.activeElement.id).toBe('login-id');
    expect(fetchMock).not.toHaveBeenCalled();
    await wrapper.find('#login-id').setValue('todo2026');
    expect(wrapper.findAll('.message').map((m) => m.text())).toEqual(['비밀번호를 입력해 주세요.']);
  });
  test('아이디 앞뒤 공백은 지우고 보낸다, 공백만 있으면 빈 칸', async () => {
    let sentBody = null;
    handlers['POST /api/sessions'] = (url, options) => { sentBody = JSON.parse(options.body); return ok(ME); };
    const { wrapper } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('   ');
    await wrapper.find('#password').setValue('abcd123!');
    await submit(wrapper);
    expect(wrapper.find('.message').text()).toBe('아이디를 입력해 주세요.');
    await wrapper.find('#login-id').setValue('  todo2026 ');
    await submit(wrapper);
    expect(sentBody).toEqual({ loginId: 'todo2026', password: 'abcd123!' });
  });
  test('성공 → 로딩 표시 후 로그인 후 화면(/personal/tasks)으로', async () => {
    let resolveLogin;
    handlers['POST /api/sessions'] = () => new Promise((resolve) => {
      resolveLogin = (value) => { handlers['GET /api/sessions/me'] = () => ok(ME); resolve(value); };
    });
    const { wrapper, router } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.find('#password').setValue('abcd123!');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.btn-submit').text()).toBe('로그인 중...');
    expect(wrapper.find('.btn-submit').attributes('disabled')).toBeDefined();
    resolveLogin(ok(ME));
    // 레이아웃 화면 파일을 처음 불러오는 시간이 걸린다
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/personal/tasks'), { timeout: 5000 });
    expect(useAuthStore().user).toEqual(ME);
  });
  test('LOGIN_FAILED → 오류 상자, 비밀번호 비우고 포커스. 입력하면 오류 상자 지움', async () => {
    handlers['POST /api/sessions'] = () => fail(401, 'LOGIN_FAILED', '아이디 또는 비밀번호가 올바르지 않습니다.');
    const { wrapper, router } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.find('#password').setValue('wrong123!');
    await submit(wrapper);
    expect(wrapper.find('.error-box').text()).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    expect(wrapper.find('#password').element.value).toBe('');
    expect(document.activeElement.id).toBe('password');
    expect(wrapper.find('.toast-box').exists()).toBe(false);
    expect(router.currentRoute.value.path).toBe('/login');
    await wrapper.find('#password').setValue('a');
    expect(wrapper.find('.error-box').exists()).toBe(false);
  });
  test('LOGIN_LOCKED → 오류 상자에 서버 문구', async () => {
    const message = '비밀번호를 5번 틀려 로그인이 잠겼습니다. 7분 뒤 다시 시도해 주세요.';
    handlers['POST /api/sessions'] = () => fail(423, 'LOGIN_LOCKED', message);
    const { wrapper } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.find('#password').setValue('abcd123!');
    await submit(wrapper);
    expect(wrapper.find('.error-box').text()).toBe(message);
  });
  test.each([[500, 'INTERNAL_ERROR'], [400, 'INVALID_INPUT']])('그 밖의 오류 %s → 서버 오류 토스트', async (status, code) => {
    handlers['POST /api/sessions'] = () => fail(status, code);
    const { wrapper } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.find('#password').setValue('abcd123!');
    await submit(wrapper);
    expect(wrapper.find('.toast-box.is-error').text()).toContain('일시적인 오류가 발생했습니다.');
    expect(wrapper.find('.error-box').exists()).toBe(false);
  });
  test('비밀번호 보기 버튼', async () => {
    const { wrapper } = await mountAt('/login');
    await wrapper.find('.icon-button').trigger('click');
    expect(wrapper.find('#password').attributes('type')).toBe('text');
    await wrapper.find('.icon-button').trigger('click');
    expect(wrapper.find('#password').attributes('type')).toBe('password');
  });
  test('아이디 찾기에서 넘어오면 아이디 채우고 비밀번호에 포커스', async () => {
    const { wrapper } = await mountAt('/login');
    window.history.replaceState({ loginId: 'found123' }, '');
    const { wrapper: second } = await mountAt('/login');
    expect(second.find('#login-id').element.value).toBe('found123');
    expect(document.activeElement.id).toBe('password');
    window.history.replaceState(null, '');
    wrapper.unmount();
  });
  test('링크: 아이디 찾기, 비밀번호 찾기, 회원가입', async () => {
    const { wrapper } = await mountAt('/login');
    expect(wrapper.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['아이디 찾기', '/find-id'], ['비밀번호 찾기', '/find-password'], ['회원가입', '/signup'],
    ]);
  });
});

describe('화면 이동 제한 (D-051)', () => {
  test.each(['/login', '/signup'])('로그인한 회원이 %s 에 오면 /personal/tasks 로', async (path) => {
    handlers['GET /api/sessions/me'] = () => ok(ME);
    const { router } = await mountAt(path);
    expect(router.currentRoute.value.path).toBe('/personal/tasks');
  });
  test.each(['/login', '/signup'])('비회원은 %s 에 머문다', async (path) => {
    const { router } = await mountAt(path);
    expect(router.currentRoute.value.path).toBe(path);
  });
  test('로그인 확인 중 서버 오류 → 화면은 연다', async () => {
    handlers['GET /api/sessions/me'] = () => fail(500, 'INTERNAL_ERROR');
    const { router, wrapper } = await mountAt('/login');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(wrapper.find('.toast-box.is-error').exists()).toBe(true);
  });
});

describe('사용 중 로그인 만료 (D-118)', () => {
  test('회원 API 401 → 만료 토스트, 로그인 정보 지우고 로그인 화면으로', async () => {
    handlers['GET /api/sessions/me'] = () => ok(ME);
    handlers['POST /api/email-verifications'] = () => fail(401, 'UNAUTHORIZED');
    const { router, wrapper } = await mountAt('/signup');
    expect(router.currentRoute.value.path).toBe('/personal/tasks');
    handlers['GET /api/sessions/me'] = () => fail(401, 'UNAUTHORIZED');
    await expect(apiRequest('POST', '/api/email-verifications', { body: {} })).rejects.toMatchObject({ status: 401 });
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    expect(useAuthStore().user).toBeNull();
    expect(router.currentRoute.value.path).toBe('/login');
  });
  test('로그인 API 의 401 은 만료 처리하지 않는다', async () => {
    handlers['POST /api/sessions'] = () => fail(401, 'LOGIN_FAILED', '아이디 또는 비밀번호가 올바르지 않습니다.');
    const { wrapper } = await mountAt('/login');
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.find('#password').setValue('wrong123!');
    await submit(wrapper);
    expect(wrapper.find('.toast-box').exists()).toBe(false);
  });
});
