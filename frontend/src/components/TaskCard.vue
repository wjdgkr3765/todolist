<!-- 작업 카드 (TaskView_screen.md: 제목, "~ 종료일", 기한 지남, 팀이면 작업자) -->
<script setup>
import { computed } from 'vue';
import { assigneeSummary, formatPeriodFull, formatPeriodShort, isOverdue } from '../utils/period.js';

const props = defineProps({
  task: { type: Object, required: true },
  isTeam: { type: Boolean, required: true },
  isSelected: { type: Boolean, default: false },
  now: { type: Date, required: true },
});

const shortPeriod = computed(() => formatPeriodShort(props.task));
const isLate = computed(() => isOverdue(props.task, props.now));
const names = computed(() => props.task.assignees.map((assignee) => assignee.nickname));
const summary = computed(() => assigneeSummary(names.value));
</script>

<template>
  <div class="task-card" :class="{ 'is-selected': isSelected }">
    <div class="card-title">{{ task.title }}</div>
    <div class="card-period" :class="{ 'is-overdue': isLate }" :title="formatPeriodFull(task) ?? '미정'">
      <span v-if="shortPeriod" class="period-text">{{ shortPeriod }}</span>
      <span v-else class="badge-x badge-undecided">미정</span>
      <span v-if="isLate" class="badge-x badge-overdue">기한 지남</span>
    </div>
    <div v-if="isTeam && summary" class="card-assignee" :title="names.join(', ')">
      <i class="bi" :class="names.length > 1 ? 'bi-people' : 'bi-person'"></i>
      <span class="name">{{ summary.first }}</span><span class="more">{{ summary.more }}</span>
    </div>
  </div>
</template>
