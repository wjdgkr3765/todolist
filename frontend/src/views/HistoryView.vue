<!-- 히스토리 화면 (HistoryView_screen.md, 시안 docs/mockups/history_view.html) -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TaskInfoModal from '../components/TaskInfoModal.vue';
import { apiRequest } from '../api/client.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';
import { assigneeSummary } from '../utils/period.js';

const route = useRoute();
const router = useRouter();
const teamsStore = useTeamsStore();
const toastStore = useToastStore();

const teamId = computed(() => (route.params.teamId ? Number(route.params.teamId) : null));
const isTeam = computed(() => teamId.value !== null);
const base = computed(() => (isTeam.value ? `/api/teams/${teamId.value}` : '/api/personal'));

const tasks = ref([]);
const totalCount = ref(0);
const page = ref(1);
const pageSize = ref(20);
const isLoading = ref(true);
const card = ref(null);
const openTask = ref(null);
const logs = ref([]);
const isLogsLoading = ref(false);

const lastPage = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)));
// 현재 페이지 주변 최대 5개 번호 (D-111)
const pageNumbers = computed(() => {
  const start = Math.max(1, Math.min(page.value - 2, lastPage.value - 4));
  return Array.from({ length: Math.min(5, lastPage.value) }, (_, index) => start + index);
});

const pad = (value) => String(value).padStart(2, '0');
const dot = (dateText) => dateText.replaceAll('-', '.');
function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
// 표의 기간: 날짜만, 두 줄 "시작 ~" / "종료" (하루면 한 줄, D-144)
function periodLines(task) {
  if (task.isPeriodUndecided) {
    return null;
  }
  return task.startDate === task.endDate ? [dot(task.startDate)] : [`${dot(task.startDate)} ~`, dot(task.endDate)];
}
function periodOneLine(task) {
  if (task.isPeriodUndecided) {
    return '미정';
  }
  return task.startDate === task.endDate ? dot(task.startDate) : `${dot(task.startDate)} ~ ${dot(task.endDate)}`;
}
function assigneeText(task) {
  const summary = assigneeSummary(task.assignees.map((a) => a.nickname));
  return summary ? `${summary.first}${summary.more}` : null;
}

async function load(target) {
  isLoading.value = true;
  try {
    const data = await apiRequest('GET', `${base.value}/history`, { query: { page: String(target) } });
    // 그사이 줄어 빈 페이지가 오면 마지막 페이지를 다시 불러온다
    if (data.tasks.length === 0 && target > 1 && data.totalCount > 0) {
      await load(Math.ceil(data.totalCount / data.pageSize));
      return;
    }
    page.value = data.page;
    tasks.value = data.tasks;
    totalCount.value = data.totalCount;
    pageSize.value = data.pageSize;
  } catch (error) {
    if (isTeam.value && error.status === 404) {
      toastStore.show('error', '팀을 찾을 수 없습니다.');
      await teamsStore.fetchTeams().catch(() => {});
      await router.replace('/personal/tasks');
    }
  } finally {
    isLoading.value = false;
  }
}

async function goPage(target) {
  await load(target);
  card.value?.scrollIntoView?.({ block: 'start' });
}

async function openDetail(task) {
  openTask.value = task;
  logs.value = [];
  isLogsLoading.value = true;
  try {
    logs.value = (await apiRequest('GET', `/api/tasks/${task.taskId}/logs`)).logs;
  } catch (error) {
    if (error.status === 404) {
      openTask.value = null;
      toastStore.show('error', '작업을 찾을 수 없습니다.');
      await load(page.value);
    }
  } finally {
    isLogsLoading.value = false;
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    openTask.value = null;
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  load(1);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
watch(() => route.params.teamId, () => load(1));
</script>

<template>
  <section ref="card" class="history-card">
    <h1 class="history-title">히스토리<span class="history-count">({{ totalCount }}개)</span></h1>
    <p class="history-guide">완료한 지 7일이 지난 작업입니다.</p>
    <div v-if="isLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
    <div v-else-if="tasks.length === 0" class="empty-box"><i class="bi bi-clock-history"></i>히스토리가 없습니다.<span class="empty-sub">완료한 지 7일이 지난 작업이 여기에 모입니다.</span></div>
    <template v-else>
      <table class="table-x history-table">
        <thead><tr><th>제목</th><th class="col-period">기간</th><th class="col-done">완료일</th><th v-if="isTeam" class="col-assignee">작업자</th></tr></thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.taskId" @click="openDetail(task)">
            <td>
              <div class="title-cell">{{ task.title }}</div>
              <div class="row-sub">{{ periodOneLine(task) }}<template v-if="isTeam"> · {{ assigneeText(task) ?? '없음' }}</template></div>
            </td>
            <td class="col-period">
              <template v-if="periodLines(task)"><div v-for="line in periodLines(task)" :key="line">{{ line }}</div></template>
              <span v-else class="badge-x badge-undecided">미정</span>
            </td>
            <td class="col-done">{{ formatDate(task.doneDate) }}</td>
            <td v-if="isTeam" class="col-assignee cell-ellipsis">
              <template v-if="assigneeText(task)">{{ assigneeText(task) }}</template><span v-else class="muted">없음</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="lastPage > 1" class="pager">
        <button type="button" aria-label="이전 페이지" :disabled="page === 1" @click="goPage(page - 1)"><i class="bi bi-chevron-left"></i></button>
        <button v-for="number in pageNumbers" :key="number" type="button" :class="{ 'is-current': number === page }" @click="goPage(number)">{{ number }}</button>
        <button type="button" aria-label="다음 페이지" :disabled="page === lastPage" @click="goPage(page + 1)"><i class="bi bi-chevron-right"></i></button>
      </div>
    </template>
    <TaskInfoModal v-if="openTask" :task="openTask" :is-team="isTeam" :is-history="true" :logs="logs" :is-logs-loading="isLogsLoading" @close="openTask = null" />
  </section>
</template>

<style scoped>
/* HistoryView_screen.md 7. 디자인 값 (시안 history_view.html 과 같은 값) */
.history-card { background: #fff; border: 1px solid var(--color-border); border-radius: 16px; padding: 20px; }
.history-title { font-size: 17px; font-weight: 800; margin: 0; }
.history-count { font-size: 14px; font-weight: 600; color: var(--color-muted); margin-left: 4px; }
.history-guide { font-size: 13px; color: var(--color-sub); margin: 4px 0 16px; }
.history-table { table-layout: fixed; }
.history-table tbody tr { cursor: pointer; }
.history-table .col-period { width: 140px; }
.history-table td.col-period { line-height: 1.4; padding-top: 8px; padding-bottom: 8px; }
.history-table .col-done { width: 120px; }
.history-table .col-assignee { width: 160px; }
.row-sub { display: none; font-size: 12px; color: var(--color-sub); margin-top: 2px; }
.title-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--color-muted); }
.pager { display: flex; justify-content: center; gap: 4px; margin-top: 16px; }
.pager button { width: 32px; height: 32px; border-radius: 8px; border: 0; background: transparent; color: var(--color-sub); font-size: 14px; font-weight: 600; }
.pager button:hover:not(:disabled) { background: var(--color-hover-bg); }
.pager button.is-current { background: var(--color-primary); color: #fff; }
.pager button:disabled { color: var(--color-border-strong); }
@media (max-width: 575.98px) {
  .history-card { padding: 12px; }
}
@media (max-width: 767.98px) {
  .history-table .col-period, .history-table .col-assignee { display: none; }
  .row-sub { display: block; }
  .history-table td { height: auto; padding-top: 8px; padding-bottom: 8px; }
}
</style>
