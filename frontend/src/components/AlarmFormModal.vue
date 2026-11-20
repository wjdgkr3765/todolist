<!-- 알람 설정 모달 (MainLayout_screen.md 알람, D-178, D-181) -->
<script setup>
import { computed, reactive, ref } from 'vue';
import LoadingLabel from './LoadingLabel.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { useAlarmsStore } from '../stores/alarms.js';
import { useToastStore } from '../stores/toast.js';
import { addDaysText, koreaToday } from '../utils/format.js';
import {
  ALARM_TITLE_MAX, WEEK_ORDER, autoDate, dayLabel, dayName, fireText, isPassed, repeatSummary,
} from '../utils/alarm.js';

const props = defineProps({
  // null 이면 추가, 있으면 수정
  alarm: { type: Object, default: null },
});
const emit = defineEmits(['close']);
const store = useAlarmsStore();
const toastStore = useToastStore();

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const pad = (value) => String(value).padStart(2, '0');

const [startHour, startMinute] = (props.alarm?.time ?? '09:00').split(':').map(Number);
const form = reactive({
  hour: startHour,
  minute: startMinute,
  date: props.alarm && props.alarm.weekdays.length === 0 ? props.alarm.date : null,
  weekdays: [...(props.alarm?.weekdays ?? [])],
  isHolidayOff: props.alarm?.isHolidayOff ?? false,
  title: props.alarm?.title ?? '',
});
const errors = reactive({ title: '', time: '' });
const isSaving = ref(false);
const isConfirmOpen = ref(false);
const isDeleting = ref(false);
const dateInput = ref(null);

const time = computed(() => `${pad(form.hour)}:${pad(form.minute)}`);
const minDate = koreaToday();
const maxDate = addDaysText(minDate, 365);
const canHolidayOff = computed(() => form.weekdays.length > 0);
const dateText = computed(() => {
  if (form.weekdays.length > 0) {
    return repeatSummary(form.weekdays, null);
  }
  if (form.date) {
    return dayLabel(form.date);
  }
  const auto = autoDate(time.value);
  return `${auto === koreaToday() ? '오늘' : '내일'} · ${dayLabel(auto)}`;
});

function onTimeChange() {
  errors.time = '';
}

function openDatePicker() {
  try {
    dateInput.value.showPicker();
  } catch {
    dateInput.value.focus();
  }
}

// 날짜를 고르면 요일을 푼다 (D-178)
function pickDate(event) {
  if (!event.target.value) {
    return;
  }
  form.date = event.target.value;
  form.weekdays = [];
  form.isHolidayOff = false;
  errors.time = '';
}

// 요일을 고르면 날짜를 푼다. 모두 풀면 공휴일에는 끄기도 끈다 (D-178)
function toggleDay(day) {
  form.weekdays = form.weekdays.includes(day) ? form.weekdays.filter((value) => value !== day) : [...form.weekdays, day];
  if (form.weekdays.length > 0) {
    form.date = null;
  } else {
    form.isHolidayOff = false;
  }
  errors.time = '';
}

function validate() {
  errors.title = form.title.trim().length > ALARM_TITLE_MAX ? '알람 이름은 30자 이하로 입력해 주세요.' : '';
  errors.time = form.date && form.weekdays.length === 0 && isPassed(form.date, time.value) ? '이미 지난 시각입니다. 시간이나 날짜를 바꿔 주세요.' : '';
  return !errors.title && !errors.time;
}

async function save() {
  if (isSaving.value || !validate()) {
    return;
  }
  isSaving.value = true;
  try {
    const saved = await store.save(props.alarm?.alarmId ?? null, {
      title: form.title.trim() || null,
      time: time.value,
      date: form.weekdays.length > 0 ? null : form.date,
      weekdays: [...form.weekdays].sort((a, b) => a - b),
      isHolidayOff: canHolidayOff.value && form.isHolidayOff,
    });
    emit('close');
    toastStore.show('success', '알람을 저장했습니다.', `${fireText(saved.nextFireDate)}에 울립니다.`);
  } catch (error) {
    if (error.code === 'ALARM_TIME_PASSED') {
      errors.time = '이미 지난 시각입니다. 시간이나 날짜를 바꿔 주세요.';
    } else if (error.code === 'ALARM_LIMIT_EXCEEDED') {
      toastStore.show('error', '알람은 30개까지 만들 수 있습니다.');
    } else if (error.status === 404) {
      emit('close');
      await store.fetchAlarms().catch(() => {});
    }
  } finally {
    isSaving.value = false;
  }
}

async function remove() {
  isDeleting.value = true;
  try {
    await store.remove(props.alarm.alarmId);
    emit('close');
    toastStore.show('success', '알람을 삭제했습니다.');
  } catch (error) {
    if (error.status === 404) {
      emit('close');
      await store.fetchAlarms().catch(() => {});
    }
  } finally {
    isDeleting.value = false;
    isConfirmOpen.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('close')">
    <div class="modal-x" role="dialog" :aria-label="alarm ? '알람 수정' : '알람 추가'">
      <div class="modal-title-x">{{ alarm ? '알람 수정' : '알람 추가' }}</div>
      <div class="alarm-time">
        <select v-model.number="form.hour" aria-label="시" @change="onTimeChange">
          <option v-for="hour in HOURS" :key="hour" :value="hour">{{ hour }}시</option>
        </select>
        <select v-model.number="form.minute" aria-label="분" @change="onTimeChange">
          <option v-for="minute in MINUTES" :key="minute" :value="minute">{{ pad(minute) }}분</option>
        </select>
      </div>
      <div v-if="errors.time" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ errors.time }}</span></div>
      <div class="alarm-date-line">
        <span>{{ dateText }}</span>
        <button type="button" class="alarm-date-button" aria-label="날짜 고르기" @click="openDatePicker"><i class="bi bi-calendar3"></i></button>
        <input ref="dateInput" type="date" class="alarm-date-input" tabindex="-1" aria-hidden="true" :min="minDate" :max="maxDate"
          :value="form.date ?? ''" @change="pickDate" />
      </div>
      <div class="alarm-weekdays">
        <button v-for="day in WEEK_ORDER" :key="day" type="button" class="alarm-day"
          :class="{ 'is-sun': day === 7, 'is-sat': day === 6, 'is-on': form.weekdays.includes(day) }" @click="toggleDay(day)">{{ dayName(day) }}</button>
      </div>
      <div class="alarm-switch-row" :class="{ 'is-disabled': !canHolidayOff }">
        <div>
          <div class="alarm-switch-label">공휴일에는 끄기</div>
          <div class="alarm-switch-help">{{ canHolidayOff ? '고른 요일이 공휴일이면 건너뜁니다.' : '요일을 고르면 켤 수 있습니다.' }}</div>
        </div>
        <div class="form-check form-switch m-0">
          <input v-model="form.isHolidayOff" class="form-check-input" type="checkbox" role="switch" aria-label="공휴일에는 끄기" :disabled="!canHolidayOff" />
        </div>
      </div>
      <div class="field" style="margin-bottom: 0">
        <div class="control no-icon" :class="{ 'is-invalid': errors.title }">
          <input v-model="form.title" type="text" maxlength="30" placeholder="알람 이름" aria-label="알람 이름" @input="errors.title = ''" />
        </div>
        <div v-if="errors.title" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ errors.title }}</span></div>
      </div>
      <div class="modal-actions alarm-actions">
        <button v-if="alarm" type="button" class="btn-x btn-danger-soft-x" @click="isConfirmOpen = true">삭제</button>
        <span class="flex-grow-1"></span>
        <button type="button" class="btn-x btn-outline-x" @click="emit('close')">취소</button>
        <button type="button" class="btn-x btn-primary-x" :disabled="isSaving" @click="save">
          <LoadingLabel :is-loading="isSaving" loading-text="저장 중..." text="저장" />
        </button>
      </div>
    </div>
    <ConfirmDialog v-if="isConfirmOpen" title="알람 삭제" text="알람을 삭제할까요?" :is-loading="isDeleting"
      @confirm="remove" @cancel="isConfirmOpen = false" />
  </div>
</template>
