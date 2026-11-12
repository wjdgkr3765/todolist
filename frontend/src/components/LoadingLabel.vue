<!-- 로딩 중인 버튼 글자: 작은 스피너 + "~ 중..." (overview.md 9 공통 화면 규칙) -->
<script setup>
defineProps({
  isLoading: { type: Boolean, required: true },
  text: { type: String, required: true },
  loadingText: { type: String, required: true },
});
</script>

<template>
  <template v-if="isLoading">
    <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ loadingText }}
  </template>
  <template v-else>{{ text }}</template>
</template>
