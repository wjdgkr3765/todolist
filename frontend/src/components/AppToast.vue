<script setup>
import { storeToRefs } from 'pinia';
import { useToastStore } from '../stores/toast.js';

const { toast } = storeToRefs(useToastStore());
</script>

<template>
  <div
    v-if="toast"
    class="toast-box"
    :class="{ 'is-error': toast.type === 'error' }"
    :role="toast.type === 'error' ? 'alert' : 'status'"
  >
    <span class="toast-icon">
      <i class="bi" :class="toast.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'"></i>
    </span>
    <div>
      {{ toast.title }}
      <div v-if="toast.sub" class="toast-sub">{{ toast.sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.toast-box {
  position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 1080;
  width: calc(100% - 32px); max-width: 420px; display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 14px; padding: 14px 16px; box-shadow: 0 16px 40px -12px rgba(17, 24, 39, 0.3);
  border-left: 5px solid var(--color-success); font-size: 15px; font-weight: 600;
}
.toast-box.is-error { border-left-color: var(--color-danger); }
.toast-icon { font-size: 22px; color: var(--color-success); display: flex; }
.toast-box.is-error .toast-icon { color: var(--color-danger); }
.toast-sub { font-size: 13px; font-weight: 400; color: var(--color-sub); margin-top: 2px; }
</style>
