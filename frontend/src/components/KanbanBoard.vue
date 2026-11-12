<!-- 칸반보드 (TaskView_screen.md 칸반보드, D-063, D-069, D-098, D-125, D-126) -->
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import TaskCard from './TaskCard.vue';
import { STATUS_LABELS } from '../utils/period.js';

const props = defineProps({
  tasks: { type: Array, required: true },
  isTeam: { type: Boolean, required: true },
  isLoading: { type: Boolean, default: false },
  selectedTaskId: { type: Number, default: null },
  myUserId: { type: Number, default: null },
  isMoving: { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'move', 'drag-state']);

const STATUSES = ['waiting', 'progress', 'done'];
const isMyOnly = ref(false);
// 공간별 카드 목록 (드래그하면 화면에서 먼저 옮긴다)
const columns = ref({ waiting: [], progress: [], done: [] });

function rebuild() {
  const next = { waiting: [], progress: [], done: [] };
  props.tasks.forEach((task) => next[task.status].push(task));
  STATUSES.forEach((status) => next[status].sort((a, b) => a.sortOrder - b.sortOrder));
  columns.value = next;
}
watch(() => props.tasks, rebuild, { immediate: true });

const isMine = (task) => task.assignees.some((assignee) => assignee.userId === props.myUserId);
const visible = (status) => (isMyOnly.value ? columns.value[status].filter(isMine) : columns.value[status]);
const totalCount = computed(() => STATUSES.reduce((sum, status) => sum + visible(status).length, 0));
// 내 작업만 켜짐 또는 드래그 처리 중이면 드래그를 막는다 (D-126)
const isDragDisabled = computed(() => isMyOnly.value || props.isMoving);

// 기한 지남은 1분마다 다시 판단한다
const now = ref(new Date());
const clock = setInterval(() => { now.value = new Date(); }, 60 * 1000);
onBeforeUnmount(() => clearInterval(clock));

// 놓은 칸의 change 이벤트: 다른 칸에서 들어옴(added) 또는 같은 칸 안에서 옮김(moved). 떠난 칸(removed)은 무시
function onChange(status, event) {
  const placed = event.added ?? event.moved;
  if (placed) {
    emit('move', { taskId: placed.element.taskId, status, index: placed.newIndex });
  }
}
</script>

<template>
  <section class="panel" :class="{ 'is-drag-locked': isDragDisabled }">
    <div class="kanban-head">
      <h2 class="panel-title">칸반보드<span class="panel-count">({{ totalCount }}개)</span></h2>
      <label v-if="isTeam" class="my-only form-switch">
        <input v-model="isMyOnly" class="form-check-input" type="checkbox" role="switch" />내 작업만
        <span v-if="isMyOnly" class="my-only-note">순서 변경 불가</span>
      </label>
    </div>
    <div class="kanban-columns">
      <div v-for="status in STATUSES" :key="status" class="kanban-column" :class="`status-${status}`">
        <div class="column-head"><span class="column-dot"></span>{{ STATUS_LABELS[status] }}<span class="column-count">{{ visible(status).length }}</span></div>
        <div v-if="isLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
        <div v-else-if="isMyOnly" class="card-list">
          <TaskCard v-for="task in visible(status)" :key="task.taskId" :task="task" :is-team="isTeam" :now="now"
            :is-selected="task.taskId === selectedTaskId" @click="emit('select', task)" />
          <div v-if="visible(status).length === 0" class="column-empty">작업이 없습니다</div>
        </div>
        <draggable v-else v-model="columns[status]" item-key="taskId" group="kanban" class="card-list"
          :disabled="isDragDisabled" :animation="150" :delay="150" :delay-on-touch-only="true" :force-fallback="true" :fallback-tolerance="5"
          ghost-class="is-ghost" fallback-class="is-dragging" @start="emit('drag-state', true)" @end="emit('drag-state', false)" @change="onChange(status, $event)">
          <template #item="{ element }">
            <TaskCard :task="element" :is-team="isTeam" :now="now" :is-selected="element.taskId === selectedTaskId" @click="emit('select', element)" />
          </template>
          <template #footer>
            <div v-if="columns[status].length === 0" class="column-empty">작업이 없습니다</div>
          </template>
        </draggable>
      </div>
    </div>
  </section>
</template>
