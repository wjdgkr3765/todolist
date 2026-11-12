<!-- 일일보고 편집기 도구 막대 (DailyReportView_screen.md "도구 막대", D-155, D-163). 커서가 있는 편집기 위에 하나만 -->
<script setup>
import { computed, ref } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { CELL_COLORS, LINK_PATTERN, TEXT_COLORS, cellAttrs } from '../utils/reportEditor.js';

const props = defineProps({
  editor: { type: Object, required: true },
  // 편집기 상태가 바뀔 때마다 늘어나는 값 (켜진 서식 다시 계산)
  version: { type: Number, required: true },
});

const toastStore = useToastStore();
const openPop = ref(null);
const linkHref = ref('');
const linkInput = ref(null);

const state = computed(() => {
  void props.version;
  const { editor } = props;
  const isInTable = editor.isActive('table');
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    strike: editor.isActive('strike'),
    bullet: editor.isActive('bulletList'),
    ordered: editor.isActive('orderedList'),
    link: editor.isActive('link'),
    canIndent: editor.can().sinkListItem('listItem'),
    canOutdent: editor.can().liftListItem('listItem'),
    isInTable,
    align: isInTable ? (cellAttrs(editor).textAlign ?? 'left') : null,
  };
});

const chain = () => props.editor.chain().focus();
const BASIC = [
  { cmd: 'bold', icon: 'bi-type-bold', label: '굵게', run: () => chain().toggleBold().run() },
  { cmd: 'italic', icon: 'bi-type-italic', label: '기울임', run: () => chain().toggleItalic().run() },
  { cmd: 'strike', icon: 'bi-type-strikethrough', label: '취소선', run: () => chain().toggleStrike().run() },
];
const LISTS = [
  { cmd: 'bullet', icon: 'bi-list-ul', label: '글머리 목록', run: () => chain().toggleBulletList().run() },
  { cmd: 'ordered', icon: 'bi-list-ol', label: '번호 목록', run: () => chain().toggleOrderedList().run() },
];
const TABLE = [
  { cmd: 'rowAdd', icon: 'bi-plus-square', label: '행 추가', run: () => chain().addRowAfter().run() },
  { cmd: 'rowDel', icon: 'bi-dash-square', label: '행 삭제', run: () => chain().deleteRow().run() },
  { cmd: 'colAdd', icon: 'bi-layout-split', label: '열 추가', run: () => chain().addColumnAfter().run() },
  { cmd: 'colDel', icon: 'bi-layout-sidebar-inset-reverse', label: '열 삭제', run: () => chain().deleteColumn().run() },
  { cmd: 'tableDel', icon: 'bi-trash3', label: '표 삭제', run: () => chain().deleteTable().run() },
];
const ALIGNS = [
  { value: 'left', icon: 'bi-text-left', label: '왼쪽 정렬' },
  { value: 'center', icon: 'bi-text-center', label: '가운데 정렬' },
  { value: 'right', icon: 'bi-text-right', label: '오른쪽 정렬' },
];

function togglePop(name) {
  openPop.value = openPop.value === name ? null : name;
  if (openPop.value === 'link') {
    linkHref.value = props.editor.getAttributes('link').href ?? '';
    setTimeout(() => linkInput.value?.focus());
  }
}
function setColor(color) {
  if (color) {
    chain().setColor(color).run();
  } else {
    chain().unsetColor().run();
  }
  openPop.value = null;
}
function setCellColor(color) {
  chain().setCellAttribute('backgroundColor', color).run();
  openPop.value = null;
}
// 왼쪽은 기본값이라 속성을 지운다
function setAlign(value) {
  chain().setCellAttribute('textAlign', value === 'left' ? null : value).run();
}
function setLink() {
  const href = linkHref.value.trim();
  if (!LINK_PATTERN.test(href)) {
    toastStore.show('error', '링크는 http://, https://, mailto: 로 시작해야 합니다.');
    return;
  }
  chain().extendMarkRange('link').setLink({ href }).run();
  openPop.value = null;
}
function unsetLink() {
  chain().extendMarkRange('link').unsetLink().run();
  openPop.value = null;
}
// 버튼을 눌러도 편집기 커서를 잃지 않게 한다 (링크 입력칸은 제외)
function keepFocus(event) {
  if (event.target.closest('button') && !event.target.closest('.link-pop')) {
    event.preventDefault();
  }
}
function onKeydown(event) {
  if (event.key === 'Escape' && openPop.value) {
    event.stopPropagation();
    openPop.value = null;
  }
}
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="서식" @mousedown="keepFocus" @keydown="onKeydown">
    <div class="tb-buttons">
      <button v-for="b in BASIC" :key="b.cmd" type="button" :class="{ 'is-on': state[b.cmd] }" :title="b.label" :aria-label="b.label" @click="b.run">
        <i class="bi" :class="b.icon"></i>
      </button>
      <button type="button" title="글자 색" aria-label="글자 색" @click="togglePop('color')"><i class="bi bi-palette"></i></button>
      <span class="tb-sep"></span>
      <button v-for="b in LISTS" :key="b.cmd" type="button" :class="{ 'is-on': state[b.cmd] }" :title="b.label" :aria-label="b.label" @click="b.run">
        <i class="bi" :class="b.icon"></i>
      </button>
      <button type="button" title="들여쓰기" aria-label="들여쓰기" :disabled="!state.canIndent" @click="chain().sinkListItem('listItem').run()"><i class="bi bi-text-indent-left"></i></button>
      <button type="button" title="내어쓰기" aria-label="내어쓰기" :disabled="!state.canOutdent" @click="chain().liftListItem('listItem').run()"><i class="bi bi-text-indent-right"></i></button>
      <span class="tb-sep"></span>
      <button type="button" title="표 넣기" aria-label="표 넣기" @click="chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"><i class="bi bi-table"></i></button>
      <button type="button" title="구분선" aria-label="구분선" @click="chain().setHorizontalRule().run()"><i class="bi bi-hr"></i></button>
      <button type="button" :class="{ 'is-on': state.link }" title="링크" aria-label="링크" @click="togglePop('link')"><i class="bi bi-link-45deg"></i></button>
      <template v-if="state.isInTable">
        <span class="tb-sep"></span>
        <button v-for="b in TABLE" :key="b.cmd" type="button" :title="b.label" :aria-label="b.label" @click="b.run"><i class="bi" :class="b.icon"></i></button>
        <span class="tb-sep"></span>
        <button type="button" title="셀 배경색" aria-label="셀 배경색" @click="togglePop('cell')"><i class="bi bi-paint-bucket"></i></button>
        <button v-for="a in ALIGNS" :key="a.value" type="button" :class="{ 'is-on': state.align === a.value }" :title="a.label" :aria-label="a.label" @click="setAlign(a.value)">
          <i class="bi" :class="a.icon"></i>
        </button>
      </template>
    </div>
    <div v-if="openPop === 'color'" class="tb-pop" style="top:100%;left:80px">
      <div class="color-dots">
        <button type="button" title="기본" aria-label="기본 색" style="background:#111827" @click="setColor(null)"></button>
        <button v-for="c in TEXT_COLORS" :key="c.value" type="button" :title="c.label" :aria-label="c.label" :style="{ background: c.value }" @click="setColor(c.value)"></button>
      </div>
    </div>
    <div v-if="openPop === 'cell' && state.isInTable" class="tb-pop" style="top:100%;right:0">
      <div class="color-dots cell-dots">
        <button type="button" title="없음" aria-label="배경색 없음" @click="setCellColor(null)"><i class="bi bi-slash-lg"></i></button>
        <button v-for="c in CELL_COLORS" :key="c.value" type="button" :title="c.label" :aria-label="c.label" :style="{ background: c.value }" @click="setCellColor(c.value)"></button>
      </div>
    </div>
    <div v-if="openPop === 'link'" class="tb-pop link-pop" style="top:100%;left:200px">
      <input ref="linkInput" v-model="linkHref" type="text" placeholder="https://" maxlength="500" aria-label="링크 주소" @keydown.enter.prevent="setLink" />
      <button type="button" class="btn-x btn-primary-x" @click="setLink">넣기</button>
      <button type="button" class="btn-x btn-outline-x" @click="unsetLink">지우기</button>
    </div>
  </div>
</template>
