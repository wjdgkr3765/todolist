// 알람 목록·타이머·팝업으로 띄울 알람·브라우저 알림 (api.md 6.13, D-177~D-185)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../api/client.js';
import { koreaNowTime } from '../utils/alarm.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// 다음 울릴 시각을 조금 지나서 확인한다 (서버가 지금 이전인 알람만 처리)
const CHECK_DELAY_MS = 500;
// 브라우저 알림 켜기/끄기는 이 브라우저에만 저장한다 (D-182)
const BROWSER_KEY = 'todo.browserAlarm';

function readPermission() {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported';
}
function readBrowserOn() {
  try {
    return window.localStorage.getItem(BROWSER_KEY) === 'on';
  } catch {
    return false;
  }
}
function saveBrowserOn(isOn) {
  try {
    window.localStorage.setItem(BROWSER_KEY, isOn ? 'on' : 'off');
  } catch {
    // 저장할 수 없으면 이번 화면에서만 쓴다
  }
}

export const useAlarmsStore = defineStore('alarms', () => {
  const alarms = ref([]);
  const isLoading = ref(false);
  const fired = ref([]);
  const permission = ref(readPermission());
  const isBrowserOn = ref(readBrowserOn());
  let timer = null;

  // 켜진 알람 중 가장 이른 다음 시각에 맞춰 확인 타이머를 건다. 24시간보다 멀면 24시간 뒤에 다시 계산
  function schedule() {
    clearTimeout(timer);
    const times = alarms.value.filter((alarm) => alarm.isOn && alarm.nextFireDate).map((alarm) => new Date(alarm.nextFireDate).getTime());
    if (times.length === 0) {
      return;
    }
    const wait = Math.min(...times) - Date.now();
    timer = wait > DAY_MS
      ? setTimeout(() => fetchAlarms().catch(() => {}), DAY_MS)
      : setTimeout(() => check().catch(() => {}), Math.max(wait, 0) + CHECK_DELAY_MS);
  }

  async function fetchAlarms() {
    isLoading.value = alarms.value.length === 0;
    try {
      alarms.value = (await apiRequest('GET', '/api/alarms')).alarms;
      schedule();
    } finally {
      isLoading.value = false;
    }
  }

  async function save(alarmId, input) {
    const data = alarmId
      ? await apiRequest('POST', `/api/alarms/${alarmId}/update`, { body: input })
      : await apiRequest('POST', '/api/alarms', { body: input });
    await fetchAlarms();
    return data.alarm;
  }

  async function toggle(alarmId, isOn) {
    const { alarm } = await apiRequest('POST', `/api/alarms/${alarmId}/toggle`, { body: { isOn } });
    alarms.value = alarms.value.map((item) => (item.alarmId === alarmId ? alarm : item));
    schedule();
    return alarm;
  }

  async function remove(alarmId) {
    await apiRequest('POST', `/api/alarms/${alarmId}/delete`);
    alarms.value = alarms.value.filter((item) => item.alarmId !== alarmId);
    schedule();
  }

  // 바탕화면 알림: 허용했고 켜져 있고 이 탭이 안 보일 때만 (D-179, D-182)
  function notifyBrowser(list) {
    if (permission.value !== 'granted' || !isBrowserOn.value || document.visibilityState === 'visible') {
      return;
    }
    list.forEach((item) => {
      const notice = new window.Notification('TODO 알람', { body: `${koreaNowTime(new Date(item.fireDate))} ${item.title ?? ''}`.trim() });
      notice.onclick = () => { window.focus(); notice.close(); };
    });
  }

  // 울릴 때가 된 알람 확인 (POST /api/alarms/check). 제때 울린 알람은 팝업, 처리한 게 있으면 목록을 다시 불러온다
  async function check() {
    const data = await apiRequest('POST', '/api/alarms/check');
    if (data.fired.length > 0) {
      fired.value = [...fired.value, ...data.fired];
      notifyBrowser(data.fired);
    }
    await fetchAlarms();
    return data;
  }

  function closePopup() {
    fired.value = [];
  }

  // 브라우저 알림 스위치 (D-183). 켜면 허용 전이면 브라우저에 묻는다. 결과 permission 을 돌려준다
  async function setBrowserOn(isOn) {
    if (!isOn) {
      isBrowserOn.value = false;
      saveBrowserOn(false);
      return permission.value;
    }
    if (permission.value === 'default') {
      permission.value = await window.Notification.requestPermission();
    }
    isBrowserOn.value = permission.value === 'granted';
    saveBrowserOn(isBrowserOn.value);
    return permission.value;
  }

  function clear() {
    clearTimeout(timer);
    alarms.value = [];
    fired.value = [];
  }

  return {
    alarms, isLoading, fired, permission, isBrowserOn, fetchAlarms, save, toggle, remove, check, closePopup, setBrowserOn, clear,
  };
});
