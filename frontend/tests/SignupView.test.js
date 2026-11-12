// 회원가입 화면 동작 (SignupView_screen.md 4. 동작, 6. 상태별 화면). API 는 가짜 fetch 로 대신한다
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import SignupView from '../src/views/SignupView.vue';
import AppToast from '../src/components/AppToast.vue';

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '') => ({ ok: false, status, json: async () => ({ error: { code, message } }) });

let routes;
let fetchMock;

function sentData() {
  const base = Date.now();
  return {
    verificationId: 7,
    expireDate: new Date(base + 300000).toISOString(),
    resendAvailableDate: new Date(base + 60000).toISOString(),
  };
}

async function mountView() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push('/signup');
  await router.isReady();
  const wrapper = mount({ components: { SignupView, AppToast }, template: '<AppToast /><SignupView />' }, {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  });
  return { wrapper, router };
}

// fetch 호출을 경로별로 정한 응답으로 돌려준다
function routeFetch(handlers) {
  fetchMock.mockImplementation(async (url, options = {}) => {
    const key = `${options.method} ${url.split('?')[0]}`;
    const handler = handlers[key];
    if (!handler) {
      throw new Error(`정하지 않은 요청: ${key}`);
    }
    return handler(url, options);
  });
}

async function fillValid(wrapper) {
  await wrapper.find('#login-id').setValue('todo2026');
  await wrapper.find('#password').setValue('abcd123!');
  await wrapper.find('#password-confirm').setValue('abcd123!');
  await wrapper.find('#nickname').setValue('홍길동');
  await wrapper.find('#email').setValue('user@example.com');
  await wrapper.find('#phone').setValue('01012345678');
}

async function checkIdAndVerify(wrapper) {
  await wrapper.findAll('button').find((b) => b.text() === '중복 확인').trigger('click');
  await flushPromises();
  await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
  await flushPromises();
  await wrapper.find('#code').setValue('123456');
  await wrapper.findAll('button').find((b) => b.text() === '확인').trigger('click');
  await flushPromises();
}

const messages = (wrapper) => wrapper.findAll('.message').map((m) => m.text());

beforeEach(() => {
  routes = [
    { path: '/signup', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div>login</div>' } },
  ];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('아이디 중복 확인', () => {
  test('형식이 틀리면 API 없이 형식 오류', async () => {
    const { wrapper } = await mountView();
    await wrapper.find('#login-id').setValue('todo');
    await wrapper.findAll('button').find((b) => b.text() === '중복 확인').trigger('click');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(messages(wrapper)).toContain('영어와 숫자를 모두 포함해 6~15자로 입력해 주세요.');
  });
  test('사용 가능 → 초록 안내, 다시 입력하면 확인 결과 지움', async () => {
    routeFetch({ 'GET /api/users/login-id-availability': () => ok({ isAvailable: true }) });
    const { wrapper } = await mountView();
    await wrapper.find('#login-id').setValue('todo2026');
    await wrapper.findAll('button').find((b) => b.text() === '중복 확인').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('사용할 수 있는 아이디입니다.');
    expect(wrapper.find('#login-id').element.closest('.control').classList).toContain('is-valid');
    await wrapper.find('#login-id').setValue('todo2027');
    expect(messages(wrapper)).not.toContain('사용할 수 있는 아이디입니다.');
  });
  test('사용 중 → 오류', async () => {
    routeFetch({ 'GET /api/users/login-id-availability': () => ok({ isAvailable: false }) });
    const { wrapper } = await mountView();
    await wrapper.find('#login-id').setValue('admin123');
    await wrapper.findAll('button').find((b) => b.text() === '중복 확인').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('이미 사용 중인 아이디입니다.');
  });
});

describe('칸을 떠날 때 형식 검사', () => {
  test.each([
    ['#password', 'abcd', '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.'],
    ['#nickname', '홍길동_1', '한글, 영어, 숫자로 1~8자 입력해 주세요.'],
    ['#phone', '0101234', '숫자만 11자리로 입력해 주세요.'],
  ])('%s = %s → 오류', async (selector, value, message) => {
    const { wrapper } = await mountView();
    await wrapper.find(selector).setValue(value);
    await wrapper.find(selector).trigger('blur');
    expect(messages(wrapper)).toContain(message);
  });
  test('비밀번호 확인 불일치 → 오류', async () => {
    const { wrapper } = await mountView();
    await wrapper.find('#password').setValue('abcd123!');
    await wrapper.find('#password-confirm').setValue('abcd123@');
    await wrapper.find('#password-confirm').trigger('blur');
    expect(messages(wrapper)).toContain('비밀번호가 일치하지 않습니다.');
  });
  test('전화번호는 숫자 외 입력을 지운다', async () => {
    const { wrapper } = await mountView();
    await wrapper.find('#phone').setValue('010-1234-5678');
    expect(wrapper.find('#phone').element.value).toBe('01012345678');
  });
});

describe('이메일 인증', () => {
  test('발송 → 인증번호 칸, 남은 시간 5:00 부터, 재발송 대기, 안내 문구', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout'] });
    routeFetch({ 'POST /api/email-verifications': () => ok(sentData()) });
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('user@example.com');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    await flushPromises();
    expect(wrapper.find('#code').exists()).toBe(true);
    expect(wrapper.find('.timer-pill').text()).toBe('5:00');
    expect(messages(wrapper)).toContain('인증번호를 보냈습니다. 메일을 확인해 주세요.');
    const resend = () => wrapper.findAll('button').find((b) => b.text().startsWith('재발송'));
    expect(resend().text()).toBe('재발송 1:00');
    expect(resend().attributes('disabled')).toBeDefined();
    await vi.advanceTimersByTimeAsync(59000);
    expect(resend().text()).toBe('재발송 0:01');
    expect(wrapper.find('.timer-pill').text()).toBe('4:01');
    await vi.advanceTimersByTimeAsync(1000);
    expect(resend().text()).toBe('재발송');
    expect(resend().attributes('disabled')).toBeUndefined();
  });
  test('가입된 이메일 → 오류, 인증번호 칸 없음', async () => {
    routeFetch({ 'POST /api/email-verifications': () => fail(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일입니다.') });
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('used@example.com');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('이미 가입된 이메일입니다.');
    expect(wrapper.find('#code').exists()).toBe(false);
  });
  test('이메일 형식 오류 → API 없이 오류', async () => {
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('user@example');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(messages(wrapper)).toContain('이메일 형식이 올바르지 않습니다.');
  });
  test('확인 버튼은 6자리를 모두 넣어야 눌린다', async () => {
    routeFetch({ 'POST /api/email-verifications': () => ok(sentData()) });
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('user@example.com');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    await flushPromises();
    const confirm = () => wrapper.findAll('button').find((b) => b.text() === '확인');
    await wrapper.find('#code').setValue('12345');
    expect(confirm().attributes('disabled')).toBeDefined();
    await wrapper.find('#code').setValue('12a3456');
    expect(wrapper.find('#code').element.value).toBe('123456');
    expect(confirm().attributes('disabled')).toBeUndefined();
  });
  test('틀림 → 서버 문구 (남은 횟수), 맞음 → 이메일 잠금 + 변경 버튼, 변경 → 다시 입력', async () => {
    let attempt = 0;
    routeFetch({
      'POST /api/email-verifications': () => ok(sentData()),
      'POST /api/email-verifications/7/verify': () => {
        attempt += 1;
        return attempt === 1 ? fail(400, 'VERIFICATION_CODE_MISMATCH', '인증번호가 틀렸습니다. (남은 횟수 4회)') : ok({ isVerified: true });
      },
    });
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('user@example.com');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    await flushPromises();
    await wrapper.find('#code').setValue('123455');
    await wrapper.findAll('button').find((b) => b.text() === '확인').trigger('click');
    await flushPromises();
    expect(messages(wrapper)).toContain('인증번호가 틀렸습니다. (남은 횟수 4회)');
    await wrapper.find('#code').setValue('123456');
    await wrapper.find('#code').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(messages(wrapper)).toContain('이메일 인증이 완료되었습니다.');
    expect(wrapper.find('#email').attributes('readonly')).toBeDefined();
    expect(wrapper.find('#code').exists()).toBe(false);
    await wrapper.findAll('button').find((b) => b.text() === '변경').trigger('click');
    expect(wrapper.find('#email').attributes('readonly')).toBeUndefined();
    expect(wrapper.findAll('button').some((b) => b.text() === '인증번호 발송')).toBe(true);
  });
  test('발송 후 이메일을 고치면 인증번호 칸을 닫는다', async () => {
    routeFetch({ 'POST /api/email-verifications': () => ok(sentData()) });
    const { wrapper } = await mountView();
    await wrapper.find('#email').setValue('user@example.com');
    await wrapper.findAll('button').find((b) => b.text() === '인증번호 발송').trigger('click');
    await flushPromises();
    await wrapper.find('#email').setValue('user2@example.com');
    expect(wrapper.find('#code').exists()).toBe(false);
  });
});

describe('가입하기', () => {
  test('빈 폼 → 모든 칸 오류, 첫 오류 칸(아이디)에 포커스, API 없음', async () => {
    const { wrapper } = await mountView();
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(messages(wrapper)).toEqual(expect.arrayContaining([
      '영어와 숫자를 모두 포함해 6~15자로 입력해 주세요.', '비밀번호가 일치하지 않습니다.',
      '이메일 인증을 완료해 주세요.', '숫자만 11자리로 입력해 주세요.',
    ]));
    expect(document.activeElement.id).toBe('login-id');
  });
  test('중복 확인 안 한 아이디 → "아이디 중복 확인을 해 주세요."', async () => {
    const { wrapper } = await mountView();
    await fillValid(wrapper);
    await wrapper.find('form').trigger('submit');
    expect(messages(wrapper)).toContain('아이디 중복 확인을 해 주세요.');
  });
  test('성공 → 로딩, 모든 칸 잠금, 완료 토스트, 1.5초 뒤 /login', async () => {
    let resolveSignup;
    routeFetch({
      'GET /api/users/login-id-availability': () => ok({ isAvailable: true }),
      'POST /api/email-verifications': () => ok(sentData()),
      'POST /api/email-verifications/7/verify': () => ok({ isVerified: true }),
      'POST /api/users': () => new Promise((resolve) => { resolveSignup = resolve; }),
    });
    const { wrapper, router } = await mountView();
    await fillValid(wrapper);
    await checkIdAndVerify(wrapper);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const submitButton = wrapper.find('.btn-submit');
    expect(submitButton.text()).toBe('가입 중...');
    expect(submitButton.find('.spinner-border').exists()).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body).toEqual({ loginId: 'todo2026', password: 'abcd123!', nickname: '홍길동', email: 'user@example.com', phone: '01012345678', verificationId: 7 });
    resolveSignup(ok({ userId: 1 }));
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('가입이 완료되었습니다.');
    expect(wrapper.find('.toast-box').text()).toContain('로그인 화면으로 이동합니다.');
    expect(wrapper.findAll('input').every((input) => input.attributes('disabled') !== undefined)).toBe(true);
    expect(wrapper.findAll('form button').every((button) => button.attributes('disabled') !== undefined)).toBe(true);
    await vi.advanceTimersByTimeAsync(1499);
    expect(router.currentRoute.value.path).toBe('/signup');
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/login');
  });
  test('전화번호 중복 → 전화번호 칸 오류 + 포커스', async () => {
    routeFetch({
      'GET /api/users/login-id-availability': () => ok({ isAvailable: true }),
      'POST /api/email-verifications': () => ok(sentData()),
      'POST /api/email-verifications/7/verify': () => ok({ isVerified: true }),
      'POST /api/users': () => fail(409, 'PHONE_DUPLICATED', '이미 가입된 전화번호입니다.'),
    });
    const { wrapper } = await mountView();
    await fillValid(wrapper);
    await checkIdAndVerify(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(messages(wrapper)).toContain('이미 가입된 전화번호입니다.');
    expect(document.activeElement.id).toBe('phone');
  });
  test('서버 오류 → 공통 오류 토스트', async () => {
    routeFetch({
      'GET /api/users/login-id-availability': () => ok({ isAvailable: true }),
      'POST /api/email-verifications': () => ok(sentData()),
      'POST /api/email-verifications/7/verify': () => ok({ isVerified: true }),
      'POST /api/users': () => fail(500, 'INTERNAL_ERROR'),
    });
    const { wrapper } = await mountView();
    await fillValid(wrapper);
    await checkIdAndVerify(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('일시적인 오류가 발생했습니다.');
    expect(wrapper.find('.btn-submit').attributes('disabled')).toBeUndefined();
  });
});

describe('Tab 이동 (D-165)', () => {
  test('Tab 은 입력칸과 [가입하기]만 거친다. 입력칸 옆 버튼·비밀번호 보기는 건너뛴다', async () => {
    const { wrapper } = await mountView();
    const tabbable = [...wrapper.element.querySelectorAll('input, button')].filter((el) => el.tabIndex >= 0 && !el.disabled);
    expect(tabbable.map((el) => el.id || el.className)).toEqual(['login-id', 'password', 'password-confirm', 'nickname', 'email', 'phone', 'btn-submit']);
    expect(wrapper.findAll('button[tabindex="-1"]').map((b) => b.text() || b.attributes('aria-label'))).toEqual(['중복 확인', '비밀번호 보기', '인증번호 발송']);
  });
});
