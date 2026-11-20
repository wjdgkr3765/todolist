<!-- 알람 창 (MainLayout_screen.md 알람, D-180, D-183~D-188) -->
<script setup>
import { storeToRefs } from 'pinia';
import { useAlarmsStore } from '../stores/alarms.js';
import { useToastStore } from '../stores/toast.js';
import { ALARM_LIMIT, fireText, repeatSummary } from '../utils/alarm.js';

const emit = defineEmits(['close', 'open-form']);
const store = useAlarmsStore();
const toastStore = useToastStore();
const { alarms, isLoading, permission, isBrowserOn } = storeToRefs(store);

function add() {
  if (alarms.value.length >= ALARM_LIMIT) {
    toastStore.show('error', '알람은 30개까지 만들 수 있습니다.');
    return;
  }
  emit('open-form', null);
}

async function toggle(alarm, event) {
  const isOn = event.target.checked;
  try {
    const saved = await store.toggle(alarm.alarmId, isOn);
    if (isOn) {
      toastStore.show('success', `${fireText(saved.nextFireDate)}에 울립니다.`);
    }
  } catch (error) {
    event.target.checked = !isOn;
    if (error.status === 404) {
      await store.fetchAlarms().catch(() => {});
    }
  }
}

async function toggleBrowser(event) {
  const isOn = event.target.checked;
  const result = await store.setBrowserOn(isOn);
  event.target.checked = isBrowserOn.value;
  if (isOn && result === 'granted') {
    toastStore.show('success', '다른 탭을 보고 있어도 알려 드립니다.');
  }
}

// …로 줄어든 이름·요약만 마우스를 올리면 전체 글자 (D-188)
function showFullText(event) {
  const text = event.target.closest('.alarm-item-name, .alarm-item-sub');
  if (!text) {
    return;
  }
  if (text.scrollWidth > text.clientWidth) {
    text.title = text.textContent;
  } else {
    text.removeAttribute('title');
  }
}
</script>

<template>
  <div class="popover-box notification-box" role="dialog" aria-label="알람" @click.stop @mouseover="showFullText">
    <div class="notification-title alarm-title">알람
      <div class="alarm-title-tools">
        <span v-if="permission !== 'unsupported'" class="alarm-browser">
          <span class="alarm-browser-label">브라우저 알림</span>
          <span class="form-check form-switch m-0">
            <input class="form-check-input" type="checkbox" role="switch" aria-label="브라우저 알림"
              :checked="permission === 'granted' && isBrowserOn" :disabled="permission === 'denied'" @change="toggleBrowser" />
          </span>
        </span>
        <button type="button" class="nav-add" aria-label="알람 추가" @click="add"><i class="bi bi-plus-lg"></i></button>
      </div>
    </div>
    <div v-if="permission === 'denied'" class="alarm-denied">브라우저에서 알림이 차단되어 있습니다. 주소창 왼쪽 아이콘에서 허용해 주세요.</div>
    <div v-if="isLoading" class="notification-empty"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
    <div v-else-if="alarms.length > 0" class="notification-list">
      <div v-for="alarm in alarms" :key="alarm.alarmId" class="alarm-item" :class="{ 'is-off': !alarm.isOn }">
        <button type="button" class="alarm-item-main" @click="emit('open-form', alarm)">
          <span class="alarm-item-time-line">
            <span class="alarm-item-time">{{ alarm.time }}</span>
            <span v-if="alarm.isHolidayOff" class="alarm-item-holiday">공휴일에는 끄기</span>
          </span>
          <span v-if="alarm.title" class="alarm-item-name">{{ alarm.title }}</span>
          <span class="alarm-item-sub">{{ repeatSummary(alarm.weekdays, alarm.date) }}</span>
        </button>
        <span class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" role="switch" aria-label="알람 켜기" :checked="alarm.isOn" @change="toggle(alarm, $event)" />
        </span>
      </div>
    </div>
    <div v-else class="notification-empty"><i class="bi bi-alarm"></i>알람이 없습니다.</div>
  </div>
</template>
