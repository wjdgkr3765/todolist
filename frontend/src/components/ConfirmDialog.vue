<!-- 확인창 (삭제 확인 등). 바깥 클릭·Esc·취소로 닫는다 -->
<script setup>
import LoadingLabel from './LoadingLabel.vue';

defineProps({
  title: { type: String, required: true },
  target: { type: String, default: '' },
  sub: { type: String, default: '' },
  confirmText: { type: String, default: '삭제' },
  loadingText: { type: String, default: '삭제 중...' },
  isLoading: { type: Boolean, default: false },
  isDanger: { type: Boolean, default: true },
});
const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <div class="modal-x" role="dialog" :aria-label="title">
      <div class="modal-title-x">{{ title }}</div>
      <div v-if="target" class="confirm-target">{{ target }}</div>
      <div v-if="sub" class="modal-sub">{{ sub }}</div>
      <slot></slot>
      <div class="modal-actions">
        <button type="button" class="btn-x btn-outline-x" @click="emit('cancel')">취소</button>
        <button type="button" class="btn-x" :class="isDanger ? 'btn-danger-x' : 'btn-primary-x'" :disabled="isLoading" @click="emit('confirm')">
          <LoadingLabel :is-loading="isLoading" :loading-text="loadingText" :text="confirmText" />
        </button>
      </div>
    </div>
  </div>
</template>
