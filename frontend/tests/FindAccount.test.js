// 아이디·비밀번호 찾기 화면 (FindIdView_screen.md, FindPasswordView_screen.md)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';

vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(), disconnectRealtime: vi.fn(), isRealtimeConnected: vi.fn(() => true), onRealtime: vi.fn(() => () => {}),
}));

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
const sent = () => {
  const base = Date.now();
  return { verificationId: 7, expireDate: new Date(base + 300000).toISOString(), resendAvailableDate: new Date(base + 60000).toISOString() };
};
let handlers;
let calls;

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => fail(401, 'UNAUTHORIZED'),
    'POST /api/email-verifications': () => ok(sent()),
    'POST /api/email-verifications/7/verify': () => ok({ isVerified: true }),
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
  vi.useRealTimers();
  document.body.innerHTML = '';
});

async function mountAt(path, state) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push(state ? { path, state } : path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('.form-heading').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
const messages = (wrapper) => wrapper.findAll('.message').map((m) => m.text());

async function sendAndVerify(wrapper, email = 'user@example.com') {
  await wrapper.find('#email').setValue(email);
  await button(wrapper, '인증번호 발송').trigger('click');
  await flushPromises();
  await wrapper.find('#email-code').setValue('123456');
  await button(wrapper, '확인').trigger('click');
  await flushPromises();
}

describe('아이디 찾기', () => {
  test('가입되지 않은 이메일 → 이메일 칸 아래 문구', async () => {
    handlers['POST /api/email-verifications'] = () => fail(404, 'EMAIL_NOT_REGISTERED');
    const { wrapper } = await mountAt('/find-id');
    await wrapper.find('#email').setValue('none@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toEqual(['가입되지 않은 이메일입니다.']);
    expect(calls.find((c) => c.key === 'POST /api/email-verifications').body).toEqual({ email: 'none@example.com', purpose: 'find_id' });
  });
  test('발송 → 인증번호 칸·안내·남은 시간, 확인 → 결과(아이디 전체·가입일) → 로그인하기는 아이디를 넘긴다', async () => {
    handlers['POST /api/users/find-id'] = () => ok({ loginId: 'todo2026', createDate: '2026-11-01T03:00:00Z' });
    handlers['POST /api/sessions'] = () => fail(401, 'LOGIN_FAILED');
    const { wrapper, router } = await mountAt('/find-id');
    await wrapper.find('#email').setValue('user@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('인증번호를 보냈습니다. 메일을 확인해 주세요.');
    expect(wrapper.find('.timer-pill').text()).toBe('5:00');
    expect(button(wrapper, '확인').attributes('disabled')).toBeDefined();
    await wrapper.find('#email-code').setValue('123456');
    await button(wrapper, '확인').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/users/find-id').body).toEqual({ email: 'user@example.com', verificationId: 7 });
    expect(wrapper.find('.result-id').text()).toBe('todo2026');
    expect(wrapper.find('.result-date').text()).toBe('가입일 2026.11.01');
    await button(wrapper, '로그인하기').trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'), { timeout: 5000 });
    await vi.waitFor(() => expect(wrapper.find('#login-id').element.value).toBe('todo2026'));
  });
  test('30분이 지나 EMAIL_NOT_VERIFIED → 처음 상태 + 안내', async () => {
    handlers['POST /api/users/find-id'] = () => fail(400, 'EMAIL_NOT_VERIFIED');
    const { wrapper } = await mountAt('/find-id');
    await sendAndVerify(wrapper);
    expect(messages(wrapper)).toEqual(['인증 시간이 지났습니다. 다시 인증해 주세요.']);
    expect(button(wrapper, '인증번호 발송')).toBeDefined();
  });
  test('메일 발송 실패 → 전용 오류 토스트', async () => {
    handlers['POST /api/email-verifications'] = () => fail(500, 'MAIL_SEND_FAILED');
    const { wrapper } = await mountAt('/find-id');
    await wrapper.find('#email').setValue('user@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
});

describe('비밀번호 찾기', () => {
  test('아이디 빈 값 → 발송하지 않음, 일치하는 회원 없음 → 이메일 칸 아래', async () => {
    handlers['POST /api/email-verifications'] = () => fail(404, 'ACCOUNT_NOT_FOUND');
    const { wrapper } = await mountAt('/find-password');
    await wrapper.find('#email').setValue('user@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    expect(messages(wrapper)).toEqual(['아이디를 입력해 주세요.']);
    expect(calls.some((c) => c.key === 'POST /api/email-verifications')).toBe(false);
    await wrapper.find('#login-id').setValue(' todo2026 ');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/email-verifications').body).toEqual({ email: 'user@example.com', purpose: 'find_password', loginId: 'todo2026' });
    expect(messages(wrapper)).toEqual(['아이디와 이메일이 일치하는 회원이 없습니다.']);
  });
  test('아이디 찾기에서 넘어오면 채움 → 인증 → 잠금·새 비밀번호 구역·포커스 → 검사 → 변경 완료 잠금·1.5초 뒤 /login', async () => {
    handlers['POST /api/users/reset-password'] = () => ok({ isReset: true });
    const { wrapper, router } = await mountAt('/find-password', { loginId: 'todo2026', email: 'user@example.com' });
    expect(wrapper.find('#login-id').element.value).toBe('todo2026');
    expect(wrapper.find('#email').element.value).toBe('user@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    await wrapper.find('#email-code').setValue('123456');
    await button(wrapper, '확인').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('인증되었습니다.');
    expect(wrapper.find('#login-id').attributes('readonly')).toBeDefined();
    expect(wrapper.find('.change-guide').text()).toBe('인증 후 30분 안에 변경해 주세요.');
    expect(document.activeElement.id).toBe('new-password');
    await button(wrapper, '비밀번호 변경').trigger('click');
    expect(messages(wrapper)).toEqual(expect.arrayContaining(['영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.', '비밀번호가 일치하지 않습니다.']));
    await wrapper.find('#new-password').setValue('newpw123!');
    await wrapper.find('#new-check').setValue('newpw123!');
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await button(wrapper, '비밀번호 변경').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/users/reset-password').body).toEqual({ loginId: 'todo2026', email: 'user@example.com', verificationId: 7, password: 'newpw123!' });
    expect(wrapper.find('.toast-box').text()).toContain('비밀번호를 바꿨습니다.');
    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined || input.attributes('readonly') !== undefined)).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    vi.useRealTimers();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'), { timeout: 5000 });
  });
  test('[변경] → 인증 취소, 새 비밀번호 구역 숨김', async () => {
    const { wrapper } = await mountAt('/find-password');
    await wrapper.find('#login-id').setValue('todo2026');
    await sendAndVerify(wrapper);
    expect(wrapper.find('#new-password').exists()).toBe(true);
    await button(wrapper, '변경').trigger('click');
    expect(wrapper.find('#new-password').exists()).toBe(false);
    expect(wrapper.find('#email').attributes('readonly')).toBeUndefined();
  });
});
