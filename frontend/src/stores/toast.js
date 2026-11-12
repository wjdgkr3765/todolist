// 화면 위쪽 가운데 알림 (overview.md 9 공통 화면 규칙: 안내·성공은 초록 띠, 오류는 빨강 띠)
import { defineStore } from 'pinia';
import { ref } from 'vue';

const SHOW_MS = 3000;

export const useToastStore = defineStore('toast', () => {
  const toast = ref(null);
  let hideTimer = null;

  // type: 'success' | 'error', title: 첫 줄, sub: 둘째 줄 (없으면 '')
  function show(type, title, sub = '') {
    clearTimeout(hideTimer);
    toast.value = { type, title, sub };
    hideTimer = setTimeout(() => { toast.value = null; }, SHOW_MS);
  }

  function showServerError() {
    show('error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
  }

  return { toast, show, showServerError };
});
