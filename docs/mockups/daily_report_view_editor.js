// 일일보고 시안: 편집기와 도구 막대 (D-155, D-163). daily_report_view.js 에서 역할별로 나눔
// daily_report_view.html 에서 daily_report_view.js 보다 먼저 불러온다 (ui 등은 실행할 때 읽는다)
const { Editor, StarterKit, Table, TableRow, TableHeader, TableCell, TextStyle, Color } = window.Tiptap;

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
