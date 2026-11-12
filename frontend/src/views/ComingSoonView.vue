<!-- 아직 만들지 않은 메뉴 화면 자리 (MainLayout_screen.md 7 "준비 중 제목"). 그 화면을 만들면 경로에서 바꾼다 -->
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const TITLES = { tasks: '작업', calendar: '캘린더', info: '팀 정보', history: '히스토리', reports: '일일보고', profile: '회원정보 수정' };
const route = useRoute();
const title = computed(() => TITLES[route.meta.tab ?? route.name] ?? '');
</script>

<template>
  <h1 class="page-title">{{ title }}</h1>
</template>
