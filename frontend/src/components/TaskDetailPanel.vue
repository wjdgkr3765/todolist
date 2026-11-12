<!-- 작업 상세 UI: 읽기 / 수정, 작업자 선택, 수정 내역 (TaskView_screen.md 작업 상세 UI, D-012, D-062, D-097) -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import PeriodFields from './PeriodFields.vue';
import LoadingLabel from './LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useToastStore } from '../stores/toast.js';
import {
  STATUS_LABELS, formatPeriodFull, isOverdue, logTypeText, toPeriodForm, toPeriodRequest, validatePeriodForm,
} from '../utils/period.js';
import { formatDateTime } from '../utils/format.js';

const props = defineProps({
  task: { type: Object, required: true },
  logs: { type: Array, required: true },
  isLogsLoading: { type: Boolean, default: false },
  isTeam: { type: Boolean, required: true },
  teamId: { type: Number, default: null },
  isChangedByOther: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'saved', 'delete', 'open-log', 'gone', 'editing']);
defineExpose({ isEditing: () => isEditing.value });

const toastStore = useToastStore();
const isEditing = ref(false);
const isSaving = ref(false);
const form = reactive({ ...toPeriodForm(null), status: 'waiting' });
const errors = reactive({});
const fields = ref(null);
const selectedIds = ref([]);
const members = ref([]);
const isMembersLoading = ref(false);
const isPickerOpen = ref(false);

const period = computed(() => formatPeriodFull(props.task));
const isLate = computed(() => isOverdue(props.task));
const pickerText = computed(() => {
  const names = selectedIds.value.map((id) => members.value.find((m) => m.userId === id)?.nickname
    ?? props.task.assignees.find((a) => a.userId === id)?.nickname ?? '');
  if (names.length === 0) {
    return null;
  }
  return names.length > 1 ? `${names[0]} 외 ${names.length - 1}명` : names[0];
});

async function loadMembers() {
  isMembersLoading.value = true;
  try {
    members.value = (await apiRequest('GET', `/api/teams/${props.teamId}/members`)).members;
  } catch {
    // 오류 토스트는 API 공통 처리
  } finally {
    isMembersLoading.value = false;
  }
}

function startEdit() {
  Object.assign(form, toPeriodForm(props.task), { status: props.task.status });
  Object.keys(errors).forEach((key) => delete errors[key]);
  selectedIds.value = props.task.assignees.map((a) => a.userId);
  isEditing.value = true;
  emit('editing', true);
  if (props.isTeam) {
    loadMembers();
  }
}

function cancelEdit() {
  isEditing.value = false;
  isPickerOpen.value = false;
  emit('editing', false);
}

// 체크한 순서가 지정한 순서
function toggleMember(userId) {
  selectedIds.value = selectedIds.value.includes(userId)
    ? selectedIds.value.filter((id) => id !== userId)
    : [...selectedIds.value, userId];
}

async function save() {
  Object.keys(errors).forEach((key) => delete errors[key]);
  Object.assign(errors, validatePeriodForm(form));
  if (Object.keys(errors).length > 0) {
    fields.value?.focusFirstError();
    return;
  }
  isSaving.value = true;
  try {
    const before = props.task.updateDate;
    const saved = await apiRequest('POST', `/api/tasks/${props.task.taskId}/update`, {
      body: { ...toPeriodRequest(form), status: form.status, assigneeUserIds: props.isTeam ? selectedIds.value : [] },
    });
    // 바뀐 것이 없으면 서버는 그대로의 작업을 돌려준다 (D-068)
    const isChanged = saved.updateDate !== before;
    toastStore.show('success', isChanged ? '작업을 수정했습니다.' : '바뀐 내용이 없습니다.');
    isEditing.value = false;
    isPickerOpen.value = false;
    emit('editing', false);
    emit('saved', saved);
  } catch (error) {
    if (error.code === 'INVALID_INPUT' && props.isTeam) {
      toastStore.show('error', '팀에 없는 회원이 작업자에 있습니다.');
      loadMembers();
    } else if (error.status === 404) {
      emit('gone', '이미 삭제된 작업입니다.');
    } else if (error.code === 'TASK_IN_HISTORY') {
      emit('gone', '히스토리로 옮겨진 작업입니다.');
    }
  } finally {
    isSaving.value = false;
  }
}

function onDocumentClick() {
  isPickerOpen.value = false;
}
function onKeydown(event) {
  if (event.key === 'Escape') {
    isPickerOpen.value = false;
  }
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <aside class="panel side-panel">
    <div v-if="isChangedByOther" class="warn-strip"><i class="bi bi-exclamation-circle"></i>다른 팀원이 이 작업을 바꿨습니다.</div>
    <div class="side-head">
      <h2 class="panel-title">{{ isEditing ? '작업 수정' : '작업 상세' }}</h2>
      <button type="button" class="icon-button" aria-label="닫기" @click="emit('close')"><i class="bi bi-x-lg"></i></button>
    </div>

    <div v-if="!isEditing">
      <div class="detail-item"><div class="detail-label">상태</div><span class="badge-x" :class="`badge-${task.status}`">{{ STATUS_LABELS[task.status] }}</span></div>
      <div class="detail-item"><div class="detail-label">제목</div><div class="detail-value">{{ task.title }}</div></div>
      <div class="detail-item"><div class="detail-label">기간</div>
        <div class="detail-value" :class="{ 'is-overdue': isLate }">
          <template v-if="period">{{ period }}</template><span v-else class="badge-x badge-undecided">미정</span>
          <span v-if="isLate" class="badge-x badge-overdue">기한 지남</span>
        </div>
      </div>
      <div v-if="isTeam" class="detail-item"><div class="detail-label">작업자</div>
        <div class="detail-value"><template v-if="task.assignees.length">{{ task.assignees.map((a) => a.nickname).join(', ') }}</template><span v-else class="muted">없음</span></div>
      </div>
      <div class="detail-item"><div class="detail-label">내용</div><div class="detail-value detail-content">{{ task.content }}</div></div>
      <div class="detail-buttons">
        <button type="button" class="btn-x btn-soft-x" @click="startEdit"><i class="bi bi-pencil"></i>수정</button>
        <button type="button" class="btn-x btn-danger-soft-x" @click="emit('delete')"><i class="bi bi-trash"></i>삭제</button>
      </div>
    </div>

    <div v-else>
      <div class="field"><label class="field-label" for="edit-status">상태</label>
        <div class="control no-icon"><select id="edit-status" v-model="form.status"><option value="waiting">대기</option><option value="progress">진행</option><option value="done">완료</option></select></div>
      </div>
      <PeriodFields ref="fields" :form="form" :errors="errors" id-prefix="edit">
        <template #before-content>
          <div v-if="isTeam" class="field"><span class="field-label">작업자</span>
            <div class="assignee-picker" @click.stop>
              <div class="control no-icon" role="button" tabindex="0" @click="isPickerOpen = !isPickerOpen" @keydown.enter="isPickerOpen = !isPickerOpen">
                <span class="value"><template v-if="pickerText">{{ pickerText }}</template><span v-else class="placeholder-text">작업자 선택</span></span>
                <span class="control-suffix"><i class="bi bi-chevron-down"></i></span>
              </div>
              <div v-if="isPickerOpen" class="assignee-menu">
                <div v-if="isMembersLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
                <label v-for="member in members" v-else :key="member.userId" class="assignee-option">
                  <input type="checkbox" :checked="selectedIds.includes(member.userId)" @change="toggleMember(member.userId)" />
                  <span><b>{{ member.nickname }}</b><small>{{ member.email }}</small></span>
                </label>
              </div>
            </div>
          </div>
        </template>
      </PeriodFields>
      <div class="form-buttons">
        <button type="button" class="btn-x btn-outline-x" @click="cancelEdit">취소</button>
        <button type="button" class="btn-submit" :disabled="isSaving" @click="save">
          <LoadingLabel :is-loading="isSaving" loading-text="저장 중..." text="저장" />
        </button>
      </div>
    </div>

    <div class="log-section">
      <div class="log-title">수정 내역<span>({{ logs.length }})</span></div>
      <div v-if="isLogsLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span></div>
      <div v-else class="log-list">
        <div v-for="log in logs" :key="log.logId" class="log-row" role="button" tabindex="0" @click="emit('open-log', log)">
          <div>
            <div class="log-type">{{ logTypeText(log) }}</div>
            <div class="log-meta">{{ formatDateTime(log.createDate) }} · {{ log.logType === 'create' ? '만든 사람' : '수정한 사람' }} {{ log.nickname }}</div>
          </div>
          <i class="bi bi-chevron-right"></i>
        </div>
      </div>
    </div>
  </aside>
</template>
