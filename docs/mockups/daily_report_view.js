// 일일보고 시안 동작 (D-146, D-149, D-150~D-162). DailyReportView_screen.md "4. 동작"을 서버 없이 흉내 낸다.
// 시안 규칙: 오늘은 2026-11-11 (수), 나는 홍길동(관리자). 새로고침하면 처음 상태
// 편집기 내용은 Tiptap 이 다룬다. 사용자 입력은 escapeHtml 로만 HTML 에 넣는다
renderLayout({ space: 'team', tab: 'reports', hideTabs: false });

const { Editor, StarterKit, Table, TableRow, TableHeader, TableCell, TextStyle, Color } = window.Tiptap;
const TODAY = '2026-11-11';
const ME = '홍길동';
const MAX_TEXT = 5000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const STATUS_LABEL = { waiting: '대기', progress: '진행', done: '완료' };
const TYPE_LABEL = { stats: '통계', tasks: '작업 목록', text: '글' };
const RANGE_LABEL = { sinceLastReport: '지난 보고 이후', weekday: '지난 특정 요일 이후', monthDay: '매달 특정 날짜 이후', lastWeek: '지난 주', lastMonth: '지난 달' };

// ---------- 날짜 ----------
const parse = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
const ymdOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (ymd, n) => { const d = parse(ymd); d.setDate(d.getDate() + n); return ymdOf(d); };
const dotDate = (ymd) => `${ymd.replaceAll('-', '.')} (${WEEKDAYS[parse(ymd).getDay()]})`;
const md = (ymd) => { const d = parse(ymd); return `${d.getMonth() + 1}/${d.getDate()}`; };
const nowHm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ---------- 가짜 데이터 ----------
// 팀원: 합류일 이전 날짜에는 목록에 나오지 않는다 (D-158)
const MEMBERS = [
  { name: '홍길동', join: '2026-11-01' },
  { name: '이영희', join: '2026-11-02' },
  { name: '김민수', join: '2026-11-03' },
  { name: '박지성', join: '2026-11-05' },
];
const FORMER = '최수진'; // 11.10 에 제출하고 팀을 나간 사람 (닉네임만 보인다)

const MONITOR_DEFAULT = '<table><tbody><tr><th><p>담당시스템</p></th><th><p>등급</p></th><th><p>월</p></th><th><p>화</p></th><th><p>수</p></th><th><p>목</p></th><th><p>금</p></th><th><p>이상내용</p></th></tr>'
  + '<tr><td><p>홈페이지</p></td><td><p>3등급</p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p>N/A</p></td></tr>'
  + '<tr><td><p>소통광장</p></td><td><p>4등급</p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p>N/A</p></td></tr>'
  + '<tr><td><p>총무포탈</p></td><td><p>3등급</p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p>N/A</p></td></tr></tbody></table>';
const MONITOR_MON_TUE = MONITOR_DEFAULT.replace(/(<td><p>[34]등급<\/p><\/td>)<td><p><\/p><\/td><td><p><\/p><\/td>/g, '$1<td><p>○</p></td><td><p>○</p></td>');

// 기본 양식 (팀을 만들면 들어가는 양식, D-152)
const DEFAULT_TEMPLATE = () => ({
  header: '{날짜} 진행 사항입니다.',
  sections: [
    { title: '◆ 통계', type: 'stats', statuses: [], doneRange: { kind: 'sinceLastReport' }, defaultHtml: '' },
    { title: '◆ 진행', type: 'tasks', statuses: ['progress'], doneRange: null, defaultHtml: '' },
    { title: '◆ 대기', type: 'tasks', statuses: ['waiting'], doneRange: null, defaultHtml: '' },
    { title: '◆ 완료', type: 'tasks', statuses: ['done'], doneRange: { kind: 'sinceLastReport' }, defaultHtml: '' },
    { title: '◆ 기타', type: 'text', statuses: [], doneRange: null, defaultHtml: '' },
  ],
});
// 이 팀이 고쳐 둔 양식 (사용자 보고 모양을 흉내 냄)
const TEAM_TEMPLATE = () => ({
  header: '{날짜} 진행 사항 및 모니터링 내용입니다.',
  sections: [
    { title: '◆ 통계', type: 'stats', statuses: [], doneRange: { kind: 'sinceLastReport' }, defaultHtml: '' },
    { title: '◆ 진행 중인 작업', type: 'tasks', statuses: ['progress', 'waiting'], doneRange: null, defaultHtml: '' },
    { title: '◆ 완료한 작업', type: 'tasks', statuses: ['done'], doneRange: { kind: 'sinceLastReport' }, defaultHtml: '' },
    { title: '◆ 주요 내용', type: 'text', statuses: [], doneRange: null, defaultHtml: '' },
    { title: '◆ 시스템 모니터링', type: 'text', statuses: [], doneRange: null, defaultHtml: MONITOR_DEFAULT },
  ],
});

// 내가 작업자인 이 팀 작업. done 은 완료로 옮긴 시각 (한국 시간)
const MY_TASKS = () => [
  { title: '메인 화면 시안 정리', start: '2026-11-10', end: '2026-11-20', status: 'progress', order: 0 },
  { title: '로그인 오류 수정', start: '2026-11-03', end: '2026-11-12', status: 'progress', order: 1 },
  { title: '주간 회의 자료', start: '2026-11-13', end: '2026-11-13', status: 'waiting', order: 0 },
  { title: '연말 행사 준비', start: '2026-12-29', end: '2027-01-05', status: 'waiting', order: 1 },
  { title: '참고 사이트 조사', start: null, end: null, status: 'waiting', order: 2 },
  { title: 'DB 설계', start: '2026-11-01', end: '2026-11-07', status: 'done', done: '2026-11-10 15:20' },
  { title: '회의록 정리', start: '2026-11-09', end: '2026-11-09', status: 'done', done: '2026-11-09 11:00' },
  { title: '요구사항 정리', start: '2026-10-27', end: '2026-11-04', status: 'done', done: '2026-11-04 17:30' },
  { title: '10월 결산 보고', start: '2026-10-26', end: '2026-10-28', status: 'done', done: '2026-10-28 18:00' },
];
const MY_LAST_SUBMIT = '2026-11-10 09:05'; // 내 마지막 제출 보고(11.10)의 첫 제출 시각

let model;
function resetModel() {
  model = {
    role: 'owner',
    template: pageParams.get('team') ? DEFAULT_TEMPLATE() : TEAM_TEMPLATE(),
    tasks: MY_TASKS(),
    carryOver: false,
    reports: {}, // `${date}|${name}` → 보고
  };
  seedReports();
}

// ---------- 완료 범위 (D-154) ----------
function rangeOf(range) {
  const today = parse(TODAY);
  const atMidnight = (d) => `${ymdOf(d)} 00:00`;
  if (!range || range.kind === 'sinceLastReport') { return [MY_LAST_SUBMIT, null]; }
  if (range.kind === 'weekday') {
    const target = range.weekday % 7; // 1(월)~7(일) → getDay
    const d = new Date(today);
    do { d.setDate(d.getDate() - 1); } while (d.getDay() !== target);
    return [atMidnight(d), null];
  }
  if (range.kind === 'monthDay') {
    const pick = (y, m) => new Date(y, m, Math.min(range.day, new Date(y, m + 1, 0).getDate()));
    let d = pick(today.getFullYear(), today.getMonth());
    if (d >= today) { d = pick(today.getFullYear(), today.getMonth() - 1); }
    return [atMidnight(d), null];
  }
  if (range.kind === 'lastWeek') {
    const monday = new Date(today);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const lastMonday = new Date(monday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    return [atMidnight(lastMonday), atMidnight(monday)];
  }
  return [atMidnight(new Date(today.getFullYear(), today.getMonth() - 1, 1)), atMidnight(new Date(today.getFullYear(), today.getMonth(), 1))];
}
function doneInRange(range) {
  const [from, to] = rangeOf(range);
  return model.tasks.filter((t) => t.status === 'done' && t.done >= from && (!to || t.done < to)).sort((a, b) => (a.done < b.done ? 1 : -1));
}

// ---------- 자동 채우기 (D-153) ----------
function periodText(task) {
  if (!task.start) { return '[미정]'; }
  const year = TODAY.slice(0, 4);
  const one = (ymd) => (ymd.slice(0, 4) === year ? md(ymd) : `${ymd.slice(0, 4)}/${md(ymd)}`);
  return task.start === task.end ? `[${one(task.start)}]` : `[${one(task.start)}~${one(task.end)}]`;
}
function autoHtml(section) {
  if (section.type === 'stats') {
    const count = (s) => model.tasks.filter((t) => t.status === s).length;
    return `<p>: 완료 ${doneInRange(section.doneRange).length}건, 진행 ${count('progress')}건, 대기 ${count('waiting')}건</p>`;
  }
  const list = [];
  ['progress', 'waiting', 'done'].filter((s) => section.statuses.includes(s)).forEach((s) => {
    const tasks = s === 'done' ? doneInRange(section.doneRange) : model.tasks.filter((t) => t.status === s).sort((a, b) => a.order - b.order);
    tasks.forEach((t) => list.push(`<li><p>${periodText(t)} ${escapeHtml(t.title)} - [${STATUS_LABEL[s]}]</p></li>`));
  });
  return list.length ? `<ul>${list.join('')}</ul>` : '';
}

// ---------- 보고 만들기 ----------
const cloneSection = (s) => ({ title: s.title, type: s.type, statuses: [...s.statuses], doneRange: s.doneRange ? { ...s.doneRange } : null });
function headerOf(date) { return model.template.header.replaceAll('{날짜}', md(date)); }
// 지금 양식으로 초안 (carry: 이어받기로 채울지)
function buildDraft(carry) {
  const last = model.reports[`2026-11-10|${ME}`];
  return {
    status: 'new',
    header: headerOf(TODAY),
    sections: model.template.sections.map((s) => {
      let html = s.defaultHtml;
      if (s.type !== 'text') { html = autoHtml(s); }
      else if (carry && last) { const old = last.sections.find((o) => o.type === 'text' && o.title === s.title); if (old) { html = old.html; } }
      return { ...cloneSection(s), html };
    }),
  };
}
function seedReports() {
  const tpl = TEAM_TEMPLATE();
  const make = (date, name, status, at, extra = {}) => {
    const sections = tpl.sections.map((s) => {
      let html = '';
      if (s.type === 'stats') { html = '<p>: 완료 1건, 진행 2건, 대기 1건</p>'; }
      else if (s.type === 'tasks') { html = s.statuses.includes('done') ? '<ul><li><p>[11/3~11/7] 화면 목록 정리 - [완료]</p></li></ul>' : `<ul><li><p>[11/5~11/14] ${escapeHtml(name)} 담당 작업 - [진행]</p></li></ul>`; }
      else if (s.title.includes('모니터링')) { html = MONITOR_MON_TUE; }
      else { html = `<ul><li><p>[11/23~11/27] 휴가</p></li></ul><p>특이 사항 없음.</p>`; }
      return { ...cloneSection(s), html };
    });
    model.reports[`${date}|${name}`] = { status, name, header: tpl.header.replaceAll('{날짜}', md(date)), sections, submitAt: status === 'submitted' ? at : null, updateAt: null, draftAt: status === 'draft' ? at : null, ...extra };
  };
  // 오늘: 이영희 제출, 김민수 제출 후 수정, 박지성 미제출, 나는 작성 전
  make(TODAY, '이영희', 'submitted', '09:12');
  make(TODAY, '김민수', 'submitted', '08:55', { updateAt: '10:05' });
  // 어제(11.10): 나·이영희·박지성·최수진 제출, 김민수 미제출
  make('2026-11-10', ME, 'submitted', '09:05');
  make('2026-11-10', '이영희', 'submitted', '09:20');
  make('2026-11-10', '박지성', 'submitted', '10:02');
  make('2026-11-10', FORMER, 'submitted', '09:40');
  // 그 전 날짜: 모두 제출 (11.06 은 이영희 미제출, 내 보고는 임시저장만 남음)
  for (let d = '2026-11-01'; d < '2026-11-10'; d = addDays(d, 1)) {
    MEMBERS.filter((m) => m.join <= d).forEach((m) => {
      if (d === '2026-11-06' && m.name === '이영희') { return; }
      if (d === '2026-11-06' && m.name === ME) { make(d, ME, 'draft', '18:40'); return; }
      make(d, m.name, 'submitted', '09:10');
    });
  }
}

// ---------- 화면 상태 ----------
const ui = { date: TODAY, selected: ME, view: null, dirty: false, editors: [], focused: null, narrowForced: false };
const isMine = () => ui.selected === ME;
const isTodayMine = () => ui.date === TODAY && isMine();
const canEdit = () => isTodayMine() && ui.view && ui.view.status !== 'none';

// ---------- 팀원 보고 현황 (D-158) ----------
function statusItems() {
  const items = [];
  MEMBERS.forEach((m) => {
    if (m.name !== ME && m.join > ui.date) { return; }
    const r = model.reports[`${ui.date}|${m.name}`];
    let status = r ? r.status : 'none';
    if (status === 'draft' && m.name !== ME) { status = 'none'; }
    items.push({ name: m.name, isMe: m.name === ME, status, report: r });
  });
  Object.values(model.reports).forEach((r) => {
    if (r.status === 'submitted' && model.reports[`${ui.date}|${r.name}`] === r && !MEMBERS.some((m) => m.name === r.name)) { items.push({ name: r.name, isMe: false, status: 'submitted', report: r }); }
  });
  return items;
}
function renderStatus() {
  const items = statusItems();
  const submitted = items.filter((i) => i.status === 'submitted').length;
  $('status-count').textContent = `제출 ${submitted} / 전체 ${items.length}`;
  $('status-list').innerHTML = items.map((i) => {
    const badge = { submitted: '<span class="rb rb-submitted">제출 완료</span>', draft: '<span class="rb rb-draft">임시저장</span>', none: '<span class="rb rb-none">미제출</span>' }[i.status];
    const sub = i.status === 'submitted' ? `제출 ${i.report.submitAt}${i.report.updateAt ? ' · 수정됨' : ''}` : '';
    return `<button type="button" class="status-row${i.name === ui.selected ? ' is-selected' : ''}" data-name="${escapeHtml(i.name)}">
      <div class="status-line"><span>${escapeHtml(i.name)}${i.isMe ? '<span class="me-mark">(나)</span>' : ''}</span>${badge}</div>
      <div class="status-sub">${sub}</div></button>`;
  }).join('');
}

// ---------- 편집기 (D-155) ----------
// 표 셀 배경색·정렬 (D-163). 클릭한 셀 또는 드래그로 고른 셀들에 setCellAttribute 로 넣는다
const styleOf = (el, re) => ((el.getAttribute('style') || '').match(re) || [])[1] || null;
const CELL_ATTRS = {
  backgroundColor: {
    default: null,
    // 브라우저는 #RRGGBB 를 rgb(r, g, b) 로 바꿔 적으므로 둘 다 읽어 #RRGGBB 로 맞춘다
    parseHTML: (el) => {
      const rgb = el.style.backgroundColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (rgb) { return `#${rgb.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`; }
      return styleOf(el, /background-color:\s*(#[0-9a-fA-F]{6})/);
    },
    renderHTML: (attrs) => (attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {}),
  },
  textAlign: {
    default: null,
    parseHTML: (el) => styleOf(el, /text-align:\s*(center|right)/),
    renderHTML: (attrs) => (attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {}),
  },
};
const StyledCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...CELL_ATTRS }; } });
const StyledHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...CELL_ATTRS }; } });
const cellAttrs = (editor) => (editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell'));

function makeEditor(element, html, editable, onChange) {
  const editor = new Editor({
    element,
    editable,
    content: html,
    extensions: [
      StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, underline: false, link: { openOnClick: !editable, autolink: true, protocols: ['mailto'], HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } } }),
      Table.configure({ resizable: false }),
      TableRow,
      StyledHeader,
      StyledCell,
      TextStyle,
      Color,
    ],
    // 표 뒤 빈 줄 자동 추가처럼 편집기가 스스로 고친 것은 수정으로 보지 않는다 (사용자 입력만 docChanged)
    onUpdate: ({ transaction }) => { refreshEmpty(); if (onChange && transaction.docChanged) { onChange(editor); } },
    onFocus: () => focusEditor(editor),
    onSelectionUpdate: () => refreshToolbar(),
    onTransaction: () => refreshToolbar(),
  });
  const box = element;
  const refreshEmpty = () => box.classList.toggle('is-empty', editor.isEmpty);
  refreshEmpty();
  editor.box = box;
  return editor;
}
const textLength = (editor) => editor.state.doc.textContent.length;

function focusEditor(editor) {
  ui.focused = editor;
  document.querySelectorAll('.editor-box.is-focused').forEach((box) => box.classList.remove('is-focused'));
  editor.box.classList.add('is-focused');
  editor.box.parentNode.insertBefore($('toolbar'), editor.box);
  show('toolbar');
  refreshToolbar();
}
function hideToolbar() {
  hide('toolbar', 'color-pop', 'link-pop', 'cell-pop');
  document.querySelectorAll('.editor-box.is-focused').forEach((box) => box.classList.remove('is-focused'));
  document.body.appendChild($('toolbar'));
  ui.focused = null;
}
function refreshToolbar() {
  const editor = ui.focused;
  if (!editor || $('toolbar').classList.contains('is-hidden')) { return; }
  const on = { bold: 'bold', italic: 'italic', strike: 'strike', bullet: 'bulletList', ordered: 'orderedList', link: 'link' };
  $('toolbar').querySelectorAll('button[data-cmd]').forEach((b) => b.classList.toggle('is-on', Boolean(on[b.dataset.cmd]) && editor.isActive(on[b.dataset.cmd])));
  $('toolbar').querySelector('[data-cmd=indent]').disabled = !editor.can().sinkListItem('listItem');
  $('toolbar').querySelector('[data-cmd=outdent]').disabled = !editor.can().liftListItem('listItem');
  const inTable = editor.isActive('table');
  $('toolbar').querySelectorAll('.table-only').forEach((el) => el.classList.toggle('is-hidden', !inTable));
  if (inTable) {
    const align = cellAttrs(editor).textAlign || 'left';
    ['left', 'center', 'right'].forEach((a) => $('toolbar').querySelector(`[data-cmd=align-${a}]`).classList.toggle('is-on', align === a));
  } else { hide('cell-pop'); }
}
function runCommand(cmd) {
  const editor = ui.focused;
  if (!editor) { return; }
  const chain = () => editor.chain().focus();
  const actions = {
    bold: () => chain().toggleBold().run(),
    italic: () => chain().toggleItalic().run(),
    strike: () => chain().toggleStrike().run(),
    color: () => { hide('link-pop', 'cell-pop'); $('color-pop').classList.toggle('is-hidden'); },
    cellColor: () => { hide('link-pop', 'color-pop'); $('cell-pop').classList.toggle('is-hidden'); },
    'align-left': () => chain().setCellAttribute('textAlign', null).run(),
    'align-center': () => chain().setCellAttribute('textAlign', 'center').run(),
    'align-right': () => chain().setCellAttribute('textAlign', 'right').run(),
    bullet: () => chain().toggleBulletList().run(),
    ordered: () => chain().toggleOrderedList().run(),
    indent: () => chain().sinkListItem('listItem').run(),
    outdent: () => chain().liftListItem('listItem').run(),
    table: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    hr: () => chain().setHorizontalRule().run(),
    link: () => { hide('color-pop', 'cell-pop'); $('link-input').value = editor.getAttributes('link').href || ''; $('link-pop').classList.toggle('is-hidden'); if (!$('link-pop').classList.contains('is-hidden')) { $('link-input').focus(); } },
    rowAdd: () => chain().addRowAfter().run(),
    rowDel: () => chain().deleteRow().run(),
    colAdd: () => chain().addColumnAfter().run(),
    colDel: () => chain().deleteColumn().run(),
    tableDel: () => chain().deleteTable().run(),
  };
  actions[cmd]();
}
$('toolbar').addEventListener('mousedown', (event) => { if (event.target.closest('button') && !event.target.closest('#link-pop')) { event.preventDefault(); } });
$('toolbar').addEventListener('click', (event) => {
  const cmdButton = event.target.closest('button[data-cmd]');
  if (cmdButton) { runCommand(cmdButton.dataset.cmd); return; }
  const colorButton = event.target.closest('button[data-color]');
  if (colorButton && ui.focused) {
    const color = colorButton.dataset.color;
    if (color) { ui.focused.chain().focus().setColor(color).run(); } else { ui.focused.chain().focus().unsetColor().run(); }
    hide('color-pop');
    return;
  }
  const bgButton = event.target.closest('button[data-bg]');
  if (bgButton && ui.focused) {
    ui.focused.chain().focus().setCellAttribute('backgroundColor', bgButton.dataset.bg || null).run();
    hide('cell-pop');
  }
});
// 링크: http·https·mailto 만 (D-155)
function setLink() {
  const href = $('link-input').value.trim();
  if (!/^(https?:\/\/|mailto:)\S+$/i.test(href)) { flash('error', '링크는 http://, https://, mailto: 로 시작해야 합니다.'); return; }
  ui.focused.chain().focus().extendMarkRange('link').setLink({ href }).run();
  hide('link-pop');
}
$('btn-link-set').addEventListener('click', setLink);
$('link-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); setLink(); } });
$('btn-link-unset').addEventListener('click', () => { ui.focused.chain().focus().extendMarkRange('link').unsetLink().run(); hide('link-pop'); });
document.addEventListener('mousedown', (event) => {
  if (!ui.focused) { return; }
  if (event.target.closest('.editor-box, #toolbar')) { return; }
  hideToolbar();
});

// ---------- 보고 영역 ----------
function destroyEditors() {
  hideToolbar();
  ui.editors.forEach((e) => e.destroy());
  ui.editors = [];
}
function stateText(view) {
  if (view.status === 'new') { return '작성 전'; }
  if (view.status === 'draft') { return `임시저장 · ${view.draftAt}${ui.date !== TODAY ? ' (제출하지 않음)' : ''}`; }
  return view.updateAt ? `제출 완료 · ${view.submitAt} · 수정됨 · ${view.updateAt}` : `제출 완료 · ${view.submitAt}`;
}
function updateCounts() {
  let over = false;
  ui.editors.forEach((editor) => {
    if (!editor.countEl) { return; }
    const n = textLength(editor);
    editor.countEl.textContent = `${n.toLocaleString()} / ${MAX_TEXT.toLocaleString()}`;
    editor.countEl.classList.toggle('is-warn', n >= 4500 && n <= MAX_TEXT);
    editor.countEl.classList.toggle('is-over', n > MAX_TEXT);
    if (n > MAX_TEXT) { over = true; }
  });
  $('btn-draft').disabled = over;
  $('btn-submit').disabled = over;
}
function renderReport() {
  destroyEditors();
  const view = ui.view;
  hide('report-loading');
  if (!view || view.status === 'none') {
    hide('report-body');
    show('report-empty');
    return;
  }
  hide('report-empty');
  show('report-body');
  const editable = canEdit();
  $('report-who').innerHTML = `${escapeHtml(ui.selected)}<small>${dotDate(ui.date)}</small>`;
  $('report-state').textContent = stateText(view);
  $('report-tools').classList.toggle('is-hidden', !editable);
  $('report-actions').classList.toggle('is-hidden', !editable);
  $('carry-switch').checked = model.carryOver;
  $('report-header-line').textContent = view.header;
  $('report-header-line').classList.toggle('is-hidden', !view.header);
  $('btn-draft').classList.toggle('is-hidden', view.status === 'submitted');
  setLabel($('btn-draft'), '임시저장');
  setLabel($('btn-submit'), view.status === 'submitted' ? '수정 제출' : '제출');
  $('sections').innerHTML = view.sections.map((s, i) => `
    <div class="section-block" data-index="${i}">
      <div class="rs-title">${escapeHtml(s.title)}${editable && s.type !== 'text' ? `<button type="button" class="btn-x btn-outline-x reload" data-reload="${i}"><i class="bi bi-arrow-clockwise"></i>다시 불러오기</button>` : ''}</div>
      <div class="editor-box${editable ? '' : ' is-readonly'}"></div>
      ${editable ? '<div class="count-line"></div>' : ''}
    </div>`).join('');
  document.querySelectorAll('#sections .section-block').forEach((block, i) => {
    const editor = makeEditor(block.querySelector('.editor-box'), view.sections[i].html, editable, () => { ui.dirty = true; updateCounts(); });
    editor.countEl = block.querySelector('.count-line');
    ui.editors.push(editor);
  });
  updateCounts();
}
// 고른 사람·날짜의 보고를 연다 (서버 응답을 흉내 내 잠깐 기다린다)
async function openReport() {
  ui.dirty = false;
  destroyEditors();
  hide('report-body', 'report-empty');
  show('report-loading');
  await wait(250);
  const saved = model.reports[`${ui.date}|${ui.selected}`];
  if (isTodayMine()) { ui.view = saved ? structuredClone(saved) : buildDraft(model.carryOver); }
  else if (saved && (saved.status === 'submitted' || isMine())) { ui.view = structuredClone(saved); }
  else { ui.view = { status: 'none' }; }
  renderReport();
}
function collectSections() { return ui.view.sections.map((s, i) => ({ ...s, html: ui.editors[i].getHTML() === '<p></p>' ? '' : ui.editors[i].getHTML() })); }

// ---------- 저장하지 않고 나가기 (D-157) ----------
let confirmAction = null;
function openConfirm(title, text, okLabel, onOk, cancelLabel = '취소', danger = false) {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-cancel').textContent = cancelLabel;
  setLabel($('confirm-ok'), escapeHtml(okLabel));
  $('confirm-ok').className = `btn-x ${danger ? 'btn-danger-x' : 'btn-primary-x'}`;
  confirmAction = onOk;
  show('confirm');
}
function guard(next) {
  if (!ui.dirty) { next(); return; }
  openConfirm('저장하지 않은 내용', '저장하지 않은 내용이 있습니다. 나갈까요?', '나가기', () => { ui.dirty = false; next(); }, '머무르기', true);
}
$('confirm-ok').addEventListener('click', () => { const action = confirmAction; confirmAction = null; hide('confirm'); if (action) { action(); } });
$('confirm-cancel').addEventListener('click', () => { confirmAction = null; hide('confirm'); });
closeOnBackdrop('confirm', () => { confirmAction = null; });
// 다른 탭·팀·로그아웃으로 옮길 때
document.addEventListener('click', (event) => {
  const link = event.target.closest('.side-nav a[href], .menu-tabs a[href]');
  if (!link || !ui.dirty) { return; }
  event.preventDefault();
  event.stopPropagation();
  guard(() => { location.href = link.getAttribute('href'); });
}, true);
window.addEventListener('beforeunload', (event) => { if (ui.dirty) { event.preventDefault(); event.returnValue = ''; } });

// ---------- 날짜·행 ----------
function renderDate() {
  $('date-text').textContent = dotDate(ui.date);
  $('btn-next-day').disabled = ui.date >= TODAY;
  $('btn-today').disabled = ui.date >= TODAY;
}
async function goDate(date) {
  ui.date = date;
  ui.selected = ME;
  renderDate();
  hide('status-list');
  show('status-loading');
  await wait(200);
  hide('status-loading');
  show('status-list');
  renderStatus();
  showReportPane();
  await openReport();
}
$('btn-prev-day').addEventListener('click', () => guard(() => goDate(addDays(ui.date, -1))));
$('btn-next-day').addEventListener('click', () => guard(() => goDate(addDays(ui.date, 1))));
$('btn-today').addEventListener('click', () => guard(() => goDate(TODAY)));
$('status-list').addEventListener('click', (event) => {
  const row = event.target.closest('.status-row');
  if (!row) { return; }
  guard(() => { ui.selected = row.dataset.name; renderStatus(); showReportPane(); openReport(); });
});

// ---------- 좁은 화면 (D-161) ----------
const narrowQuery = window.matchMedia('(max-width: 991.98px)');
function applyNarrow() { document.body.classList.toggle('is-narrow', narrowQuery.matches || ui.narrowForced); }
narrowQuery.addEventListener('change', applyNarrow);
function showReportPane() { $('report-layout').classList.remove('show-list'); $('report-layout').classList.add('show-report'); }
function showListPane() { $('report-layout').classList.add('show-list'); $('report-layout').classList.remove('show-report'); }
$('btn-back').addEventListener('click', () => guard(() => { ui.dirty = false; showListPane(); }));

// ---------- 다시 불러오기·새 양식 적용·이어받기 ----------
$('sections').addEventListener('click', (event) => {
  const button = event.target.closest('[data-reload]');
  if (!button) { return; }
  const i = Number(button.dataset.reload);
  openConfirm('다시 불러오기', '이 구역을 지금 칸반 내용으로 다시 채울까요? 고친 내용은 사라집니다.', '다시 불러오기', async () => {
    setLoading(button, '불러오는 중');
    await wait(300);
    ui.editors[i].commands.setContent(autoHtml(ui.view.sections[i]));
    ui.dirty = true;
    setLabel(button, '<i class="bi bi-arrow-clockwise"></i>다시 불러오기');
    updateCounts();
  });
});
$('btn-apply-template').addEventListener('click', () => {
  openConfirm('새 양식 적용', '지금 팀 양식으로 보고를 다시 만들까요? 제목이 같은 글 구역은 쓰던 내용을 옮기고, 나머지는 새로 채웁니다.', '적용', async () => {
    const current = collectSections();
    const fresh = buildDraft(false);
    fresh.sections.forEach((s) => { if (s.type === 'text') { const old = current.find((o) => o.type === 'text' && o.title === s.title); if (old) { s.html = old.html; } } });
    ui.view = { ...ui.view, header: fresh.header, sections: fresh.sections };
    renderReport();
    ui.dirty = true;
    flash('success', '새 양식을 적용했습니다. 저장해야 남습니다.');
  });
});
$('carry-switch').addEventListener('change', async () => {
  const on = $('carry-switch').checked;
  $('carry-switch').disabled = true;
  await wait(300);
  $('carry-switch').disabled = false;
  model.carryOver = on;
  flash('success', `지난 보고 이어받기를 ${on ? '켰습니다' : '껐습니다'}.`, '다음에 새 보고를 열 때 적용됩니다.');
});

// ---------- 임시저장·제출 (D-157) ----------
async function save(action) {
  const button = action === 'draft' ? $('btn-draft') : $('btn-submit');
  const wasSubmitted = ui.view.status === 'submitted';
  setLoading(button, action === 'draft' ? '저장 중...' : '제출 중...');
  await wait(500);
  const saved = { ...(model.reports[`${TODAY}|${ME}`] || {}), name: ME, header: ui.view.header, sections: collectSections() };
  if (action === 'draft') {
    Object.assign(saved, { status: 'draft', draftAt: nowHm(), submitAt: null, updateAt: null });
  } else if (wasSubmitted) {
    saved.updateAt = nowHm();
  } else {
    Object.assign(saved, { status: 'submitted', submitAt: nowHm(), updateAt: null });
  }
  model.reports[`${TODAY}|${ME}`] = saved;
  ui.view = structuredClone(saved);
  ui.dirty = false;
  $('report-state').textContent = stateText(ui.view);
  $('btn-draft').classList.toggle('is-hidden', ui.view.status === 'submitted');
  setLabel($('btn-draft'), '임시저장');
  setLabel($('btn-submit'), ui.view.status === 'submitted' ? '수정 제출' : '제출');
  updateCounts();
  renderStatus();
  flash('success', action === 'draft' ? '임시저장했습니다.' : (wasSubmitted ? '보고를 수정했습니다.' : '보고를 제출했습니다.'));
}
$('btn-draft').addEventListener('click', () => save('draft'));
$('btn-submit').addEventListener('click', () => save('submit'));

// ---------- 양식 설정 모달 (D-152, D-154) ----------
let tplDraft = null;
let tplEditors = [];
let tplSortable = null;
function rangeControls(s, i) {
  const r = s.doneRange || { kind: 'sinceLastReport' };
  return `<div class="range"><span class="label">완료 범위</span>
    <select data-field="kind" data-i="${i}">${Object.entries(RANGE_LABEL).map(([k, v]) => `<option value="${k}"${r.kind === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
    ${r.kind === 'weekday' ? `<select data-field="weekday" data-i="${i}">${[1, 2, 3, 4, 5, 6, 7].map((w) => `<option value="${w}"${r.weekday === w ? ' selected' : ''}>${WEEKDAYS[w % 7]}요일</option>`).join('')}</select>` : ''}
    ${r.kind === 'monthDay' ? `<select data-field="day" data-i="${i}">${Array.from({ length: 31 }, (_, k) => k + 1).map((d) => `<option value="${d}"${r.day === d ? ' selected' : ''}>${d}일</option>`).join('')}</select>` : ''}</div>`;
}
function syncTplEditors() { tplEditors.forEach((e, i) => { if (e && tplDraft.sections[i]) { tplDraft.sections[i].defaultHtml = e.getHTML() === '<p></p>' ? '' : e.getHTML(); } }); }
function renderTpl(errors = {}) {
  hideToolbar();
  tplEditors.forEach((e) => e && e.destroy());
  tplEditors = [];
  $('tpl-sections').innerHTML = tplDraft.sections.map((s, i) => `
    <div class="tpl-card" data-i="${i}">
      <div class="tpl-row">
        <i class="bi bi-grip-vertical grip" aria-label="끌어서 순서 바꾸기"></i>
        <input type="text" data-field="title" data-i="${i}" maxlength="30" value="${escapeHtml(s.title)}" class="${errors[i] ? 'is-invalid' : ''}" aria-label="구역 제목" />
        <select data-field="type" data-i="${i}" aria-label="구역 종류">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}"${s.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <button type="button" class="icon-button" data-remove="${i}" aria-label="구역 삭제"${tplDraft.sections.length <= 1 ? ' disabled' : ''}><i class="bi bi-trash"></i></button>
      </div>
      ${errors[i] ? `<div class="message is-error" style="margin-left:26px"><i class="bi bi-exclamation-circle"></i>${escapeHtml(errors[i])}</div>` : ''}
      <div class="tpl-sub">
        ${s.type === 'tasks' ? `<div class="checks"><span class="label">상태</span>${['waiting', 'progress', 'done'].map((st) => `<label><input type="checkbox" data-field="status" data-status="${st}" data-i="${i}"${s.statuses.includes(st) ? ' checked' : ''} /> ${STATUS_LABEL[st]}</label>`).join('')}</div>` : ''}
        ${s.type === 'stats' || (s.type === 'tasks' && s.statuses.includes('done')) ? rangeControls(s, i) : ''}
        ${s.type === 'text' ? '<span class="label">기본 내용</span><div class="editor-box tpl-editor"></div>' : ''}
      </div>
    </div>`).join('');
  document.querySelectorAll('#tpl-sections .tpl-card').forEach((card, i) => {
    const box = card.querySelector('.tpl-editor');
    tplEditors[i] = box ? makeEditor(box, tplDraft.sections[i].defaultHtml, true) : null;
  });
  $('btn-tpl-add').disabled = tplDraft.sections.length >= 20;
  if (tplSortable) { tplSortable.destroy(); }
  tplSortable = Sortable.create($('tpl-sections'), {
    handle: '.grip', animation: 150, forceFallback: true, fallbackTolerance: 5,
    onEnd: (event) => {
      syncTplEditors();
      const [moved] = tplDraft.sections.splice(event.oldIndex, 1);
      tplDraft.sections.splice(event.newIndex, 0, moved);
      renderTpl();
    },
  });
}
async function openTemplate() {
  setLoading($('btn-template'), '양식 설정');
  await wait(250);
  setLabel($('btn-template'), '<i class="bi bi-sliders"></i>양식 설정');
  tplDraft = structuredClone(model.template);
  $('tpl-header').value = tplDraft.header;
  show('tpl-modal');
  renderTpl();
}
function closeTemplate() {
  hideToolbar();
  tplEditors.forEach((e) => e && e.destroy());
  tplEditors = [];
  hide('tpl-modal');
}
$('btn-template').addEventListener('click', openTemplate);
$('tpl-sections').addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset.field === 'title') { tplDraft.sections[Number(el.dataset.i)].title = el.value; el.classList.remove('is-invalid'); }
});
$('tpl-sections').addEventListener('change', (event) => {
  const el = event.target;
  const i = Number(el.dataset.i);
  const s = tplDraft.sections[i];
  if (!s) { return; }
  syncTplEditors();
  if (el.dataset.field === 'type') {
    s.type = el.value;
    s.statuses = s.type === 'tasks' ? ['progress'] : [];
    s.doneRange = s.type === 'stats' ? { kind: 'sinceLastReport' } : null;
  } else if (el.dataset.field === 'status') {
    s.statuses = ['waiting', 'progress', 'done'].filter((st) => (st === el.dataset.status ? el.checked : s.statuses.includes(st)));
    s.doneRange = s.statuses.includes('done') ? (s.doneRange || { kind: 'sinceLastReport' }) : null;
  } else if (el.dataset.field === 'kind') {
    s.doneRange = { kind: el.value, weekday: el.value === 'weekday' ? 1 : null, day: el.value === 'monthDay' ? 1 : null };
  } else if (el.dataset.field === 'weekday') {
    s.doneRange.weekday = Number(el.value);
  } else if (el.dataset.field === 'day') {
    s.doneRange.day = Number(el.value);
  } else { return; }
  renderTpl();
});
$('tpl-sections').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button || button.disabled) { return; }
  syncTplEditors();
  tplDraft.sections.splice(Number(button.dataset.remove), 1);
  renderTpl();
});
$('btn-tpl-add').addEventListener('click', () => {
  syncTplEditors();
  let name = '새 구역';
  for (let n = 2; tplDraft.sections.some((s) => s.title === name); n += 1) { name = `새 구역 ${n}`; }
  tplDraft.sections.push({ title: name, type: 'text', statuses: [], doneRange: null, defaultHtml: '' });
  renderTpl();
  const inputs = document.querySelectorAll('#tpl-sections input[data-field=title]');
  inputs[inputs.length - 1].focus();
});
// 화면 검사 (DailyReportView_screen.md 모달 [저장])
function validateTpl() {
  const errors = {};
  tplDraft.sections.forEach((s, i) => {
    const title = s.title.trim();
    if (!title) { errors[i] = '구역 제목을 입력해 주세요.'; }
    else if (title.length > 30) { errors[i] = '구역 제목은 30자 이하로 입력해 주세요.'; }
    else if (tplDraft.sections.some((o, j) => j !== i && o.title.trim() === title)) { errors[i] = '구역 제목이 겹칩니다.'; }
    else if (s.type === 'tasks' && !s.statuses.length) { errors[i] = '상태를 하나 이상 골라 주세요.'; }
    else if (s.type === 'text' && tplEditors[i] && textLength(tplEditors[i]) > MAX_TEXT) { errors[i] = '기본 내용은 5,000자 이하로 입력해 주세요.'; }
  });
  return errors;
}
async function saveTemplate() {
  syncTplEditors();
  tplDraft.header = $('tpl-header').value.trim();
  const errors = validateTpl();
  if (Object.keys(errors).length) {
    renderTpl(errors);
    document.querySelector('#tpl-sections input.is-invalid, #tpl-sections .message')?.closest('.tpl-card').querySelector('input').focus();
    return;
  }
  setLoading($('btn-tpl-save'), '저장 중...');
  await wait(500);
  setLabel($('btn-tpl-save'), '저장');
  if (model.role === 'member') {
    closeTemplate();
    hide('btn-template');
    flash('error', '권한이 없습니다.');
    return;
  }
  tplDraft.sections.forEach((s) => { s.title = s.title.trim(); });
  model.template = structuredClone(tplDraft);
  closeTemplate();
  flash('success', '양식을 저장했습니다.', '새로 여는 보고부터 적용됩니다.');
}
$('btn-tpl-save').addEventListener('click', saveTemplate);
$('btn-tpl-cancel').addEventListener('click', closeTemplate);
$('tpl-x').addEventListener('click', closeTemplate);
closeOnBackdrop('tpl-modal', closeTemplate);
escapeHandlers.push(() => {
  if (!$('confirm').classList.contains('is-hidden')) { hide('confirm'); confirmAction = null; return; }
  if (['color-pop', 'link-pop', 'cell-pop'].some((id) => !$(id).classList.contains('is-hidden'))) { hide('color-pop', 'link-pop', 'cell-pop'); return; }
  if (!$('tpl-modal').classList.contains('is-hidden')) { closeTemplate(); }
});

// ---------- 실시간 반영 흉내 (D-159) ----------
function liveSubmit(name) {
  model.reports[`${TODAY}|${name}`] = { ...structuredClone(model.reports[`${TODAY}|이영희`]), name, submitAt: nowHm(), updateAt: null };
  if (ui.date === TODAY) { renderStatus(); }
  if (ui.date === TODAY && ui.selected === name) { openReport(); }
}

// ---------- 시안 상태 ----------
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
addToast('toast-not-today', 'error', '날짜가 바뀌어 지난 보고는 고칠 수 없습니다.', '오늘 보고를 다시 불러왔습니다.');
addToast('toast-already', 'error', '이미 제출한 보고입니다.', '[수정 제출]로 저장해 주세요.');
addToast('toast-too-long', 'error', '보고 내용이 너무 깁니다.', '');

async function resetState() {
  clearFlash();
  hide('confirm', 'tpl-modal');
  closeTemplate();
  confirmAction = null;
  resetModel();
  ui.date = TODAY;
  ui.selected = ME;
  ui.dirty = false;
  ui.narrowForced = false;
  applyNarrow();
  showListPane();
  if (!narrowQuery.matches) { showReportPane(); }
  show('btn-template');
  renderDate();
  hide('status-loading');
  show('status-list');
  renderStatus();
}
// 시안 상태용: 표의 (행, 열) 범위 셀들을 고른다 (드래그로 고른 것과 같은 CellSelection)
function selectCells(editor, row1, col1, row2, col2) {
  const rows = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'tableRow') { return true; }
    const cells = [];
    node.forEach((cell, offset) => cells.push(pos + 1 + offset));
    rows.push(cells);
    return false;
  });
  editor.commands.setCellSelection({ anchorCell: rows[row1][col1], headCell: rows[row2][col2] });
}
const selectRow = async (name) => { ui.selected = name; renderStatus(); showReportPane(); await openReport(); };
const STATES = {
  'default': { label: '기본: 오늘, 작성 전 초안 (직접 눌러 보세요)', run: () => openReport() },
  'loading': { label: '로딩 중', run: () => { hide('status-list', 'report-body', 'report-empty'); show('status-loading', 'report-loading'); } },
  'carry-on': { label: '이어받기 켜짐: 글 구역에 지난 보고 내용', run: () => { model.carryOver = true; openReport(); } },
  'draft-saved': { label: '오늘, 임시저장함', run: async () => { await openReport(); await save('draft'); clearFlash(); } },
  'submitted': { label: '오늘, 제출함', run: async () => { await openReport(); await save('submit'); clearFlash(); } },
  'edited': { label: '오늘, 수정 제출함', run: async () => { await openReport(); await save('submit'); await save('submit'); clearFlash(); } },
  'auto-empty': { label: '자동 구역이 빔 (내 작업 없음)', run: () => { model.tasks = []; openReport(); } },
  'toolbar': { label: '편집기 도구 막대 + 글자 색', run: async () => { await openReport(); ui.editors[3].commands.focus(); show('color-pop'); } },
  'table-tools': { label: '표 안에 커서 (표 도구)', run: async () => { await openReport(); const e = ui.editors[4]; e.commands.focus(); e.commands.setTextSelection(5); refreshToolbar(); } },
  'cell-style': { label: '표 셀 여러 개 골라 배경색 + 가운데 정렬', run: async () => { await openReport(); const e = ui.editors[4]; e.commands.focus(); selectCells(e, 1, 2, 3, 6); e.chain().setCellAttribute('backgroundColor', '#E8F6EE').setCellAttribute('textAlign', 'center').run(); show('cell-pop'); refreshToolbar(); } },
  'over': { label: '글자 수 넘침', run: async () => { await openReport(); ui.editors[3].commands.setContent(`<p>${'가'.repeat(5001)}</p>`); ui.dirty = true; updateCounts(); } },
  'saving': { label: '저장 중', run: async () => { await openReport(); setLoading($('btn-submit'), '제출 중...'); } },
  'other-read': { label: '남의 보고 읽기 (이영희)', run: () => selectRow('이영희') },
  'other-edited': { label: '남의 보고 읽기 (김민수, 수정됨)', run: () => selectRow('김민수') },
  'missing': { label: '미제출 (박지성)', run: () => selectRow('박지성') },
  'past': { label: '지난 날짜 (11.10, 지금 팀에 없는 제출자 최수진)', run: () => goDate('2026-11-10') },
  'past-draft': { label: '지난 날짜, 제출하지 않은 내 임시저장 (11.06)', run: () => goDate('2026-11-06') },
  'past-before-join': { label: '박지성 합류 전 날짜 (11.04)', run: () => goDate('2026-11-04') },
  'member': { label: '팀원 (양식 설정 권한 없음)', run: () => { model.role = 'member'; hide('btn-template'); openReport(); } },
  'confirm-reload': { label: '확인창: 다시 불러오기', run: async () => { await openReport(); document.querySelector('[data-reload]').click(); } },
  'confirm-apply': { label: '확인창: 새 양식 적용', run: async () => { await openReport(); $('btn-apply-template').click(); } },
  'confirm-leave': { label: '확인창: 저장하지 않고 나가기', run: async () => { await openReport(); ui.dirty = true; guard(() => {}); } },
  'tpl': { label: '양식 설정 모달', run: async () => { await openReport(); await openTemplate(); } },
  'tpl-default': { label: '양식 설정: 새 팀의 기본 양식', run: async () => { model.template = DEFAULT_TEMPLATE(); await openReport(); await openTemplate(); } },
  'tpl-weekday': { label: '양식 설정: 완료 범위 요일 고르기', run: async () => { await openReport(); await openTemplate(); tplDraft.sections[2].doneRange = { kind: 'weekday', weekday: 1 }; tplDraft.sections[0].doneRange = { kind: 'monthDay', day: 5 }; renderTpl(); } },
  'tpl-error': { label: '양식 설정: 입력 오류', run: async () => { await openReport(); await openTemplate(); tplDraft.sections[1].title = ''; tplDraft.sections[2].title = tplDraft.sections[0].title; tplDraft.sections[1].statuses = []; await saveTemplate(); } },
  'live': { label: '실시간: 박지성이 방금 제출함', run: async () => { await openReport(); liveSubmit('박지성'); } },
  'narrow-list': { label: '좁은 화면: 목록', run: () => { ui.narrowForced = true; applyNarrow(); showListPane(); openReport(); } },
  'narrow-report': { label: '좁은 화면: 보고 전체 + [‹ 목록]', run: () => { ui.narrowForced = true; applyNarrow(); showReportPane(); openReport(); } },
  'error-server': { label: '오류: 서버 오류', run: async () => { await openReport(); show('toast-server'); } },
  'error-not-today': { label: '오류: 날짜가 바뀜 (REPORT_NOT_TODAY)', run: async () => { await openReport(); show('toast-not-today'); } },
  'error-already': { label: '오류: 이미 제출함 (REPORT_ALREADY_SUBMITTED)', run: async () => { await openReport(); show('toast-already'); } },
  'error-too-long': { label: '오류: 내용이 너무 김 (400)', run: async () => { await openReport(); show('toast-too-long'); } },
};
setupStates(STATES, resetState);
