// 알람 (MainLayout_screen.md 알람, D-177~D-188): 알람 창, 설정 모달, 켜기/끄기, 팝업, 놓친 알람
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router/index.js';

vi.mock('../src/realtime/socket.js', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  onRealtime: vi.fn(() => () => {}),
}));

// 지금: 2026-11-11 (수) 14:30 한국 시간
const NOW = new Date('2026-11-11T05:30:00Z');
const ME = { userId: 1, loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com' };
const WORK = { alarmId: 1, title: '출근', time: '06:00', date: null, weekdays: [1, 2, 3, 4, 5], isHolidayOff: true, isOn: true, nextFireDate: '2026-11-11T21:00:00Z' };
const ONCE_OFF = { alarmId: 2, title: '주간 회의 자료 보내기', time: '09:00', date: '2026-11-10', weekdays: [], isHolidayOff: false, isOn: false, nextFireDate: null };
const DAILY = { alarmId: 3, title: null, time: '21:00', date: null, weekdays: [1, 2, 3, 4, 5, 6, 7], isHolidayOff: false, isOn: true, nextFireDate: '2026-11-11T12:00:00Z' };
const MISSED = { notificationId: 21, notificationType: 'alarm_missed', teamId: null, teamName: null, taskId: null, taskTitle: null, taskEndDate: null, taskEndTime: null, senderNickname: null, alarmId: 1, alarmTitle: '출근', isRead: false, createDate: '2026-11-10T21:00:00Z' };

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
let handlers;
let calls;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  calls = [];
  handlers = {
    'GET /api/sessions/me': () => ok(ME),
    'GET /api/teams': () => ok({ teams: [] }),
    'GET /api/notifications': () => ok({ notifications: [], unreadCount: 0 }),
    'POST /api/notifications/read': () => ok({ unreadCount: 0 }),
    'GET /api/personal/todos': () => ok({ todos: [] }),
    'GET /api/personal/tasks': () => ok({ tasks: [] }),
    'GET /api/alarms': () => ok({ alarms: [WORK, ONCE_OFF, DAILY] }),
    'POST /api/alarms/check': () => ok({ fired: [], unreadCount: 0 }),
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function mountLayout() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  router.push('/personal/tasks');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await vi.waitFor(() => expect(wrapper.find('.main-layout').exists()).toBe(true), { timeout: 5000 });
  await flushPromises();
  return wrapper;
}
const openAlarms = async (wrapper) => { await wrapper.find('[aria-label="알람"]').trigger('click'); await flushPromises(); };
const button = (wrapper, label) => wrapper.findAll('button').find((b) => b.text() === label);
const toastText = (wrapper) => wrapper.find('.toast-box').text();

describe('알람 창', () => {
  test('화면을 열면 알람을 확인하고, 버튼을 누르면 시각 / 이름 / 반복 요약 목록 (D-186, D-187)', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
    const wrapper = await mountLayout();
    expect(calls.map((c) => c.key)).toContain('POST /api/alarms/check');
    await openAlarms(wrapper);
    const items = wrapper.findAll('.alarm-item');
    expect(items.map((item) => item.find('.alarm-item-time').text())).toEqual(['06:00', '09:00', '21:00']);
    expect(items[0].find('.alarm-item-name').text()).toBe('출근');
    expect(items[0].find('.alarm-item-sub').text()).toBe('매주 월, 화, 수, 목, 금');
    expect(items[0].find('.alarm-item-holiday').text()).toBe('공휴일에는 끄기');
    expect(items[1].classes()).toContain('is-off');
    expect(items[1].find('.alarm-item-sub').text()).toBe('11.10 (화)');
    expect(items[2].find('.alarm-item-name').exists()).toBe(false);
    expect(items[2].find('.alarm-item-sub').text()).toBe('매일');
    expect(wrapper.find('.alarm-browser-label').text()).toBe('브라우저 알림');
    expect(wrapper.find('.alarm-browser-label').attributes('title')).toBeUndefined();
  });
  test('알람이 없으면 "알람이 없습니다."', async () => {
    handlers['GET /api/alarms'] = () => ok({ alarms: [] });
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    expect(wrapper.find('.notification-box').text()).toContain('알람이 없습니다.');
  });
  test('스위치를 켜면 toggle 하고 "{날짜 시각}에 울립니다." 토스트', async () => {
    handlers['POST /api/alarms/2/toggle'] = () => ok({ alarm: { ...ONCE_OFF, date: '2026-11-12', isOn: true, nextFireDate: '2026-11-12T00:00:00Z' } });
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    await wrapper.findAll('.alarm-item')[1].find('input[type=checkbox]').setValue(true);
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/alarms/2/toggle').body).toEqual({ isOn: true });
    expect(toastText(wrapper)).toContain('11.12 (목) 09:00에 울립니다.');
    expect(wrapper.findAll('.alarm-item')[1].classes()).not.toContain('is-off');
  });
  test('30개면 [+] 를 눌러도 모달을 열지 않고 오류 토스트', async () => {
    handlers['GET /api/alarms'] = () => ok({ alarms: Array.from({ length: 30 }, (_, i) => ({ ...DAILY, alarmId: i + 1 })) });
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    await wrapper.find('[aria-label="알람 추가"]').trigger('click');
    expect(wrapper.find('[aria-label="알람 추가"][role=dialog]').exists()).toBe(false);
    expect(toastText(wrapper)).toContain('알람은 30개까지 만들 수 있습니다.');
  });
});

describe('알람 설정 모달 (D-178, D-181)', () => {
  test('추가: 9시 00분, 날짜·요일 없으면 "내일", 요일을 고르면 "매주 …" + 공휴일에는 끄기를 켤 수 있고 저장', async () => {
    handlers['POST /api/alarms'] = () => ok({ alarm: { ...WORK, alarmId: 9, title: '운동', time: '19:30', weekdays: [1, 3], nextFireDate: '2026-11-11T10:30:00Z' } });
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    await wrapper.find('[aria-label="알람 추가"]').trigger('click');
    await flushPromises();
    const modal = wrapper.find('.modal-x');
    expect(modal.find('.modal-title-x').text()).toBe('알람 추가');
    expect(modal.find('select[aria-label="시"]').element.value).toBe('9');
    expect(modal.find('.alarm-date-line').text()).toBe('내일 · 11.12 (목)');
    expect(modal.find('input[aria-label="공휴일에는 끄기"]').element.disabled).toBe(true);
    await modal.find('select[aria-label="시"]').setValue('19');
    expect(modal.find('.alarm-date-line').text()).toBe('오늘 · 11.11 (수)');
    await modal.find('select[aria-label="분"]').setValue('30');
    const days = modal.findAll('.alarm-day');
    expect(days.map((d) => d.text())).toEqual(['일', '월', '화', '수', '목', '금', '토']);
    await days[1].trigger('click');
    await days[3].trigger('click');
    expect(modal.find('.alarm-date-line').text()).toBe('매주 월, 수');
    await modal.find('input[aria-label="공휴일에는 끄기"]').setValue(true);
    await modal.find('input[aria-label="알람 이름"]').setValue('  운동  ');
    await button(modal, '저장').trigger('click');
    await flushPromises();
    expect(calls.find((c) => c.key === 'POST /api/alarms').body).toEqual({ title: '운동', time: '19:30', date: null, weekdays: [1, 3], isHolidayOff: true });
    expect(wrapper.find('.modal-x').exists()).toBe(false);
    expect(toastText(wrapper)).toContain('알람을 저장했습니다.');
    expect(toastText(wrapper)).toContain('11.11 (수) 19:30에 울립니다.');
  });
  test('날짜를 고르면 요일이 풀리고, 지난 시각이면 저장하지 않고 오류 문구', async () => {
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    await wrapper.find('[aria-label="알람 추가"]').trigger('click');
    await flushPromises();
    const modal = wrapper.find('.modal-x');
    await modal.findAll('.alarm-day')[2].trigger('click');
    await modal.find('input[type=date]').setValue('2026-11-11');
    expect(modal.findAll('.alarm-day.is-on')).toHaveLength(0);
    expect(modal.find('.alarm-date-line').text()).toBe('11.11 (수)');
    await button(modal, '저장').trigger('click');
    await flushPromises();
    expect(modal.text()).toContain('이미 지난 시각입니다. 시간이나 날짜를 바꿔 주세요.');
    expect(calls.some((c) => c.key === 'POST /api/alarms')).toBe(false);
  });
  test('수정: 값이 채워지고 [삭제] → 확인창 → 삭제', async () => {
    handlers['POST /api/alarms/1/delete'] = () => ok({ isDeleted: true });
    const wrapper = await mountLayout();
    await openAlarms(wrapper);
    await wrapper.findAll('.alarm-item-main')[0].trigger('click');
    await flushPromises();
    const modal = wrapper.find('.modal-x');
    expect(modal.find('.modal-title-x').text()).toBe('알람 수정');
    expect(modal.find('select[aria-label="시"]').element.value).toBe('6');
    expect(modal.find('input[aria-label="공휴일에는 끄기"]').element.checked).toBe(true);
    expect(modal.find('input[aria-label="알람 이름"]').element.value).toBe('출근');
    await button(modal, '삭제').trigger('click');
    await flushPromises();
    const confirm = wrapper.findAll('.modal-x').at(-1);
    expect(confirm.text()).toContain('알람을 삭제할까요?');
    await confirm.findAll('button').at(-1).trigger('click');
    await flushPromises();
    expect(calls.map((c) => c.key)).toContain('POST /api/alarms/1/delete');
    expect(toastText(wrapper)).toContain('알람을 삭제했습니다.');
  });
});

describe('울릴 때 (D-179)', () => {
  test('확인에서 제때 울린 알람이 오면 팝업 (시각·이름, 없으면 "알람"), [확인] 으로 닫는다', async () => {
    handlers['POST /api/alarms/check'] = () => ok({ fired: [{ alarmId: 1, title: '출근', fireDate: '2026-11-10T21:00:00Z' }, { alarmId: 3, title: null, fireDate: '2026-11-11T12:00:00Z' }], unreadCount: 0 });
    const wrapper = await mountLayout();
    const popup = wrapper.find('.alarm-popup');
    expect(popup.findAll('.alarm-popup-time').map((t) => t.text())).toEqual(['06:00', '21:00']);
    expect(popup.findAll('.alarm-popup-name').map((t) => t.text())).toEqual(['출근', '알람']);
    await button(wrapper, '확인').trigger('click');
    expect(wrapper.find('.alarm-popup').exists()).toBe(false);
  });
  test('놓친 알람 알림을 누르면 알림 창을 닫고 알람 창을 연다', async () => {
    handlers['GET /api/notifications'] = () => ok({ notifications: [MISSED], unreadCount: 1 });
    const wrapper = await mountLayout();
    await wrapper.find('[aria-label="알림"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('.notification-item').text()).toContain('놓친 알람: 출근');
    await wrapper.find('.notification-item .notification-link').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=dialog][aria-label="알림"]').exists()).toBe(false);
    expect(wrapper.find('[role=dialog][aria-label="알람"]').exists()).toBe(true);
  });
});
