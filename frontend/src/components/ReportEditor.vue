<!-- 일일보고 구역 편집기 하나 (DailyReportView_screen.md "구역 편집기", D-155). 읽기 전용 보고도 이 편집기로 그린다 (v-html 쓰지 않음) -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import ReportToolbar from './ReportToolbar.vue';
import { MAX_SECTION_TEXT, WARN_SECTION_TEXT, reportExtensions } from '../utils/reportEditor.js';

const props = defineProps({
  html: { type: String, default: '' },
  isEditable: { type: Boolean, default: false },
  isCountShown: { type: Boolean, default: false },
});
// change: 사용자가 내용을 바꿈, length: 태그를 뺀 글자 수
const emit = defineEmits(['change', 'length']);

const root = ref(null);
const editor = shallowRef(null);
const isFocused = ref(false);
const isEmpty = ref(true);
const textLength = ref(0);
const version = ref(0);

function refresh() {
  isEmpty.value = editor.value.isEmpty;
  textLength.value = editor.value.state.doc.textContent.length;
  emit('length', textLength.value);
}

editor.value = new Editor({
  content: props.html,
  editable: props.isEditable,
  extensions: reportExtensions(props.isEditable),
  // 표 뒤 빈 줄 자동 추가처럼 편집기가 스스로 고친 것은 수정으로 보지 않는다
  onUpdate: ({ transaction }) => {
    refresh();
    if (transaction.docChanged) {
      emit('change');
    }
  },
  onFocus: () => { isFocused.value = true; },
  onTransaction: () => { version.value += 1; },
});
refresh();

const countClass = computed(() => ({
  'is-warn': textLength.value >= WARN_SECTION_TEXT && textLength.value <= MAX_SECTION_TEXT,
  'is-over': textLength.value > MAX_SECTION_TEXT,
}));

// 편집기와 도구 막대 밖을 누르면 도구 막대를 숨긴다
function onDocumentMousedown(event) {
  if (isFocused.value && !root.value?.contains(event.target)) {
    isFocused.value = false;
  }
}
onMounted(() => document.addEventListener('mousedown', onDocumentMousedown));
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMousedown);
  editor.value.destroy();
});

defineExpose({
  getHtml: () => (editor.value.isEmpty ? '' : editor.value.getHTML()),
  // [다시 불러오기]·[새 양식 적용]: 사용자 입력이 아니므로 change 를 보내지 않는다
  setHtml: (html) => {
    editor.value.commands.setContent(html, { emitUpdate: false });
    refresh();
  },
  editor,
});
</script>

<template>
  <div ref="root" class="report-editor">
    <ReportToolbar v-if="isEditable && isFocused" :editor="editor" :version="version" />
    <div class="editor-box" :class="{ 'is-readonly': !isEditable, 'is-focused': isEditable && isFocused, 'is-empty': isEmpty }">
      <EditorContent :editor="editor" />
    </div>
    <div v-if="isEditable && isCountShown" class="count-line" :class="countClass">
      {{ textLength.toLocaleString() }} / {{ MAX_SECTION_TEXT.toLocaleString() }}
    </div>
  </div>
</template>
