<!-- 알람 팝업 (MainLayout_screen.md 알람, D-179). 바깥 클릭으로 닫히지 않는다 ([확인]·Esc) -->
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAlarmsStore } from '../stores/alarms.js';
import { koreaNowTime } from '../utils/alarm.js';

const store = useAlarmsStore();
const { fired } = storeToRefs(store);
const okButton = ref(null);
const items = computed(() => [...fired.value].sort((a, b) => a.fireDate.localeCompare(b.fireDate)));

onMounted(async () => {
  await nextTick();
  okButton.value?.focus();
});
</script>

<template>
  <div class="modal-backdrop-x" @keydown.esc="store.closePopup()">
    <div class="modal-x alarm-popup" role="alertdialog" aria-label="알람">
      <i class="bi bi-alarm alarm-popup-icon"></i>
      <div v-for="item in items" :key="`${item.alarmId}-${item.fireDate}`" class="alarm-popup-item">
        <div class="alarm-popup-time">{{ koreaNowTime(new Date(item.fireDate)) }}</div>
        <div class="alarm-popup-name">{{ item.title ?? '알람' }}</div>
      </div>
      <button ref="okButton" type="button" class="btn-x btn-primary-x alarm-popup-ok" @click="store.closePopup()">확인</button>
    </div>
  </div>
</template>
