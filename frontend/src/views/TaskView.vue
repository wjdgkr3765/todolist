<!-- 작업 화면: 칸반보드 + 할일 목록 + 오른쪽 UI (TaskView_screen.md, 시안 docs/mockups/task_view.html) -->
<script setup>
import '../assets/styles/TaskView.css';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import KanbanBoard from '../components/KanbanBoard.vue';
import TodoFormPanel from '../components/TodoFormPanel.vue';
import TaskDetailPanel from '../components/TaskDetailPanel.vue';
import TaskLogModal from '../components/TaskLogModal.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';
import { isRealtimeConnected, onRealtime } from '../realtime/socket.js';
import { formatPeriodFull, formatPeriodShort, toPeriodRequest } from '../utils/period.js';

const route = useRoute();
const router = useRouter();
const { user } = storeToRefs(useAuthStore());
const teamsStore = useTeamsStore();
const toastStore = useToastStore();

const teamId = computed(() => (route.params.teamId ? Number(route.params.teamId) : null));
const isTeam = computed(() => teamId.value !== null);
const base = computed(() => (isTeam.value ? `/api/teams/${teamId.value}` : '/api/personal'));

const todos = ref([]);
const tasks = ref([]);
const isLoading = ref(true);
const selectedTodoId = ref(null);
// 오른쪽 UI: null / { kind: 'todo', todo } / { kind: 'task' }
const panel = ref(null);
const isTodoSaving = ref(false);
const isStarting = ref(false);
const selectedTaskId = ref(null);
const logs = ref([]);
const isLogsLoading = ref(false);
const isTaskEditing = ref(false);
const isMoving = ref(false);
const isDragging = ref(false);
const hasPendingTaskReload = ref(false);
const changedByOther = ref(false);
const openLog = ref(null);
// 확인창: null / { kind: 'todo' | 'task', title }
const confirm = ref(null);
const isDeleting = ref(false);
const isDisconnected = ref(false);

const selectedTodo = computed(() => todos.value.find((todo) => todo.todoId === selectedTodoId.value) ?? null);
const selectedTask = computed(() => tasks.value.find((task) => task.taskId === selectedTaskId.value) ?? null);

async function handleTeamNotFound(error) {
  if (isTeam.value && error.status === 404) {
    toastStore.show('error', '팀을 찾을 수 없습니다.');
    await teamsStore.fetchTeams().catch(() => {});
    await router.replace('/personal/tasks');
    return true;
  }
  return false;
}

async function loadTodos() {
  todos.value = (await apiRequest('GET', `${base.value}/todos`)).todos;
  if (!selectedTodo.value) {
    selectedTodoId.value = null;
  }
}

async function loadTasks() {
  tasks.value = (await apiRequest('GET', `${base.value}/tasks`)).tasks;
}

async function loadLogs() {
  if (!selectedTaskId.value) {
    return;
  }
  isLogsLoading.value = true;
  try {
    logs.value = (await apiRequest('GET', `/api/tasks/${selectedTaskId.value}/logs`)).logs;
  } catch (error) {
    if (error.status === 404) {
      await taskGone('이미 삭제된 작업입니다.');
    }
  } finally {
    isLogsLoading.value = false;
  }
}

// 알림에서 ?taskId= 로 왔으면 그 작업 상세를 연다 (D-127, D-128)
async function openTaskFromQuery() {
  const taskId = Number(route.query.taskId);
  if (!route.query.taskId) {
    return;
  }
  const task = tasks.value.find((item) => item.taskId === taskId);
  if (task) {
    selectTask(task);
  } else {
    toastStore.show('error', '작업을 찾을 수 없습니다. 지워졌거나 히스토리로 옮겨진 작업입니다.');
  }
  const query = { ...route.query };
  delete query.taskId;
  await router.replace({ query });
}

async function loadAll() {
  isLoading.value = true;
  panel.value = null;
  selectedTodoId.value = null;
  selectedTaskId.value = null;
  try {
    await Promise.all([loadTodos(), loadTasks()]);
    isLoading.value = false;
    await openTaskFromQuery();
  } catch (error) {
    await handleTeamNotFound(error);
  } finally {
    isLoading.value = false;
  }
}

// ---------- 할일 목록 ----------
function toggleTodo(todo) {
  selectedTodoId.value = selectedTodoId.value === todo.todoId ? null : todo.todoId;
}

function openTodoForm(todo) {
  selectedTaskId.value = null;
  changedByOther.value = false;
  panel.value = { kind: 'todo', todo };
}

async function todoGone() {
  toastStore.show('error', '이미 삭제된 할일입니다.');
  if (panel.value?.kind === 'todo') {
    panel.value = null;
  }
  await loadTodos().catch(() => {});
}

async function saveTodo(form) {
  isTodoSaving.value = true;
  const editing = panel.value.todo;
  try {
    const body = toPeriodRequest(form);
    const saved = editing
      ? await apiRequest('POST', `/api/todos/${editing.todoId}/update`, { body })
      : await apiRequest('POST', `${base.value}/todos`, { body });
    panel.value = null;
    changedByOther.value = false;
    await loadTodos();
    selectedTodoId.value = saved.todoId;
    toastStore.show('success', editing ? '할일을 수정했습니다.' : '할일을 추가했습니다.');
  } catch (error) {
    // 수정 중 404 는 그 할일이 없어진 것, 추가 중 404 는 팀이 없어진 것
    if (error.status === 404) {
      await (editing ? todoGone() : handleTeamNotFound(error));
    }
  } finally {
    isTodoSaving.value = false;
  }
}

async function deleteTodo() {
  isDeleting.value = true;
  const todo = selectedTodo.value;
  try {
    await apiRequest('POST', `/api/todos/${todo.todoId}/delete`);
    if (panel.value?.kind === 'todo' && panel.value.todo?.todoId === todo.todoId) {
      panel.value = null;
    }
    selectedTodoId.value = null;
    confirm.value = null;
    await loadTodos();
    toastStore.show('success', '할일을 삭제했습니다.');
  } catch (error) {
    confirm.value = null;
    if (error.status === 404) {
      await todoGone();
    }
  } finally {
    isDeleting.value = false;
  }
}

async function startTodo() {
  isStarting.value = true;
  const todo = selectedTodo.value;
  try {
    await apiRequest('POST', `/api/todos/${todo.todoId}/start`);
    if (panel.value?.kind === 'todo' && panel.value.todo?.todoId === todo.todoId) {
      panel.value = null;
    }
    selectedTodoId.value = null;
    await Promise.all([loadTodos(), loadTasks()]);
    toastStore.show('success', '작업을 시작했습니다.');
  } catch (error) {
    if (error.status === 404) {
      await todoGone();
    }
  } finally {
    isStarting.value = false;
  }
}

// ---------- 칸반 ----------
function selectTask(task) {
  selectedTaskId.value = task.taskId;
  changedByOther.value = false;
  isTaskEditing.value = false;
  panel.value = { kind: 'task' };
  logs.value = [];
  loadLogs();
}

function closeTask() {
  panel.value = null;
  selectedTaskId.value = null;
  isTaskEditing.value = false;
}

async function taskGone(message) {
  toastStore.show('error', message);
  closeTask();
  confirm.value = null;
  openLog.value = null;
  await loadTasks().catch(() => {});
}

async function moveTask({ taskId, status, index }) {
  isMoving.value = true;
  try {
    tasks.value = (await apiRequest('POST', `/api/tasks/${taskId}/move`, { body: { status, index } })).tasks;
    if (selectedTaskId.value === taskId) {
      await loadLogs();
    }
  } catch (error) {
    if (error.status === 404) {
      toastStore.show('error', '이미 삭제된 작업입니다.');
    } else if (error.code === 'TASK_IN_HISTORY') {
      toastStore.show('error', '히스토리로 옮겨진 작업입니다.');
    } else if (error.status > 0 && error.status < 500) {
      toastStore.showServerError();
    }
    await loadTasks().catch(() => {});
  } finally {
    isMoving.value = false;
  }
}

async function onDragState(dragging) {
  isDragging.value = dragging;
  // 드래그 중에 받은 변경은 놓은 뒤에 불러온다
  if (!dragging && hasPendingTaskReload.value) {
    hasPendingTaskReload.value = false;
    await loadTasks().catch(() => {});
  }
}

async function onTaskSaved() {
  changedByOther.value = false;
  await Promise.all([loadTasks(), loadLogs()]).catch(() => {});
}

async function deleteTask() {
  isDeleting.value = true;
  try {
    await apiRequest('POST', `/api/tasks/${selectedTaskId.value}/delete`);
    confirm.value = null;
    closeTask();
    await loadTasks();
    toastStore.show('success', '작업을 삭제했습니다.');
  } catch (error) {
    confirm.value = null;
    if (error.status === 404) {
      await taskGone('이미 삭제된 작업입니다.');
    } else if (error.code === 'TASK_IN_HISTORY') {
      await taskGone('히스토리로 옮겨진 작업입니다.');
    }
  } finally {
    isDeleting.value = false;
  }
}

// ---------- 실시간 반영 (팀 공간만, D-103~D-105) ----------
async function onTodosChanged(data) {
  if (!isTeam.value || data.teamId !== teamId.value) {
    return;
  }
  await loadTodos().catch(() => {});
  const editing = panel.value?.kind === 'todo' ? panel.value.todo : null;
  if (!editing || editing.todoId !== data.todoId || data.actorUserId === user.value?.userId) {
    return;
  }
  if (data.action === 'update') {
    changedByOther.value = true;
  } else if (data.action === 'delete' || data.action === 'start') {
    panel.value = null;
    toastStore.show(data.action === 'delete' ? 'error' : 'success',
      data.action === 'delete' ? '다른 팀원이 이 할일을 삭제했습니다.' : '다른 팀원이 이 할일로 작업을 시작했습니다.');
  }
}

async function onTasksChanged(data) {
  if (!isTeam.value || data.teamId !== teamId.value) {
    return;
  }
  if (isDragging.value) {
    hasPendingTaskReload.value = true;
  } else {
    await loadTasks().catch(() => {});
  }
  const isMineOpen = panel.value?.kind === 'task' && data.taskIds.includes(selectedTaskId.value);
  if (!isMineOpen || data.actorUserId === user.value?.userId) {
    return;
  }
  if (data.action === 'delete') {
    closeTask();
    confirm.value = null;
    openLog.value = null;
    toastStore.show('error', '다른 팀원이 이 작업을 삭제했습니다.');
    return;
  }
  if (isTaskEditing.value) {
    changedByOther.value = true;
  }
  await loadLogs();
}

let disconnectTimer = null;
const offHandlers = [];
// 모달·확인창은 Esc 로 닫는다
function onKeydown(event) {
  if (event.key === 'Escape') {
    confirm.value = null;
    openLog.value = null;
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  offHandlers.push(
    onRealtime('team:todos-changed', onTodosChanged),
    onRealtime('team:tasks-changed', onTasksChanged),
    onRealtime('reconnected', async () => {
      clearTimeout(disconnectTimer);
      isDisconnected.value = false;
      await Promise.all([loadTodos(), loadTasks()]).catch(() => {});
    }),
    // 끊긴 지 3초가 지나면 띠를 보인다 (D-123)
    onRealtime('disconnected', () => {
      clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => { isDisconnected.value = !isRealtimeConnected(); }, 3000);
    }),
  );
  loadAll();
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  clearTimeout(disconnectTimer);
  offHandlers.forEach((off) => off());
});

watch(() => route.params.teamId, () => loadAll());
watch(() => route.query.taskId, () => {
  if (route.query.taskId && !isLoading.value) {
    openTaskFromQuery();
  }
});
</script>

<template>
  <div class="task-view">
    <div class="work-area">
      <div v-if="isTeam && isDisconnected" class="warn-strip"><i class="bi bi-wifi-off"></i>실시간 연결이 끊겼습니다. 다시 연결하는 중...</div>

      <KanbanBoard :tasks="tasks" :is-team="isTeam" :is-loading="isLoading" :selected-task-id="selectedTaskId"
        :my-user-id="user?.userId ?? null" :is-moving="isMoving" @select="selectTask" @move="moveTask" @drag-state="onDragState" />

      <section class="panel">
        <div class="todo-header">
          <h2 class="panel-title">할일 목록<span class="panel-count">({{ todos.length }}개)</span></h2>
          <div class="todo-actions">
            <button type="button" class="btn-x btn-primary-x" @click="openTodoForm(null)"><i class="bi bi-plus-lg"></i>추가</button>
            <button type="button" class="btn-x btn-soft-x" :disabled="!selectedTodo" @click="openTodoForm(selectedTodo)"><i class="bi bi-pencil"></i>수정</button>
            <button type="button" class="btn-x btn-danger-soft-x" :disabled="!selectedTodo" @click="confirm = { kind: 'todo', title: selectedTodo.title }"><i class="bi bi-trash"></i>삭제</button>
            <button type="button" class="btn-x btn-soft-x" :disabled="!selectedTodo || isStarting" @click="startTodo">
              <template v-if="!isStarting"><i class="bi bi-play-fill"></i></template>
              <LoadingLabel :is-loading="isStarting" loading-text="작업 시작" text="작업 시작" />
            </button>
          </div>
        </div>
        <div v-if="isLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
        <table v-else-if="todos.length > 0" class="todo-table">
          <thead><tr><th>제목</th><th>기간</th></tr></thead>
          <tbody>
            <tr v-for="todo in todos" :key="todo.todoId" :class="{ 'is-selected': todo.todoId === selectedTodoId }" @click="toggleTodo(todo)">
              <td :title="todo.title">{{ todo.title }}</td>
              <td :title="formatPeriodFull(todo) ?? '미정'">
                <template v-if="formatPeriodShort(todo)">{{ formatPeriodShort(todo) }}</template>
                <span v-else class="badge-x badge-undecided">미정</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-box"><i class="bi bi-journal-text"></i>할일이 없습니다.<span class="empty-sub">[추가]를 눌러 첫 할일을 만들어 보세요.</span></div>
      </section>
    </div>

    <TodoFormPanel v-if="panel?.kind === 'todo'" :key="panel.todo?.todoId ?? 'new'" :todo="panel.todo" :is-saving="isTodoSaving"
      :is-changed-by-other="changedByOther" @save="saveTodo" @close="panel = null" />
    <TaskDetailPanel v-if="panel?.kind === 'task' && selectedTask" :key="selectedTask.taskId" :task="selectedTask" :logs="logs"
      :is-logs-loading="isLogsLoading" :is-team="isTeam" :team-id="teamId" :is-changed-by-other="changedByOther"
      @close="closeTask" @saved="onTaskSaved" @delete="confirm = { kind: 'task', title: selectedTask.title }" @open-log="openLog = $event"
      @gone="taskGone" @editing="isTaskEditing = $event" />

    <ConfirmDialog v-if="confirm?.kind === 'todo'" title="할일을 삭제할까요?" :target="confirm.title" sub="삭제한 할일은 되돌릴 수 없습니다."
      :is-loading="isDeleting" @confirm="deleteTodo" @cancel="confirm = null" />
    <ConfirmDialog v-if="confirm?.kind === 'task'" title="작업을 삭제할까요?" :target="confirm.title" sub="삭제한 작업과 수정 내역은 되돌릴 수 없습니다."
      :is-loading="isDeleting" @confirm="deleteTask" @cancel="confirm = null" />
    <TaskLogModal v-if="openLog" :log="openLog" :is-team="isTeam" @close="openLog = null" />
  </div>
</template>
