<!-- 일일보고 양식 설정 모달 (DailyReportView_screen.md "양식 설정 모달", D-152, D-154) -->
<script setup>
import { nextTick, ref } from 'vue';
import draggable from 'vuedraggable';
import ReportEditor from './ReportEditor.vue';
import LoadingLabel from './LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useToastStore } from '../stores/toast.js';
import { MAX_SECTION_TEXT } from '../utils/reportEditor.js';

const props = defineProps({
  teamId: { type: Number, required: true },
  // GET /api/teams/{id}/report-template 응답
  template: { type: Object, required: true },
});
// saved: 저장함, forbidden: 403 (그사이 역할이 바뀜), notFound: 404
const emit = defineEmits(['close', 'saved', 'forbidden', 'notFound']);

const MAX_SECTIONS = 20;
const TYPE_LABELS = { stats: '통계', tasks: '작업 목록', text: '글' };
const STATUS_LABELS = { waiting: '대기', progress: '진행', done: '완료' };
const STATUSES = ['waiting', 'progress', 'done'];
const RANGE_LABELS = {
  sinceLastReport: '지난 보고 이후', weekday: '지난 특정 요일 이후', monthDay: '매달 특정 날짜 이후', lastWeek: '지난 주', lastMonth: '지난 달',
};
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const toastStore = useToastStore();
let nextUid = 0;
// 받은 양식은 Vue 반응형 객체라 structuredClone 을 쓸 수 없어 JSON 으로 복사한다
const withUid = (section) => ({ ...JSON.parse(JSON.stringify(section)), uid: (nextUid += 1) });
const header = ref(props.template.header);
const sections = ref(props.template.sections.map(withUid));
const errors = ref({});
const isSaving = ref(false);
const editorRefs = new Map();
const titleInputs = new Map();

const needsRange = (section) => section.type === 'stats' || (section.type === 'tasks' && section.statuses.includes('done'));

function clearError(uid) {
  delete errors.value[uid];
}
function changeType(section, type) {
  section.type = type;
  section.statuses = type === 'tasks' ? ['progress'] : [];
  section.doneRange = type === 'stats' ? { kind: 'sinceLastReport', weekday: null, day: null } : null;
  clearError(section.uid);
}
function toggleStatus(section, status, isChecked) {
  section.statuses = STATUSES.filter((s) => (s === status ? isChecked : section.statuses.includes(s)));
  section.doneRange = section.statuses.includes('done') ? (section.doneRange ?? { kind: 'sinceLastReport', weekday: null, day: null }) : null;
}
function changeKind(section, kind) {
  section.doneRange = { kind, weekday: kind === 'weekday' ? 1 : null, day: kind === 'monthDay' ? 1 : null };
}
function removeSection(index) {
  sections.value.splice(index, 1);
}
async function addSection() {
  let title = '새 구역';
  for (let n = 2; sections.value.some((s) => s.title.trim() === title); n += 1) {
    title = `새 구역 ${n}`;
  }
  const section = withUid({ title, type: 'text', statuses: [], doneRange: null, defaultHtml: '' });
  sections.value.push(section);
  await nextTick();
  titleInputs.get(section.uid)?.focus();
}

// 화면 검사 (모달 [저장])
function validate() {
  const found = {};
  sections.value.forEach((section) => {
    const title = section.title.trim();
    const textLength = editorRefs.get(section.uid)?.editor.state.doc.textContent.length ?? 0;
    if (!title) {
      found[section.uid] = '구역 제목을 입력해 주세요.';
    } else if (title.length > 30) {
      found[section.uid] = '구역 제목은 30자 이하로 입력해 주세요.';
    } else if (sections.value.some((other) => other !== section && other.title.trim() === title)) {
      found[section.uid] = '구역 제목이 겹칩니다.';
    } else if (section.type === 'tasks' && section.statuses.length === 0) {
      found[section.uid] = '상태를 하나 이상 골라 주세요.';
    } else if (section.type === 'text' && textLength > MAX_SECTION_TEXT) {
      found[section.uid] = '기본 내용은 5,000자 이하로 입력해 주세요.';
    }
  });
  return found;
}

async function save() {
  if (isSaving.value) {
    return;
  }
  errors.value = validate();
  const firstError = sections.value.find((section) => errors.value[section.uid]);
  if (firstError) {
    titleInputs.get(firstError.uid)?.focus();
    return;
  }
  const body = {
    header: header.value.trim(),
    sections: sections.value.map(({ uid, ...section }) => ({
      ...section,
      title: section.title.trim(),
      defaultHtml: section.type === 'text' ? (editorRefs.get(uid)?.getHtml() ?? '') : '',
    })),
  };
  isSaving.value = true;
  try {
    await apiRequest('POST', `/api/teams/${props.teamId}/report-template/update`, { body });
    toastStore.show('success', '양식을 저장했습니다.', '새로 여는 보고부터 적용됩니다.');
    emit('saved');
  } catch (error) {
    if (error.status === 403) {
      toastStore.show('error', '권한이 없습니다.');
      emit('forbidden');
    } else if (error.status === 404) {
      emit('notFound');
    } else if (error.status === 400) {
      toastStore.show('error', '양식 내용이 올바르지 않습니다.');
    }
  } finally {
    isSaving.value = false;
  }
}

function setEditorRef(uid, component) {
  if (component) {
    editorRefs.set(uid, component);
  } else {
    editorRefs.delete(uid);
  }
}
function setTitleRef(uid, element) {
  if (element) {
    titleInputs.set(uid, element);
  } else {
    titleInputs.delete(uid);
  }
}
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal-x tpl-modal" role="dialog" aria-label="보고 양식 설정">
      <div class="modal-title-x">보고 양식 설정<button type="button" class="icon-button" aria-label="닫기" @click="emit('close')"><i class="bi bi-x-lg"></i></button></div>
      <p class="tpl-guide">저장하면 새로 여는 보고부터 적용됩니다.</p>
      <div class="field tpl-header-field">
        <label class="field-label" for="tpl-header">머리말</label>
        <div class="control no-icon"><input id="tpl-header" v-model="header" type="text" maxlength="100" placeholder="{날짜} 진행 사항입니다." /></div>
        <div class="tpl-head-guide">{날짜}는 보고일(11/11)로 바뀝니다. <span class="tpl-head-count">{{ header.length }} / 100</span></div>
      </div>
      <div class="field-label tpl-sections-label">구역</div>
      <draggable v-model="sections" item-key="uid" class="tpl-sections" handle=".grip" :animation="150" :force-fallback="true"
        :fallback-tolerance="5" ghost-class="sortable-ghost" drag-class="sortable-drag">
        <template #item="{ element: section, index }">
          <div class="tpl-card">
            <div class="tpl-row">
              <i class="bi bi-grip-vertical grip" aria-label="끌어서 순서 바꾸기"></i>
              <input :ref="(el) => setTitleRef(section.uid, el)" v-model="section.title" type="text" maxlength="30" aria-label="구역 제목"
                :class="{ 'is-invalid': errors[section.uid] }" @input="clearError(section.uid)" />
              <select :value="section.type" aria-label="구역 종류" @change="changeType(section, $event.target.value)">
                <option v-for="(label, key) in TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
              <button type="button" class="icon-button" aria-label="구역 삭제" :disabled="sections.length <= 1" @click="removeSection(index)">
                <i class="bi bi-trash"></i>
              </button>
            </div>
            <div v-if="errors[section.uid]" class="message is-error tpl-error"><i class="bi bi-exclamation-circle"></i>{{ errors[section.uid] }}</div>
            <div class="tpl-sub">
              <div v-if="section.type === 'tasks'" class="checks">
                <span class="label">상태</span>
                <label v-for="status in STATUSES" :key="status">
                  <input type="checkbox" :checked="section.statuses.includes(status)" @change="toggleStatus(section, status, $event.target.checked)" />
                  {{ STATUS_LABELS[status] }}
                </label>
              </div>
              <div v-if="needsRange(section)" class="range">
                <span class="label">완료 범위</span>
                <select :value="section.doneRange.kind" aria-label="완료 범위" @change="changeKind(section, $event.target.value)">
                  <option v-for="(label, key) in RANGE_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
                <select v-if="section.doneRange.kind === 'weekday'" v-model.number="section.doneRange.weekday" aria-label="요일">
                  <option v-for="(label, i) in WEEKDAY_LABELS" :key="label" :value="i + 1">{{ label }}요일</option>
                </select>
                <select v-if="section.doneRange.kind === 'monthDay'" v-model.number="section.doneRange.day" aria-label="날짜">
                  <option v-for="day in 31" :key="day" :value="day">{{ day }}일</option>
                </select>
              </div>
              <template v-if="section.type === 'text'">
                <span class="label">기본 내용</span>
                <ReportEditor :ref="(c) => setEditorRef(section.uid, c)" :html="section.defaultHtml" :is-editable="true" />
              </template>
            </div>
          </div>
        </template>
      </draggable>
      <button type="button" class="btn-x btn-soft-x tpl-add" :disabled="sections.length >= MAX_SECTIONS" @click="addSection"><i class="bi bi-plus-lg"></i>구역 추가</button>
      <div class="modal-actions">
        <button type="button" class="btn-x btn-outline-x" @click="emit('close')">취소</button>
        <button type="button" class="btn-x btn-primary-x" :disabled="isSaving" @click="save">
          <LoadingLabel :is-loading="isSaving" loading-text="저장 중..." text="저장" />
        </button>
      </div>
    </div>
  </div>
</template>
