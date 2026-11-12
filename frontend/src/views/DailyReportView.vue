<!-- 일일보고 탭: 팀원 보고 현황, 내 오늘 보고 쓰기, 남의 보고 읽기, 양식 설정 (DailyReportView_screen.md, 시안 docs/mockups/daily_report_view.html) -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import ReportEditor from '../components/ReportEditor.vue';
import ReportTemplateModal from '../components/ReportTemplateModal.vue';
import { apiRequest } from '../api/client.js';
import { onRealtime } from '../realtime/socket.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';
import { addDaysText, formatDateTime, formatDayWithWeekday, formatTime, koreaToday } from '../utils/format.js';
import { MAX_SECTION_TEXT } from '../utils/reportEditor.js';
import '../assets/styles/DailyReportView.css';

const route = useRoute();
const router = useRouter();
const teamsStore = useTeamsStore();
const toastStore = useToastStore();

const teamId = computed(() => Number(route.params.teamId));
const base = computed(() => `/api/teams/${teamId.value}`);
const today = ref(koreaToday());
const date = ref(today.value);
const isToday = computed(() => date.value >= today.value);

const items = ref([]);
const isStatusLoading = ref(true);
const selectedKey = ref(null);
// 보고 영역: { kind: 'loading' | 'empty' | 'report', report?, isEditable? }
const pane = ref({ kind: 'loading' });
const renderKey = ref(0);
const sectionLengths = ref([]);
const isCarryOver = ref(false);
const isCarrySaving = ref(false);
const isDirty = ref(false);
const savingAction = ref(null);
const reloadingIndex = ref(null);
const editorRefs = ref([]);
// 확인창: { title, text, okText, cancelText, isDanger, run }
const confirm = ref(null);
const template = ref(null);
const isTemplateLoading = ref(false);
const isTemplateForbidden = ref(false);
const isNarrow = ref(false);
const isReportShownNarrow = ref(false);

const myRole = computed(() => teamsStore.findTeam(teamId.value)?.myRole ?? 'member');
const canEditTemplate = computed(() => !isTemplateForbidden.value && (myRole.value === 'owner' || myRole.value === 'manager'));
const itemKey = (item) => (item.userId === null ? `r${item.reportId}` : `u${item.userId}`);
const selectedItem = computed(() => items.value.find((item) => itemKey(item) === selectedKey.value) ?? null);
const submittedCount = computed(() => items.value.filter((item) => item.status === 'submitted').length);
const report = computed(() => (pane.value.kind === 'report' ? pane.value.report : null));
const isEditable = computed(() => pane.value.kind === 'report' && pane.value.isEditable);
const isOver = computed(() => sectionLengths.value.some((length) => length > MAX_SECTION_TEXT));
const BADGES = { submitted: ['rb-submitted', '제출 완료'], draft: ['rb-draft', '임시저장'], none: ['rb-none', '미제출'] };

const stateText = computed(() => {
  const r = report.value;
  if (!r || r.status === 'new') {
    return '작성 전';
  }
  if (r.status === 'draft') {
    return `임시저장 · ${formatTime(r.draftDate)}${r.reportDate !== today.value ? ' (제출하지 않음)' : ''}`;
  }
  return `제출 완료 · ${formatDateTime(r.submitDate)}${r.updateDate ? ` · 수정됨 · ${formatTime(r.updateDate)}` : ''}`;
});

async function goPersonalWithNotFound() {
  isDirty.value = false;
  toastStore.show('error', '팀을 찾을 수 없습니다.');
  await teamsStore.fetchTeams().catch(() => {});
  await router.replace('/personal/tasks');
}
async function handleCommonError(error) {
  if (error.status === 404) {
    await goPersonalWithNotFound();
  }
}

// ---------- 현황 목록 ----------
async function loadStatus() {
  const data = await apiRequest('GET', `${base.value}/reports`, { query: { date: date.value } });
  items.value = data.items;
}

// ---------- 보고 영역 ----------
function showReport(report, isEditableReport) {
  sectionLengths.value = report.sections.map(() => 0);
  editorRefs.value = [];
  renderKey.value += 1;
  pane.value = { kind: 'report', report, isEditable: isEditableReport };
  isDirty.value = false;
}

// 고른 사람의 보고: 내 오늘 보고는 쓰기, 나머지는 읽기 전용, 없으면 빈 보고
async function openSelected() {
  const item = selectedItem.value;
  pane.value = { kind: 'loading' };
  isDirty.value = false;
  try {
    if (item?.isMe && date.value === today.value) {
      const data = await apiRequest('GET', `${base.value}/reports/today`);
      isCarryOver.value = data.isCarryOver;
      showReport(data.report, true);
    } else if (item?.reportId) {
      showReport(await apiRequest('GET', `${base.value}/reports/${item.reportId}`), false);
    } else {
      pane.value = { kind: 'empty' };
    }
  } catch (error) {
    pane.value = { kind: 'empty' };
    await handleCommonError(error);
  }
}

// 날짜를 옮기고 내 행을 고른다
async function goDate(nextDate) {
  date.value = nextDate;
  isStatusLoading.value = true;
  pane.value = { kind: 'loading' };
  try {
    await loadStatus();
    selectedKey.value = itemKey(items.value[0]);
    isStatusLoading.value = false;
    await openSelected();
  } catch (error) {
    isStatusLoading.value = false;
    pane.value = { kind: 'empty' };
    await handleCommonError(error);
  }
}

// ---------- 저장하지 않고 나가기 (D-157) ----------
function openConfirm(options) {
  confirm.value = { cancelText: '취소', isDanger: false, ...options };
}
function guard(next) {
  if (!isDirty.value) {
    next();
    return;
  }
  openConfirm({
    title: '저장하지 않은 내용', text: '저장하지 않은 내용이 있습니다. 나갈까요?', okText: '나가기', cancelText: '머무르기', isDanger: true,
    run: () => { isDirty.value = false; next(); },
  });
}
async function runConfirm() {
  const { run } = confirm.value;
  confirm.value = null;
  await run();
}

function selectItem(item) {
  guard(async () => {
    isReportShownNarrow.value = true;
    if (item.isMe) {
      await goDate(date.value);
      return;
    }
    selectedKey.value = itemKey(item);
    await openSelected();
  });
}
function backToList() {
  guard(() => { isReportShownNarrow.value = false; });
}

// 탭·팀·다른 화면으로 옮길 때. 팀에서 내보내지거나 해체되면(팀 목록에 없음) 묻지 않는다
function routeGuard(to) {
  const isLeavingTeam = !teamsStore.findTeam(teamId.value);
  if (!isDirty.value || isLeavingTeam || !to.matched.some((record) => record.meta.requiresAuth)) {
    return true;
  }
  guard(() => router.push(to.fullPath));
  return false;
}
onBeforeRouteLeave(routeGuard);
onBeforeRouteUpdate(routeGuard);
function onBeforeUnload(event) {
  if (isDirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}

// ---------- 쓰기 ----------
function collectSections() {
  return report.value.sections.map((section, index) => ({
    title: section.title, type: section.type, statuses: section.statuses, doneRange: section.doneRange,
    html: editorRefs.value[index]?.getHtml() ?? section.html,
  }));
}

function reloadSection(index) {
  openConfirm({
    title: '다시 불러오기', text: '이 구역을 지금 칸반 내용으로 다시 채울까요? 고친 내용은 사라집니다.', okText: '다시 불러오기',
    run: async () => {
      const section = report.value.sections[index];
      const query = { type: section.type };
      if (section.type === 'tasks') {
        query.statuses = section.statuses.join(',');
      }
      if (section.doneRange) {
        query.doneKind = section.doneRange.kind;
        if (section.doneRange.kind === 'weekday') {
          query.doneWeekday = section.doneRange.weekday;
        }
        if (section.doneRange.kind === 'monthDay') {
          query.doneDay = section.doneRange.day;
        }
      }
      reloadingIndex.value = index;
      try {
        const { html } = await apiRequest('GET', `${base.value}/reports/section-content`, { query });
        editorRefs.value[index]?.setHtml(html);
        isDirty.value = true;
      } catch (error) {
        await handleCommonError(error);
      } finally {
        reloadingIndex.value = null;
      }
    },
  });
}

function applyTemplate() {
  openConfirm({
    title: '새 양식 적용', text: '지금 팀 양식으로 보고를 다시 만들까요? 제목이 같은 글 구역은 쓰던 내용을 옮기고, 나머지는 새로 채웁니다.', okText: '적용',
    run: async () => {
      try {
        const current = collectSections();
        const { report: fresh } = await apiRequest('GET', `${base.value}/reports/today/fresh`);
        const sections = fresh.sections.map((section) => {
          const old = section.type === 'text' ? current.find((o) => o.type === 'text' && o.title === section.title) : null;
          return old ? { ...section, html: old.html } : section;
        });
        showReport({ ...report.value, header: fresh.header, sections }, true);
        isDirty.value = true;
        toastStore.show('success', '새 양식을 적용했습니다. 저장해야 남습니다.');
      } catch (error) {
        await handleCommonError(error);
      }
    },
  });
}

async function toggleCarryOver(event) {
  const isOn = event.target.checked;
  isCarrySaving.value = true;
  try {
    isCarryOver.value = (await apiRequest('POST', '/api/users/me/report-carry-over', { body: { isOn } })).isCarryOver;
    toastStore.show('success', `지난 보고 이어받기를 ${isOn ? '켰습니다' : '껐습니다'}.`, '다음에 새 보고를 열 때 적용됩니다.');
  } catch (error) {
    event.target.checked = !isOn;
    if (error.status > 0 && error.status < 500 && error.status !== 401) {
      toastStore.showServerError();
    }
  } finally {
    isCarrySaving.value = false;
  }
}

async function save(action) {
  if (savingAction.value || isOver.value) {
    return;
  }
  const wasSubmitted = report.value.status === 'submitted';
  savingAction.value = action;
  try {
    const saved = await apiRequest('POST', `${base.value}/reports/today/save`, {
      body: { reportDate: report.value.reportDate, action, header: report.value.header, sections: collectSections() },
    });
    // 쓰던 편집기는 그대로 두고 상태만 바꾼다
    pane.value = { ...pane.value, report: { ...saved, sections: report.value.sections } };
    isDirty.value = false;
    let message = '보고를 제출했습니다.';
    if (action === 'draft') {
      message = '임시저장했습니다.';
    } else if (wasSubmitted) {
      message = '보고를 수정했습니다.';
    }
    toastStore.show('success', message);
    await loadStatus().catch(() => {});
  } catch (error) {
    if (error.code === 'REPORT_NOT_TODAY') {
      toastStore.show('error', '날짜가 바뀌어 지난 보고는 고칠 수 없습니다.', '오늘 보고를 다시 불러왔습니다.');
      isDirty.value = false;
      today.value = koreaToday();
      await goDate(today.value);
    } else if (error.code === 'REPORT_ALREADY_SUBMITTED') {
      toastStore.show('error', '이미 제출한 보고입니다.', '[수정 제출]로 저장해 주세요.');
      pane.value = { ...pane.value, report: { ...report.value, status: 'submitted' } };
    } else if (error.status === 400) {
      toastStore.show('error', '보고 내용이 너무 깁니다.');
    } else {
      await handleCommonError(error);
    }
  } finally {
    savingAction.value = null;
  }
}

// ---------- 양식 설정 ----------
async function openTemplate() {
  isTemplateLoading.value = true;
  try {
    template.value = await apiRequest('GET', `${base.value}/report-template`);
  } catch (error) {
    await handleCommonError(error);
  } finally {
    isTemplateLoading.value = false;
  }
}
function onTemplateForbidden() {
  template.value = null;
  isTemplateForbidden.value = true;
}
async function onTemplateNotFound() {
  template.value = null;
  await goPersonalWithNotFound();
}

// ---------- 화면 열기 ----------
async function loadAll() {
  isTemplateForbidden.value = false;
  isReportShownNarrow.value = false;
  today.value = koreaToday();
  await goDate(today.value);
}

// ---------- 실시간 반영 (D-159) ----------
async function onReportsChanged(data) {
  if (data.teamId !== teamId.value || data.reportDate !== date.value) {
    return;
  }
  await loadStatus().catch(() => {});
  const item = selectedItem.value;
  // 남의 보고를 읽고 있으면 그 보고를 다시 불러온다 (쓰던 내 보고는 건드리지 않는다)
  if (item && !isEditable.value && item.userId === data.userId) {
    await openSelected();
  }
}
async function onReconnected() {
  await loadStatus().catch(() => {});
  if (!isEditable.value && selectedItem.value?.reportId) {
    await openSelected();
  }
}

let narrowQuery = null;
const onNarrowChange = () => { isNarrow.value = narrowQuery.matches; };
function onKeydown(event) {
  if (event.key === 'Escape') {
    if (confirm.value) {
      confirm.value = null;
    } else if (template.value) {
      template.value = null;
    }
  }
}
const offHandlers = [];
onMounted(() => {
  narrowQuery = window.matchMedia('(max-width: 991.98px)');
  onNarrowChange();
  narrowQuery.addEventListener('change', onNarrowChange);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('keydown', onKeydown);
  offHandlers.push(onRealtime('team:reports-changed', onReportsChanged), onRealtime('reconnected', onReconnected));
  loadAll();
});
onBeforeUnmount(() => {
  narrowQuery.removeEventListener('change', onNarrowChange);
  window.removeEventListener('beforeunload', onBeforeUnload);
  document.removeEventListener('keydown', onKeydown);
  offHandlers.forEach((off) => off());
});
watch(() => route.params.teamId, async () => {
  template.value = null;
  confirm.value = null;
  await nextTick();
  await loadAll();
});

const setEditorRef = (index) => (component) => {
  editorRefs.value[index] = component;
};
function onLength(index, length) {
  sectionLengths.value[index] = length;
}
</script>

<template>
  <div class="daily-report">
    <div class="report-head">
      <h1>일일보고</h1>
      <div class="date-nav">
        <button type="button" class="icon-button" aria-label="전날" @click="guard(() => goDate(addDaysText(date, -1)))"><i class="bi bi-chevron-left"></i></button>
        <span class="date-text">{{ formatDayWithWeekday(date) }}</span>
        <button type="button" class="icon-button" aria-label="다음날" :disabled="isToday" @click="guard(() => goDate(addDaysText(date, 1)))"><i class="bi bi-chevron-right"></i></button>
        <button type="button" class="btn-x btn-outline-x" :disabled="isToday" @click="guard(() => goDate(today))">오늘</button>
      </div>
      <div v-if="canEditTemplate" class="head-right">
        <button type="button" class="btn-x btn-soft-x btn-template" :disabled="isTemplateLoading" @click="openTemplate">
          <template v-if="!isTemplateLoading"><i class="bi bi-sliders"></i></template>
          <LoadingLabel :is-loading="isTemplateLoading" loading-text="양식 설정" text="양식 설정" />
        </button>
      </div>
    </div>

    <div class="report-layout" :class="{ 'is-narrow': isNarrow, 'show-report': isReportShownNarrow, 'show-list': !isReportShownNarrow }">
      <section class="status-card" aria-label="팀원 보고 현황">
        <div class="status-title">팀원 보고 현황<small v-if="!isStatusLoading">제출 {{ submittedCount }} / 전체 {{ items.length }}</small></div>
        <div v-if="isStatusLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
        <div v-else class="status-list">
          <button v-for="item in items" :key="itemKey(item)" type="button" class="status-row" :class="{ 'is-selected': itemKey(item) === selectedKey }" @click="selectItem(item)">
            <div class="status-line">
              <span>{{ item.nickname }}<span v-if="item.isMe" class="me-mark">(나)</span></span>
              <span class="rb" :class="BADGES[item.status][0]">{{ BADGES[item.status][1] }}</span>
            </div>
            <div class="status-sub">
              <template v-if="item.status === 'submitted'">제출 {{ formatTime(item.submitDate) }}{{ item.isEdited ? ' · 수정됨' : '' }}</template>
            </div>
          </button>
        </div>
      </section>

      <section class="report-card" aria-label="보고">
        <button type="button" class="btn-x btn-outline-x back-button" @click="backToList"><i class="bi bi-chevron-left"></i>목록</button>
        <div v-if="pane.kind === 'loading'" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
        <div v-else-if="pane.kind === 'empty'" class="empty-box"><i class="bi bi-journal-x"></i>제출한 보고가 없습니다.</div>
        <div v-else>
          <div class="report-top">
            <div class="report-who">{{ report.nickname }}<small>{{ formatDayWithWeekday(report.reportDate) }}</small></div>
            <div class="report-state">{{ stateText }}</div>
          </div>
          <div v-if="isEditable" class="report-tools">
            <div class="form-check form-switch">
              <input id="carry-switch" class="form-check-input" type="checkbox" role="switch" :checked="isCarryOver" :disabled="isCarrySaving" @change="toggleCarryOver" />
              <label class="form-check-label" for="carry-switch">지난 보고 이어받기</label>
            </div>
            <button type="button" class="btn-x btn-outline-x" @click="applyTemplate"><i class="bi bi-arrow-repeat"></i>새 양식 적용</button>
          </div>
          <div v-if="report.header" class="report-header-line">{{ report.header }}</div>
          <div :key="renderKey">
            <div v-for="(section, index) in report.sections" :key="section.title" class="section-block">
              <div class="rs-title">
                {{ section.title }}
                <button v-if="isEditable && section.type !== 'text'" type="button" class="btn-x btn-outline-x reload" :disabled="reloadingIndex === index" @click="reloadSection(index)">
                  <template v-if="reloadingIndex !== index"><i class="bi bi-arrow-clockwise"></i></template>
                  <LoadingLabel :is-loading="reloadingIndex === index" loading-text="불러오는 중" text="다시 불러오기" />
                </button>
              </div>
              <ReportEditor :ref="setEditorRef(index)" :html="section.html" :is-editable="isEditable" :is-count-shown="true"
                @change="isDirty = true" @length="onLength(index, $event)" />
            </div>
          </div>
          <div v-if="isEditable" class="report-actions">
            <button v-if="report.status !== 'submitted'" type="button" class="btn-x btn-outline-x" :disabled="isOver || savingAction !== null" @click="save('draft')">
              <LoadingLabel :is-loading="savingAction === 'draft'" loading-text="저장 중..." text="임시저장" />
            </button>
            <button type="button" class="btn-x btn-primary-x right" :disabled="isOver || savingAction !== null" @click="save('submit')">
              <LoadingLabel :is-loading="savingAction === 'submit'" loading-text="제출 중..." :text="report.status === 'submitted' ? '수정 제출' : '제출'" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <ReportTemplateModal v-if="template" :team-id="teamId" :template="template" @close="template = null" @saved="template = null"
      @forbidden="onTemplateForbidden" @not-found="onTemplateNotFound" />
    <ConfirmDialog v-if="confirm" :title="confirm.title" :text="confirm.text" :confirm-text="confirm.okText" :cancel-text="confirm.cancelText"
      :is-danger="confirm.isDanger" @confirm="runConfirm" @cancel="confirm = null" />
  </div>
</template>
