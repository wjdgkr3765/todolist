// 작업 시안 동작 (D-146). TaskView_screen.md "4. 동작"을 서버 없이 화면 안에서만 흉내 낸다.
// 데이터는 아래 가짜 데이터이고 새로고침하면 처음으로 돌아간다. 사용자 입력은 모두 escapeHtml 또는 textContent 로 넣는다.

const isTeam = pageParams.get('space') === 'team';
renderLayout({ space: isTeam ? 'team' : 'personal', tab: 'tasks', hideTabs: false });
if (!isTeam) { document.querySelectorAll('.team-only').forEach((el) => el.remove()); }

const ME = '홍길동';
const TODAY = '2026-11-11';
const NOW = '2026-11-11 10:30';
const STATUS_LABEL = { waiting: '대기', progress: '진행', done: '완료' };
const TEAM_MEMBERS = [
  { name: '홍길동', email: 'user@example.com' },
  { name: '이영희', email: 'younghee@example.com' },
  { name: '김민수', email: 'minsu@example.com' },
  { name: '박지성', email: 'jisung.park@example.com' },
];

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dot = (date) => date.replaceAll('-', '.');

// ---------- 가짜 데이터 ----------
function period(start, end, startTime, endTime) {
  return { start, end, startTime: startTime || null, endTime: endTime || null, undecided: !start };
}
function initialData() {
  const tasks = [
    { id: 1, title: '메인 화면 시안 정리', content: '메인 화면 시안을 정리해 공유한다.', ...period('2026-11-10', '2026-11-20', '09:00', '18:00'), status: 'waiting', assignees: ['홍길동', '이영희', '김민수'] },
    { id: 2, title: 'API 명세 검토', content: '회원·팀 API 의 요청과 응답 형식을 다시 확인한다.\n오류 코드가 화면 문서와 맞는지도 본다.', ...period('2026-11-05', '2026-11-09', '09:00', '18:00'), status: 'waiting', assignees: ['김민수', '홍길동'] },
    { id: 3, title: '회의록 공유', content: '지난 회의록을 팀에 공유한다.', ...period(null), status: 'waiting', assignees: [] },
    { id: 4, title: '로그인 화면 구현', content: '로그인 화면을 시안대로 만든다.', ...period('2026-11-11', '2026-11-14'), status: 'progress', assignees: ['홍길동'] },
    { id: 5, title: '주간 보고서 작성 길게 넘치는 제목 테스트 문구입니다', content: '이번 주 보고서를 쓴다.', ...period('2026-11-12', '2026-11-12', '09:00', '18:00'), status: 'progress', assignees: ['이영희'] },
    { id: 6, title: 'DB 설계', content: '테이블과 컬럼을 정한다.', ...period('2026-11-01', '2026-11-07'), status: 'done', assignees: ['홍길동'] },
  ];
  const logs = {};
  tasks.forEach((task) => { logs[task.id] = [makeLog(task, '작업 생성', '2026.11.05 13:00', '홍길동')]; });
  const t2 = tasks[1];
  logs[2] = [
    makeLog({ ...t2, status: 'waiting' }, '작업자 변경', '2026.11.11 10:20', '홍길동'),
    makeLog({ ...t2, status: 'waiting', assignees: ['김민수'] }, '작업 수정 · 상태 변경 (진행 → 대기)', '2026.11.08 16:02', '김민수'),
    makeLog({ ...t2, status: 'progress', assignees: ['김민수'] }, '상태 변경 (대기 → 진행)', '2026.11.06 09:30', '김민수'),
    makeLog({ ...t2, status: 'waiting', assignees: ['김민수'] }, '작업 생성', '2026.11.05 13:00', '홍길동'),
  ];
  if (!isTeam) { logs[2] = logs[2].filter((log) => log.type !== '작업자 변경'); }
  return {
    todos: [
      { id: 101, title: '디자인 시스템 정리', content: '색, 글꼴, 간격 값을 한 파일로 모은다.', ...period('2026-11-12', '2026-11-18', '10:00', '17:30') },
      { id: 102, title: '팀 회의 자료 준비하기 위해 필요한 내용 정리하고 공유하기', content: '회의 자료를 준비한다.', ...period('2026-11-13', '2026-11-13', '14:00', '15:30') },
      { id: 103, title: '디자인 리뷰 준비', content: '리뷰할 화면을 고른다.', ...period('2026-11-16', '2026-11-17') },
      { id: 104, title: '참고 자료 찾기', content: '비슷한 서비스를 찾아본다.', ...period(null) },
    ],
    tasks,
    logs,
  };
}
function makeLog(task, type, at, nickname) {
  return { type, at, nickname, snap: { ...task, assignees: [...task.assignees] } };
}

let data;
let ui;
let clockMinute = 30;
function resetModel() {
  data = initialData();
  ui = { selectedTodoId: null, selectedTaskId: null, panel: 'none', editingTodoId: null, myOnly: false, loading: false, pickerSelection: [] };
}
// 수정 내역의 사람: 작업 생성은 "만든 사람", 나머지는 "수정한 사람" (D-147)
const logActor = (log) => `${log.type === '작업 생성' ? '만든 사람' : '수정한 사람'} ${log.nickname}`;
const nowText = () => { clockMinute += 1; return `2026.11.11 10:${String(clockMinute % 60).padStart(2, '0')}`; };

// ---------- 기간 표시 (D-139, D-142) ----------
function periodFull(item) {
  if (item.undecided) { return null; }
  if (item.startTime) {
    return item.start === item.end
      ? `${dot(item.start)} ${item.startTime} ~ ${item.endTime}`
      : `${dot(item.start)} ${item.startTime} ~ ${dot(item.end)} ${item.endTime}`;
  }
  return item.start === item.end ? dot(item.start) : `${dot(item.start)} ~ ${dot(item.end)}`;
}
const periodEnd = (item) => `~ ${dot(item.end)}${item.endTime ? ` ${item.endTime}` : ''}`;
function isOverdue(task) {
  if (task.undecided || task.status === 'done') { return false; }
  return task.endTime ? `${task.end} ${task.endTime}` < NOW : task.end < TODAY;
}
const undecidedBadge = '<span class="badge-x badge-undecided">미정</span>';
function assigneeText(list) {
  if (!list.length) { return null; }
  return list.length === 1 ? list[0] : `${list[0]} 외 ${list.length - 1}명`;
}

// ---------- 토스트 (동작 결과는 2.5초 뒤 사라진다) ----------
let toastTimer = null;
addToast('toast-live-success', 'success', '', '');
addToast('toast-live-error', 'error', '', '');
function flash(kind, title, sub) {
  hideAllToasts();
  const box = $(kind === 'success' ? 'toast-live-success' : 'toast-live-error');
  box.querySelector('div').innerHTML = `${escapeHtml(title)}${sub ? `<div class="toast-sub">${escapeHtml(sub)}</div>` : ''}`;
  box.classList.remove('is-hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('is-hidden'), 2500);
}

// ---------- 할일 목록 ----------
function renderTodos() {
  const body = $('todo-body');
  body.innerHTML = '';
  data.todos.forEach((todo) => {
    const row = document.createElement('tr');
    if (todo.id === ui.selectedTodoId) { row.classList.add('is-selected'); }
    const full = periodFull(todo);
    row.innerHTML = `<td>${escapeHtml(todo.title)}</td><td ${full ? `title="${escapeHtml(full)}"` : ''}>${full ? escapeHtml(periodEnd(todo)) : undecidedBadge}</td>`;
    row.addEventListener('click', () => { ui.selectedTodoId = ui.selectedTodoId === todo.id ? null : todo.id; renderTodos(); });
    body.appendChild(row);
  });
  $('todo-count').textContent = `(${data.todos.length}개)`;
  $('todo-table').classList.toggle('is-hidden', ui.loading || !data.todos.length);
  $('todo-empty').classList.toggle('is-hidden', ui.loading || data.todos.length > 0);
  $('todo-loading').classList.toggle('is-hidden', !ui.loading);
  const hasSelection = ui.selectedTodoId !== null;
  ['btn-edit', 'btn-delete', 'btn-start'].forEach((id) => { $(id).disabled = !hasSelection; });
}

// ---------- 칸반 ----------
function cardHtml(task) {
  const full = periodFull(task);
  const overdue = isOverdue(task);
  const periodHtml = full
    ? `<div class="card-period${overdue ? ' is-overdue' : ''}" title="${escapeHtml(full)}"><span class="period-text">${escapeHtml(periodEnd(task))}</span>${overdue ? '<span class="badge-x badge-overdue">기한 지남</span>' : ''}</div>`
    : `<div class="card-period">${undecidedBadge}</div>`;
  let assignee = '';
  if (isTeam && task.assignees.length) {
    const icon = task.assignees.length === 1 ? 'bi-person' : 'bi-people';
    const more = task.assignees.length > 1 ? `<span class="more">외 ${task.assignees.length - 1}명</span>` : '';
    assignee = `<div class="card-assignee" title="${escapeHtml(task.assignees.join(', '))}"><i class="bi ${icon}"></i><span class="name">${escapeHtml(task.assignees[0])}</span>${more}</div>`;
  }
  return `<div class="card-title">${escapeHtml(task.title)}</div>${periodHtml}${assignee}`;
}
function visibleTasks(status) {
  return data.tasks.filter((task) => task.status === status && (!ui.myOnly || task.assignees.includes(ME)));
}
function renderKanban() {
  const columns = $('kanban-columns');
  columns.innerHTML = '';
  let total = 0;
  Object.entries(STATUS_LABEL).forEach(([status, label]) => {
    const tasks = visibleTasks(status);
    total += tasks.length;
    const column = document.createElement('div');
    column.className = `kanban-column status-${status}`;
    column.innerHTML = `<div class="column-head"><span class="column-dot"></span>${label}<span class="column-count">${tasks.length}</span></div>`;
    const list = document.createElement('div');
    list.className = 'card-list';
    if (ui.loading) {
      list.innerHTML = '<div class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>';
    } else if (!tasks.length) {
      list.innerHTML = '<div class="column-empty">작업이 없습니다</div>';
    }
    tasks.forEach((task) => {
      if (ui.loading) { return; }
      const card = document.createElement('div');
      card.className = `task-card${task.id === ui.selectedTaskId ? ' is-selected' : ''}`;
      card.dataset.id = task.id;
      card.innerHTML = cardHtml(task);
      card.addEventListener('click', () => openDetail(task.id));
      list.appendChild(card);
    });
    list.dataset.status = status;
    makeSortable(list);
    column.appendChild(list);
    columns.appendChild(column);
  });
  $('kanban-count').textContent = `(${total}개)`;
  $('kanban').classList.toggle('is-drag-locked', ui.myOnly);
}

// ---------- 드래그 (SortableJS, 실제 화면의 vuedraggable 과 같은 라이브러리) ----------
// 같은 공간: 순서만 (수정 내역 없음, D-013). 다른 공간: 상태 변경 + 수정 내역, 놓은 자리 (D-069)
function makeSortable(list) {
  Sortable.create(list, {
    group: 'kanban',
    draggable: '.task-card',
    animation: 150,
    delay: 150,
    delayOnTouchOnly: true, // 터치는 0.15초 누르고 있어야 드래그 시작 (TaskView_screen.md 반응형 기준)
    forceFallback: true, // 끌고 있는 카드 모양(그림자 + 기울임)을 직접 그린다
    fallbackOnBody: true,
    ghostClass: 'is-ghost',
    fallbackClass: 'is-dragging',
    emptyInsertThreshold: 40, // 빈 공간에도 놓기 쉽게
    disabled: ui.myOnly || ui.loading, // 내 작업만 보기 중에는 순서 변경 불가 (D-126)
    onStart: () => document.querySelectorAll('.column-empty').forEach((el) => el.classList.add('is-hidden')),
    onEnd: onSortEnd,
  });
}
function onSortEnd(event) {
  const task = data.tasks.find((item) => item.id === Number(event.item.dataset.id));
  const status = event.to.dataset.status;
  const index = event.newDraggableIndex;
  const before = task.status;
  if (before === status && event.oldDraggableIndex === index) { renderKanban(); return; }
  data.tasks.splice(data.tasks.indexOf(task), 1);
  const others = data.tasks.filter((item) => item.status === status);
  task.status = status;
  if (others[index]) { data.tasks.splice(data.tasks.indexOf(others[index]), 0, task); } else { data.tasks.push(task); }
  if (before !== status) {
    data.logs[task.id].unshift(makeLog(task, `상태 변경 (${STATUS_LABEL[before]} → ${STATUS_LABEL[status]})`, nowText(), ME));
  }
  renderKanban();
  if (ui.selectedTaskId === task.id && ui.panel === 'detail-read') { renderDetail(); }
}

// ---------- 기간 입력 (할일 입력 UI 와 작업 수정이 같이 쓴다. p = 'todo' | 'edit') ----------
function setPeriodInputs(p, item) {
  $(`${p}-start`).value = item && !item.undecided ? item.start : '';
  $(`${p}-end`).value = item && !item.undecided ? item.end : '';
  $(`${p}-undecided`).checked = Boolean(item && item.undecided);
  $(`${p}-time`).checked = Boolean(item && item.startTime);
  $(`${p}-start-time`).value = item && item.startTime ? item.startTime : '09:00';
  $(`${p}-end-time`).value = item && item.endTime ? item.endTime : '18:00';
  applyPeriodLocks(p);
}
function applyPeriodLocks(p) {
  const undecided = $(`${p}-undecided`).checked;
  if (undecided) { $(`${p}-time`).checked = false; }
  $(`${p}-time`).disabled = undecided;
  ['start', 'end'].forEach((key) => {
    $(`${p}-${key}`).disabled = undecided;
    $(`${p}-ctl-${key}`).classList.toggle('is-locked', undecided);
    if (undecided) { $(`${p}-${key}`).value = ''; }
  });
  $(`${p}-time-row`).classList.toggle('is-hidden', !$(`${p}-time`).checked);
}
function bindPeriodInputs(p) {
  $(`${p}-undecided`).addEventListener('change', () => applyPeriodLocks(p));
  $(`${p}-time`).addEventListener('change', () => {
    if ($(`${p}-time`).checked) { $(`${p}-start-time`).value = '09:00'; $(`${p}-end-time`).value = '18:00'; }
    applyPeriodLocks(p);
  });
  ['title', 'content'].forEach((key) => {
    $(`${p}-${key}`).addEventListener('input', () => { $(`${p}-${key}-count`).textContent = $(`${p}-${key}`).value.length; });
  });
}
function clearErrors(p) {
  ['title', 'content', 'start', 'end', 'start-time', 'end-time'].forEach((key) => $(`${p}-ctl-${key}`).classList.remove('is-invalid'));
  hide(`${p}-title-error`, `${p}-content-error`, `${p}-period-error`);
}
// 화면 검사 (TaskView_screen.md "화면 검사"). 통과하면 값 객체, 아니면 null
function readForm(p) {
  clearErrors(p);
  const errors = [];
  const title = $(`${p}-title`).value.trim();
  const content = $(`${p}-content`).value.trim();
  if (!title) { $(`${p}-ctl-title`).classList.add('is-invalid'); show(`${p}-title-error`); errors.push(`${p}-title`); }
  if (!content) { $(`${p}-ctl-content`).classList.add('is-invalid'); show(`${p}-content-error`); errors.push(`${p}-content`); }
  const undecided = $(`${p}-undecided`).checked;
  const timeOn = $(`${p}-time`).checked;
  const start = $(`${p}-start`).value;
  const end = $(`${p}-end`).value;
  const startTime = $(`${p}-start-time`).value;
  const endTime = $(`${p}-end-time`).value;
  let periodError = '';
  let bad = [];
  if (!undecided) {
    const fiveMinutes = (time) => Number(time.slice(3, 5)) % 5 === 0;
    if (!start || !end) { periodError = '시작일과 종료일을 선택해 주세요.'; bad = ['start', 'end'].filter((key) => !$(`${p}-${key}`).value); }
    else if (end < start) { periodError = '종료일은 시작일과 같거나 뒤여야 합니다.'; bad = ['end']; }
    else if (timeOn && (!startTime || !endTime)) { periodError = '시작 시각과 종료 시각을 선택해 주세요.'; bad = ['start-time', 'end-time']; }
    else if (timeOn && (!fiveMinutes(startTime) || !fiveMinutes(endTime))) { periodError = '시간은 5분 단위로 선택해 주세요.'; bad = ['start-time', 'end-time']; }
    else if (timeOn && start === end && endTime < startTime) { periodError = '종료 시각은 시작 시각과 같거나 뒤여야 합니다.'; bad = ['end-time']; }
  }
  if (periodError) {
    bad.forEach((key) => $(`${p}-ctl-${key}`).classList.add('is-invalid'));
    $(`${p}-period-error-text`).textContent = periodError;
    show(`${p}-period-error`);
    errors.push(`${p}-${bad[0]}`);
  }
  if (errors.length) { $(errors[0]).focus(); return null; }
  return {
    title, content, undecided,
    start: undecided ? null : start, end: undecided ? null : end,
    startTime: !undecided && timeOn ? startTime : null, endTime: !undecided && timeOn ? endTime : null,
  };
}

// ---------- 오른쪽 UI ----------
function showPanel(panel) {
  ui.panel = panel;
  $('todo-form').classList.toggle('is-hidden', !panel.startsWith('todo'));
  $('task-detail').classList.toggle('is-hidden', !panel.startsWith('detail'));
  $('detail-read').classList.toggle('is-hidden', panel !== 'detail-read');
  $('detail-edit').classList.toggle('is-hidden', panel !== 'detail-edit');
  $('detail-title').textContent = panel === 'detail-edit' ? '작업 수정' : '작업 상세';
  hide('strip-todo-changed', 'strip-task-changed');
  if (isTeam) { hide('assignee-menu'); }
}
function closePanel() {
  ui.selectedTaskId = null;
  ui.editingTodoId = null;
  showPanel('none');
  renderKanban();
}
function openTodoForm(editing) {
  ui.selectedTaskId = null;
  renderKanban();
  const todo = editing ? data.todos.find((item) => item.id === ui.selectedTodoId) : null;
  ui.editingTodoId = todo ? todo.id : null;
  $('todo-form-title').textContent = todo ? '할일 수정' : '할일 추가';
  $('todo-title').value = todo ? todo.title : '';
  $('todo-content').value = todo ? todo.content : '';
  $('todo-title-count').textContent = $('todo-title').value.length;
  $('todo-content-count').textContent = $('todo-content').value.length;
  setPeriodInputs('todo', todo);
  clearErrors('todo');
  $('btn-todo-save').disabled = false;
  $('btn-todo-save').textContent = '저장';
  showPanel(todo ? 'todo-edit' : 'todo-add');
}
function saveTodo() {
  const value = readForm('todo');
  if (!value) { return; }
  if (ui.editingTodoId) {
    Object.assign(data.todos.find((item) => item.id === ui.editingTodoId), value);
    ui.selectedTodoId = ui.editingTodoId;
    flash('success', '할일을 수정했습니다.');
  } else {
    const todo = { id: Date.now(), ...value };
    data.todos.unshift(todo);
    ui.selectedTodoId = todo.id;
    flash('success', '할일을 추가했습니다.');
  }
  ui.editingTodoId = null;
  showPanel('none');
  renderTodos();
}
function startTask() {
  const todo = data.todos.find((item) => item.id === ui.selectedTodoId);
  data.todos.splice(data.todos.indexOf(todo), 1);
  const task = { ...todo, id: Date.now(), status: 'waiting', assignees: [] };
  data.tasks.unshift(task);
  data.logs[task.id] = [makeLog(task, '작업 생성', nowText(), ME)];
  if (ui.editingTodoId === todo.id) { showPanel('none'); }
  ui.selectedTodoId = null;
  renderTodos();
  renderKanban();
  flash('success', '작업을 시작했습니다.');
}

function selectedTask() { return data.tasks.find((task) => task.id === ui.selectedTaskId); }
function openDetail(taskId) {
  ui.selectedTaskId = taskId;
  ui.editingTodoId = null;
  showPanel('detail-read');
  renderKanban();
  renderDetail();
}
function setStatusBadge(element, status) {
  element.className = `badge-x badge-${status}`;
  element.textContent = STATUS_LABEL[status];
}
function renderDetail() {
  const task = selectedTask();
  setStatusBadge($('d-status'), task.status);
  $('d-title').textContent = task.title;
  const full = periodFull(task);
  const overdue = isOverdue(task);
  $('d-period').className = `detail-value${overdue ? ' is-overdue' : ''}`;
  $('d-period').innerHTML = full ? `${escapeHtml(full)}${overdue ? '<span class="badge-x badge-overdue">기한 지남</span>' : ''}` : undecidedBadge;
  if (isTeam) { $('d-assignee').innerHTML = task.assignees.length ? escapeHtml(task.assignees.join(', ')) : '<span class="muted">없음</span>'; }
  $('d-content').textContent = task.content;
  renderLogs();
}
function renderLogs() {
  const logs = data.logs[ui.selectedTaskId] || [];
  $('log-count').textContent = `(${logs.length})`;
  $('log-list').innerHTML = '';
  logs.forEach((log, index) => {
    const row = document.createElement('div');
    row.className = 'log-row';
    row.innerHTML = `<div><div class="log-type">${escapeHtml(log.type)}</div><div class="log-meta">${escapeHtml(log.at)} · ${escapeHtml(logActor(log))}</div></div><i class="bi bi-chevron-right"></i>`;
    row.addEventListener('click', () => openLog(index));
    $('log-list').appendChild(row);
  });
}
function openLog(index) {
  const log = data.logs[ui.selectedTaskId][index];
  $('lm-type').textContent = log.type;
  $('lm-meta').textContent = `${log.at} · ${logActor(log)}`;
  setStatusBadge($('lm-status'), log.snap.status);
  $('lm-title').textContent = log.snap.title;
  const full = periodFull(log.snap);
  $('lm-period').innerHTML = full ? escapeHtml(full) : undecidedBadge;
  if (isTeam) { $('lm-assignee').innerHTML = log.snap.assignees.length ? escapeHtml(log.snap.assignees.join(', ')) : '<span class="muted">없음</span>'; }
  $('lm-content').textContent = log.snap.content;
  show('log-modal');
}

// ---------- 작업 수정 ----------
function startEdit() {
  const task = selectedTask();
  $('edit-status').value = task.status;
  $('edit-title').value = task.title;
  $('edit-content').value = task.content;
  $('edit-title-count').textContent = task.title.length;
  $('edit-content-count').textContent = task.content.length;
  setPeriodInputs('edit', task);
  clearErrors('edit');
  if (isTeam) { ui.pickerSelection = [...task.assignees]; renderPicker(); }
  $('btn-task-save').disabled = false;
  $('btn-task-save').textContent = '저장';
  showPanel('detail-edit');
}
function renderPicker() {
  const text = assigneeText(ui.pickerSelection);
  $('picker-value').innerHTML = text ? escapeHtml(text) : '<span class="placeholder-text">작업자 선택</span>';
  $('assignee-options').innerHTML = '';
  TEAM_MEMBERS.forEach((member) => {
    const option = document.createElement('label');
    option.className = 'assignee-option';
    option.innerHTML = `<input type="checkbox" ${ui.pickerSelection.includes(member.name) ? 'checked' : ''} /><span><b>${escapeHtml(member.name)}</b><small>${escapeHtml(member.email)}</small></span>`;
    option.querySelector('input').addEventListener('change', (event) => {
      // 체크한 순서가 지정한 순서 (TaskView_screen.md 작업자)
      ui.pickerSelection = event.target.checked ? [...ui.pickerSelection, member.name] : ui.pickerSelection.filter((name) => name !== member.name);
      $('picker-value').innerHTML = assigneeText(ui.pickerSelection) ? escapeHtml(assigneeText(ui.pickerSelection)) : '<span class="placeholder-text">작업자 선택</span>';
    });
    $('assignee-options').appendChild(option);
  });
}
function saveTask() {
  const value = readForm('edit');
  if (!value) { return; }
  const task = selectedTask();
  const status = $('edit-status').value;
  const keys = ['title', 'content', 'start', 'end', 'startTime', 'endTime', 'undecided'];
  const contentChanged = keys.some((key) => value[key] !== task[key]);
  const assignees = isTeam ? ui.pickerSelection : task.assignees;
  const assigneeChanged = isTeam && [...assignees].sort().join() !== [...task.assignees].sort().join();
  const statusChanged = status !== task.status;
  if (!contentChanged && !assigneeChanged && !statusChanged) {
    showPanel('detail-read');
    flash('success', '바뀐 내용이 없습니다.');
    return;
  }
  // 바뀐 것만 "작업 수정 · 작업자 변경 · 상태 변경 (대기 → 진행)" 순서로 (D-067, D-100)
  const parts = [];
  if (contentChanged) { parts.push('작업 수정'); }
  if (assigneeChanged) { parts.push('작업자 변경'); }
  if (statusChanged) { parts.push(`상태 변경 (${STATUS_LABEL[task.status]} → ${STATUS_LABEL[status]})`); }
  Object.assign(task, value, { assignees: [...assignees] });
  if (statusChanged) {
    // 상태 드롭다운으로 바꾸면 옮겨 간 공간의 맨 위 (D-069)
    task.status = status;
    data.tasks.splice(data.tasks.indexOf(task), 1);
    data.tasks.unshift(task);
  }
  data.logs[task.id].unshift(makeLog(task, parts.join(' · '), nowText(), ME));
  showPanel('detail-read');
  renderKanban();
  renderDetail();
  flash('success', '작업을 수정했습니다.');
}

// ---------- 확인창 ----------
function openConfirmTodo() {
  $('ct-target').textContent = data.todos.find((item) => item.id === ui.selectedTodoId).title;
  $('btn-confirm-todo').disabled = false; $('btn-confirm-todo').textContent = '삭제';
  show('confirm-todo');
}
function deleteTodo() {
  data.todos = data.todos.filter((item) => item.id !== ui.selectedTodoId);
  if (ui.editingTodoId === ui.selectedTodoId) { showPanel('none'); }
  ui.selectedTodoId = null;
  hide('confirm-todo');
  renderTodos();
  flash('success', '할일을 삭제했습니다.');
}
function openConfirmTask() {
  $('ck-target').textContent = selectedTask().title;
  $('btn-confirm-task').disabled = false; $('btn-confirm-task').textContent = '삭제';
  show('confirm-task');
}
function deleteTask() {
  data.tasks = data.tasks.filter((item) => item.id !== ui.selectedTaskId);
  delete data.logs[ui.selectedTaskId];
  hide('confirm-task');
  closePanel();
  flash('success', '작업을 삭제했습니다.');
}

// ---------- 이벤트 연결 ----------
bindPeriodInputs('todo');
bindPeriodInputs('edit');
$('btn-add').addEventListener('click', () => openTodoForm(false));
$('btn-edit').addEventListener('click', () => openTodoForm(true));
$('btn-delete').addEventListener('click', openConfirmTodo);
$('btn-start').addEventListener('click', startTask);
$('btn-todo-save').addEventListener('click', saveTodo);
['btn-todo-cancel', 'btn-todo-close'].forEach((id) => $(id).addEventListener('click', () => { ui.editingTodoId = null; showPanel('none'); }));
$('btn-detail-edit').addEventListener('click', startEdit);
$('btn-detail-delete').addEventListener('click', openConfirmTask);
$('btn-detail-close').addEventListener('click', closePanel);
$('btn-edit-cancel').addEventListener('click', () => showPanel('detail-read'));
$('btn-task-save').addEventListener('click', saveTask);
$('btn-confirm-todo').addEventListener('click', deleteTodo);
$('btn-confirm-task').addEventListener('click', deleteTask);
$('btn-confirm-todo-cancel').addEventListener('click', () => hide('confirm-todo'));
$('btn-confirm-task-cancel').addEventListener('click', () => hide('confirm-task'));
['btn-log-x', 'btn-log-close'].forEach((id) => $(id).addEventListener('click', () => hide('log-modal')));
// 모달·확인창: 바깥 클릭이나 Esc 로 닫는다
['log-modal', 'confirm-todo', 'confirm-task'].forEach((id) => $(id).addEventListener('click', (event) => { if (event.target === $(id)) { hide(id); } }));
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') { return; }
  hide('log-modal', 'confirm-todo', 'confirm-task');
  if (isTeam) { hide('assignee-menu'); }
});
if (isTeam) {
  show('my-only');
  $('my-only-input').addEventListener('change', () => {
    ui.myOnly = $('my-only-input').checked;
    $('my-only-note').classList.toggle('is-hidden', !ui.myOnly);
    renderKanban();
  });
  $('picker-control').addEventListener('click', () => $('assignee-menu').classList.toggle('is-hidden'));
  document.addEventListener('click', (event) => { if (!event.target.closest('.assignee-picker')) { hide('assignee-menu'); } });
}

// ---------- 시안 상태 막대 ----------
addToast('toast-deleted-404', 'error', '이미 삭제된 작업입니다.', '');
addToast('toast-todo-404', 'error', '이미 삭제된 할일입니다.', '');
addToast('toast-history-409', 'error', '히스토리로 옮겨진 작업입니다.', '');
addToast('toast-not-found', 'error', '작업을 찾을 수 없습니다.', '지워졌거나 히스토리로 옮겨진 작업입니다.');
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
addToast('toast-todo-other-deleted', 'error', '다른 팀원이 이 할일을 삭제했습니다.', '');
addToast('toast-todo-other-started', 'success', '다른 팀원이 이 할일로 작업을 시작했습니다.', '');
addToast('toast-other-deleted', 'error', '다른 팀원이 이 작업을 삭제했습니다.', '');
addToast('toast-assignee-gone', 'error', '팀에 없는 회원이 작업자에 있습니다.', '');

function resetState() {
  clearTimeout(toastTimer);
  hideAllToasts();
  resetModel();
  hide('log-modal', 'confirm-todo', 'confirm-task', 'strip-disconnected', 'log-loading');
  show('log-list');
  ['btn-start'].forEach((id) => { $(id).innerHTML = '<i class="bi bi-play-fill"></i>작업 시작'; });
  if (isTeam) { $('my-only-input').checked = false; hide('my-only-note', 'assignee-loading'); show('assignee-options'); }
  showPanel('none');
  renderTodos();
  renderKanban();
}
const selectFirstTodo = () => { ui.selectedTodoId = 101; renderTodos(); };
const openEditOf = (id) => { openDetail(id); startEdit(); };
const STATES = {
  'default': { label: '기본 (직접 눌러 보세요)', run: () => {} },
  'row-selected': { label: '할일 행 선택', run: selectFirstTodo },
  'todo-empty': { label: '할일 데이터 없음', run: () => { data.todos = []; renderTodos(); } },
  'kanban-empty': { label: '칸반 데이터 없음', run: () => { data.tasks = []; renderKanban(); } },
  'loading': { label: '로딩 중', run: () => { ui.loading = true; renderTodos(); renderKanban(); } },
  'todo-add': { label: '할일 입력 UI (추가)', run: () => openTodoForm(false) },
  'todo-edit': { label: '할일 입력 UI (수정)', run: () => { selectFirstTodo(); openTodoForm(true); } },
  'todo-time': { label: '시간 지정 켜짐', run: () => { openTodoForm(false); $('todo-time').checked = true; applyPeriodLocks('todo'); } },
  'todo-undecided': { label: '기간 미정 (시간 지정 잠금)', run: () => { openTodoForm(false); $('todo-undecided').checked = true; applyPeriodLocks('todo'); } },
  'todo-error': { label: '입력 오류 (빈 값으로 저장)', run: () => { openTodoForm(false); saveTodo(); } },
  'todo-saving': { label: '저장 중', run: () => { selectFirstTodo(); openTodoForm(true); setLoading($('btn-todo-save'), '저장 중...'); } },
  'starting': { label: '작업 시작 중', run: () => { selectFirstTodo(); setLoading($('btn-start'), '작업 시작'); } },
  'dragging': { label: '카드 드래그 중 (모양)', run: () => {
    document.querySelector('.task-card[data-id="4"]').classList.add('is-dragging');
    const ghost = document.querySelector('.task-card[data-id="1"]').cloneNode(true);
    ghost.classList.add('is-ghost');
    document.querySelector('.task-card[data-id="6"]').before(ghost);
  } },
  'detail-read': { label: '작업 상세 (읽기)', run: () => openDetail(2) },
  'detail-edit': { label: '작업 상세 (수정 중)', run: () => openEditOf(2) },
  'task-saving': { label: '작업 저장 중', run: () => { openEditOf(2); setLoading($('btn-task-save'), '저장 중...'); } },
  'log-loading': { label: '수정 내역 로딩 중', run: () => { openDetail(2); hide('log-list'); show('log-loading'); } },
  'log-modal': { label: '수정 내역 모달', run: () => { openDetail(2); openLog(1); } },
  'confirm-todo': { label: '할일 삭제 확인창', run: () => { selectFirstTodo(); openConfirmTodo(); } },
  'confirm-task': { label: '작업 삭제 확인창', run: () => { openDetail(2); openConfirmTask(); } },
  'deleting': { label: '삭제 중', run: () => { openDetail(2); openConfirmTask(); setLoading($('btn-confirm-task'), '삭제 중...'); } },
  'error-404': { label: '오류: 이미 삭제된 작업 (404)', run: () => show('toast-deleted-404') },
  'error-todo-404': { label: '오류: 이미 삭제된 할일 (404)', run: () => show('toast-todo-404') },
  'error-409': { label: '오류: 히스토리로 옮겨진 작업 (409)', run: () => show('toast-history-409') },
  'from-notification-missing': { label: '알림에서 옴: 작업 없음', run: () => show('toast-not-found') },
  'server-error': { label: '서버 오류', run: () => show('toast-server') },
};
if (isTeam) {
  Object.assign(STATES, {
    'my-only': { label: '팀: 내 작업만 켜짐 (드래그 불가)', run: () => { $('my-only-input').checked = true; $('my-only-input').dispatchEvent(new Event('change')); } },
    'assignee-menu': { label: '팀: 작업자 드롭다운 열림', run: () => { openEditOf(2); show('assignee-menu'); } },
    'assignee-loading': { label: '팀: 작업자 목록 불러오는 중', run: () => { openEditOf(2); show('assignee-menu', 'assignee-loading'); hide('assignee-options'); } },
    'assignee-gone': { label: '팀: 그사이 팀을 나간 작업자 (400)', run: () => { openEditOf(2); show('toast-assignee-gone'); } },
    'task-changed': { label: '팀: 수정 중 다른 팀원이 바꿈 (D-103)', run: () => { openEditOf(2); show('strip-task-changed'); } },
    'todo-changed': { label: '팀: 할일 수정 중 다른 팀원이 바꿈', run: () => { selectFirstTodo(); openTodoForm(true); show('strip-todo-changed'); } },
    'todo-other-deleted': { label: '팀: 수정 중인 할일을 다른 팀원이 삭제', run: () => show('toast-todo-other-deleted') },
    'todo-other-started': { label: '팀: 수정 중인 할일로 다른 팀원이 작업 시작', run: () => show('toast-todo-other-started') },
    'other-deleted': { label: '팀: 다른 팀원이 열린 작업을 삭제', run: () => show('toast-other-deleted') },
    'disconnected': { label: '팀: 실시간 연결 끊김 (D-123)', run: () => show('strip-disconnected') },
  });
}
setupStates(STATES, resetState);
