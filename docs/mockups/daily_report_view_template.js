// 일일보고 시안: 양식 설정 모달 (D-152, D-154, D-175). daily_report_view.js 에서 역할별로 나눔
// daily_report_view.html 에서 daily_report_view.js 보다 먼저 불러온다 (model 등은 실행할 때 읽는다)

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
