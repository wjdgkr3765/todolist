// 회원정보 수정·탈퇴 화면 (ProfileView_screen.md 4. 동작)
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';

vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(), disconnectRealtime: vi.fn(), isRealtimeConnected: vi.fn(() => true), onRealtime: vi.fn(() => () => {}),
}));

const SESSION = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const ME = { loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com', phone: '01012345678', createDate: '2026-11-01T00:00:00Z' };
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message = '', extra = {}) => ({ ok: false, status, json: async () => ({ error: { code, message, ...extra } }) });
let handlers;
let calls;

beforeEach(() => {
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(SESSION),
    'GET /api/teams': () => ok({ teams: [] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
    'GET /api/users/me': () => ok(ME),
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
  document.body.innerHTML = '';
});

async function mountProfile() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push('/profile');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('#nickname-input').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return { wrapper, router };
}
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text().trim() === label);
const saveButtons = (wrapper) => wrapper.findAll('.btn-side').filter((b) => b.text() === '저장');

describe('내 정보', () => {
  test('읽기 정보, 바뀐 게 없으면 [저장]·[인증번호 발송] 잠김', async () => {
    const { wrapper } = await mountProfile();
    expect(wrapper.find('.read-row').text()).toContain('todo2026');
    expect(wrapper.find('.read-row').text()).toContain('2026.11.01');
    expect(saveButtons(wrapper).every((b) => b.attributes('disabled') !== undefined)).toBe(true);
    expect(button(wrapper, '인증번호 발송').attributes('disabled')).toBeDefined();
  });
  test('닉네임: 형식 오류 → 문구 / 저장 → 토스트 + 좌측 하단 닉네임', async () => {
    handlers['POST /api/users/me/nickname'] = () => ok({ ...ME, nickname: '길동이' });
    const { wrapper } = await mountProfile();
    await wrapper.find('#nickname-input').setValue('홍_1');
    await saveButtons(wrapper)[0].trigger('click');
    expect(wrapper.find('.message.is-error').text()).toBe('한글, 영어, 숫자 1~8자로 입력해 주세요.');
    await wrapper.find('#nickname-input').setValue('길동이');
    await saveButtons(wrapper)[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box').text()).toContain('닉네임을 바꿨습니다.');
    expect(wrapper.find('.profile-nickname').text()).toBe('길동이');
  });
  test('전화번호: 숫자 외 무시, 중복 → 칸 아래 문구', async () => {
    handlers['POST /api/users/me/phone'] = () => fail(409, 'PHONE_DUPLICATED');
    const { wrapper } = await mountProfile();
    await wrapper.find('#phone-input').setValue('010-9999-0000');
    expect(wrapper.find('#phone-input').element.value).toBe('01099990000');
    await saveButtons(wrapper)[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.message.is-error').text()).toBe('이미 가입된 전화번호입니다.');
  });
  test('이메일: 새 이메일 발송 → 인증번호 줄(이메일 바로 아래) → 확인 → [이메일 변경] → 토스트 + 좌측 하단', async () => {
    const base = Date.now();
    handlers['POST /api/email-verifications'] = () => ok({ verificationId: 5, expireDate: new Date(base + 300000).toISOString(), resendAvailableDate: new Date(base + 60000).toISOString() });
    handlers['POST /api/email-verifications/5/verify'] = () => ok({ isVerified: true });
    handlers['POST /api/users/me/email'] = () => ok({ ...ME, email: 'new@example.com' });
    const { wrapper } = await mountProfile();
    await wrapper.find('#email-input').setValue('new@example.com');
    await button(wrapper, '인증번호 발송').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/email-verifications').body).toEqual({ email: 'new@example.com', purpose: 'change_email' });
    expect(wrapper.find('#email-input-code').exists()).toBe(true);
    await wrapper.find('#email-input-code').setValue('123456');
    await button(wrapper, '확인').trigger('click');
    await flushPromises();
    expect(button(wrapper, '변경')).toBeDefined();
    await button(wrapper, '이메일 변경').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/users/me/email').body).toEqual({ email: 'new@example.com', verificationId: 5 });
    expect(wrapper.find('.toast-box').text()).toContain('이메일을 바꿨습니다.');
    expect(wrapper.find('.profile-email').text()).toBe('new@example.com');
  });
});

describe('비밀번호 변경', () => {
  test('빈 값·형식·불일치 검사 → 현재 비밀번호 틀림 문구 → 잠김 토스트 → 성공하면 세 칸 비움', async () => {
    let attempt = 0;
    handlers['POST /api/users/me/password'] = () => {
      attempt += 1;
      if (attempt === 1) {
        return fail(400, 'CURRENT_PASSWORD_MISMATCH');
      }
      return attempt === 2 ? fail(423, 'LOGIN_LOCKED', '비밀번호를 5번 틀려 로그인이 잠겼습니다. 7분 뒤 다시 시도해 주세요.') : ok({ isChanged: true });
    };
    const { wrapper } = await mountProfile();
    await button(wrapper, '비밀번호 변경').trigger('click');
    expect(wrapper.findAll('.message.is-error').map((m) => m.text())).toEqual([
      '현재 비밀번호를 입력해 주세요.', '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.', '비밀번호가 일치하지 않습니다.',
    ]);
    await wrapper.find('#current-password').setValue('wrong123!');
    await wrapper.find('#new-password').setValue('newpw123!');
    await wrapper.find('#new-password-check').setValue('newpw123!');
    await button(wrapper, '비밀번호 변경').trigger('click');
    await flushPromises();
    expect(wrapper.find('.message.is-error').text()).toBe('현재 비밀번호가 맞지 않습니다.');
    await button(wrapper, '비밀번호 변경').trigger('click');
    await flushPromises();
    expect(wrapper.find('.toast-box.is-error').text()).toContain('비밀번호를 여러 번 틀려 7분 동안 확인할 수 없습니다.');
    await button(wrapper, '비밀번호 변경').trigger('click');
    await flushPromises();
    expect(wrapper.find('#current-password').element.value).toBe('');
    expect(wrapper.find('.toast-box').text()).toContain('비밀번호를 바꿨습니다.');
  });
});

describe('회원 탈퇴', () => {
  test('막는 팀이 있으면 막힘 창 + 팀 링크 → 팀 정보 탭', async () => {
    handlers['GET /api/users/me/withdrawal-check'] = () => ok({ blockingTeams: [{ teamId: 3, name: '디자인팀' }], soloTeams: [] });
    handlers['GET /api/teams/3'] = () => ok({ teamId: 3, name: '디자인팀', myRole: 'owner', ownerNickname: '홍길동', memberCount: 2, createDate: '2026-11-01T00:00:00Z' });
    handlers['GET /api/teams/3/members'] = () => ok({ members: [] });
    handlers['GET /api/teams/3/invitations'] = () => ok({ invitations: [] });
    handlers['GET /api/teams'] = () => ok({ teams: [{ teamId: 3, name: '디자인팀', myRole: 'owner' }] });
    const { wrapper, router } = await mountProfile();
    await button(wrapper, '회원 탈퇴').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x').text()).toContain('탈퇴할 수 없습니다');
    await wrapper.find('.team-list-x a').trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/teams/3/info'), { timeout: 5000 });
  });
  test('혼자인 팀 안내 → 비밀번호 넣어야 [다음] → 2단계 [탈퇴] → 비밀번호 틀림이면 1단계로, 맞으면 /login + 토스트', async () => {
    handlers['GET /api/users/me/withdrawal-check'] = () => ok({ blockingTeams: [], soloTeams: [{ teamId: 4, name: '혼자팀' }] });
    let attempt = 0;
    handlers['POST /api/users/me/withdraw'] = () => {
      attempt += 1;
      if (attempt === 1) {
        return fail(400, 'CURRENT_PASSWORD_MISMATCH');
      }
      handlers['GET /api/sessions/me'] = () => fail(401, 'UNAUTHORIZED');
      return ok({ isWithdrawn: true });
    };
    const { wrapper, router } = await mountProfile();
    await button(wrapper, '회원 탈퇴').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x').text()).toContain('아래 팀은 나 혼자라 함께 해체됩니다.');
    expect(wrapper.find('.team-list-x').text()).toContain('혼자팀');
    expect(button(wrapper, '다음').attributes('disabled')).toBeDefined();
    await wrapper.find('#withdraw-password').setValue('wrong123!');
    await button(wrapper, '다음').trigger('click');
    expect(wrapper.find('.modal-x').text()).toContain('정말 탈퇴할까요? 되돌릴 수 없습니다.');
    await button(wrapper, '탈퇴').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x .message').text()).toBe('현재 비밀번호가 맞지 않습니다.');
    await button(wrapper, '다음').trigger('click');
    await button(wrapper, '탈퇴').trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'), { timeout: 5000 });
    expect(wrapper.find('.toast-box').text()).toContain('탈퇴가 완료되었습니다.');
  });
  test('그사이 막힘(409) → 받은 팀 목록으로 막힘 창', async () => {
    handlers['GET /api/users/me/withdrawal-check'] = () => ok({ blockingTeams: [], soloTeams: [] });
    handlers['POST /api/users/me/withdraw'] = () => fail(409, 'TEAM_OWNER_CANNOT_WITHDRAW', '', { teams: [{ teamId: 8, name: '새로막힌팀' }] });
    const { wrapper } = await mountProfile();
    await button(wrapper, '회원 탈퇴').trigger('click');
    await flushPromises();
    await wrapper.find('#withdraw-password').setValue('abcd123!');
    await button(wrapper, '다음').trigger('click');
    await button(wrapper, '탈퇴').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-x').text()).toContain('탈퇴할 수 없습니다');
    expect(wrapper.find('.team-list-x').text()).toContain('새로막힌팀');
  });
});
