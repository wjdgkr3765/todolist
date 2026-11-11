// 시안 공통 스크립트 (D-146, D-149). 서버 없이 시안 안에서만 동작을 흉내 낸다.
// 사용자 입력은 escapeHtml 또는 textContent 로만 화면에 넣는다.

const $ = (id) => document.getElementById(id);
const show = (...ids) => ids.forEach((id) => $(id).classList.remove('is-hidden'));
const hide = (...ids) => ids.forEach((id) => $(id).classList.add('is-hidden'));
const pageParams = new URLSearchParams(location.search);
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 버튼 안에 스피너 + 문구를 넣고 비활성으로 만든다
function setLoading(button, label) {
  const spinner = document.createElement('span');
  spinner.className = 'spinner-border spinner-border-sm';
  spinner.setAttribute('aria-hidden', 'true');
  button.replaceChildren(spinner, document.createTextNode(label));
  button.disabled = true;
}
// 버튼을 원래 글자로 되돌린다
function setLabel(button, html) {
  button.innerHTML = html;
  button.disabled = false;
}

// 상태 선택 막대: STATES 의 키를 option 으로 만들고, 고르면 resetState() 후 그 상태를 그린다
// 주소에 ?state=키 가 있으면 그 상태로 시작한다
function setupStates(states, resetState) {
  const select = $('state-select');
  const apply = (key) => { resetState(); states[key].run(); };
  Object.entries(states).forEach(([key, value]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = value.label;
    select.appendChild(option);
  });
  select.addEventListener('change', (event) => apply(event.target.value));
  // 검사용: ?check=all 이면 모든 상태를 한 번씩 그려 본다 (콘솔 오류 확인)
  if (pageParams.get('check') === 'all') { Object.keys(states).forEach((key) => apply(key)); console.info('MOCKUP_CHECK_DONE ' + Object.keys(states).length); }
  const start = pageParams.get('state');
  if (start && states[start]) { select.value = start; }
  apply(select.value);
}

// ---------- 토스트 ----------
// 토스트 하나를 만들어 둔다 (kind: 'error' | 'success'). 상태 막대에서 그대로 보여줄 때 쓴다
function addToast(id, kind, title, sub) {
  const box = document.createElement('div');
  box.id = id;
  box.className = `toast-box ${kind === 'success' ? 'is-success' : ''} is-hidden`;
  box.setAttribute('role', 'alert');
  box.innerHTML = `<span class="toast-icon"><i class="bi ${kind === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}"></i></span><div>${title}${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
  document.body.appendChild(box);
}
function hideAllToasts() {
  document.querySelectorAll('.toast-box').forEach((box) => box.classList.add('is-hidden'));
}
// 동작 결과 토스트: 보여준 뒤 2.5초 뒤에 사라진다
let flashTimer = null;
function flash(kind, title, sub) {
  const id = kind === 'success' ? 'toast-flash-success' : 'toast-flash-error';
  if (!$(id)) { addToast(id, kind, '', ''); }
  hideAllToasts();
  const box = $(id);
  box.querySelector('div').innerHTML = `${escapeHtml(title)}${sub ? `<div class="toast-sub">${escapeHtml(sub)}</div>` : ''}`;
  box.classList.remove('is-hidden');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => box.classList.add('is-hidden'), 2500);
}
function clearFlash() { clearTimeout(flashTimer); hideAllToasts(); }

// 모달·확인창·작은 창: 바깥 클릭이나 Esc 로 닫는다
function closeOnBackdrop(id, onClose) {
  $(id).addEventListener('click', (event) => { if (event.target === $(id)) { hide(id); if (onClose) { onClose(); } } });
}
const escapeHandlers = [];
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { escapeHandlers.forEach((handler) => handler()); } });

// ---------- 공통 레이아웃 (MainLayout_screen.md) ----------
// 팀 만들기로 넘어오면 주소의 ?team=이름 이 팀 목록 맨 위에 붙는다 (D-089)
const TEAMS = [
  { id: 1, name: '디자인팀' },
  { id: 2, name: '프로젝트 A 개발팀' },
  { id: 3, name: '주말 스터디' },
];
const newTeamName = pageParams.get('team');
if (newTeamName) { TEAMS.unshift({ id: 9, name: newTeamName }); }
// 팀 정보에서 탈퇴·해체하고 넘어오면(?teamGone=) 그 팀(디자인팀)을 팀 목록에서 뺀다
if (pageParams.get('teamGone')) { TEAMS.splice(TEAMS.findIndex((team) => team.id === 1), 1); }
const PERSONAL_TABS = [
  { key: 'tasks', label: '작업', href: 'task_view.html' },
  { key: 'calendar', label: '캘린더', href: 'calendar_view.html' },
  { key: 'history', label: '히스토리', href: 'history_view.html' },
];
const TEAM_TABS = [
  { key: 'tasks', label: '작업', href: 'task_view.html?space=team' },
  { key: 'calendar', label: '캘린더', href: 'calendar_view.html?space=team' },
  { key: 'info', label: '팀 정보', href: 'team_info_view.html' },
  { key: 'history', label: '히스토리', href: 'history_view.html?space=team' },
];

const NOTIFICATION_ITEMS = `
  <div class="notification-item is-unread" data-kind="invite">
    <i class="bi bi-people"></i>
    <div>김민수님이 마케팅팀 팀에 초대했습니다.
      <div class="notification-time">2026.11.11 14:30</div>
      <div class="notification-actions">
        <button type="button" id="btn-accept" class="btn-x btn-primary-x" data-action="accept">수락</button>
        <button type="button" class="btn-x btn-outline-x" data-action="decline">거절</button>
      </div>
    </div>
  </div>
  <div class="notification-item is-unread">
    <i class="bi bi-person-check"></i>
    <a href="task_view.html?space=team&amp;state=detail-read" class="notification-link">이영희님이 디자인팀 팀의 "메인 화면 시안 정리" 작업자로 지정했습니다.
      <span class="notification-time">2026.11.11 11:05</span>
    </a>
    <button type="button" class="notification-close" aria-label="알림 지우기" data-action="remove"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="notification-item">
    <i class="bi bi-alarm is-alarm"></i>
    <a href="task_view.html?state=detail-read" class="notification-link">"주간 보고서 작성" 작업이 11.12 18:00에 마감됩니다.
      <span class="notification-sub">개인</span>
      <span class="notification-time">2026.11.11 09:00</span>
    </a>
    <button type="button" class="notification-close" aria-label="알림 지우기" data-action="remove"><i class="bi bi-x-lg"></i></button>
  </div>`;

function teamNavHtml(team, active) {
  return `<a href="task_view.html?space=team" class="nav-item${active ? ' is-active' : ''}" data-team-id="${team.id}"><i class="bi bi-people"></i><span class="nav-text">${escapeHtml(team.name)}</span></a>`;
}

// options: { space: 'personal' | 'team' | 'none', tab: 'tasks' | 'calendar' | 'info' | 'history', hideTabs: boolean }
function renderLayout(options) {
  const space = options.space;
  const oldModal = $('team-create-modal');
  if (oldModal) { oldModal.remove(); }
  $('menu-tabs').classList.remove('is-hidden');
  const teamNav = TEAMS.map((team, index) => teamNavHtml(team, space === 'team' && index === 0)).join('');

  $('side-nav').innerHTML = `
    <div class="nav-top">
      <a href="task_view.html" class="logo"><span class="logo-mark"><i class="bi bi-check2-square"></i></span>TODO</a>
      <button id="bell" type="button" class="bell-button" aria-label="알림"><i class="bi bi-bell"></i><span id="bell-badge" class="bell-badge">2</span></button>
      <div id="notification-box" class="popover-box notification-box is-hidden" role="dialog" aria-label="알림">
        <div class="notification-title">알림</div>
        <div id="notification-list" class="notification-list">${NOTIFICATION_ITEMS}</div>
        <div id="notification-empty" class="notification-empty is-hidden"><i class="bi bi-bell-slash"></i>알림이 없습니다.</div>
      </div>
    </div>
    <a href="task_view.html" class="nav-item${space === 'personal' ? ' is-active' : ''}"><i class="bi bi-person"></i>개인</a>
    <div class="nav-section-title">팀<button id="btn-team-add" type="button" class="nav-add" aria-label="팀 만들기"><i class="bi bi-plus-lg"></i></button></div>
    <div id="team-list" class="nav-team-list">${teamNav}</div>
    <div id="team-empty" class="nav-empty is-hidden">아직 속한 팀이 없습니다.</div>
    <div class="profile">
      <div id="profile-menu" class="popover-box profile-menu is-hidden" role="menu">
        <a href="profile_view.html" class="profile-menu-item" role="menuitem"><i class="bi bi-person-gear"></i>회원정보 수정</a>
        <a href="login_view.html" id="btn-logout" class="profile-menu-item" role="menuitem"><i class="bi bi-box-arrow-right"></i>로그아웃</a>
      </div>
      <button id="profile-button" type="button" class="profile-button" aria-haspopup="menu">
        <span class="profile-text">
          <span id="nickname" class="profile-nickname">홍길동</span>
          <span id="email" class="profile-email">user@example.com</span>
        </span>
        <i class="bi bi-three-dots-vertical profile-more"></i>
      </button>
    </div>`;

  const tabs = space === 'team' ? TEAM_TABS : PERSONAL_TABS;
  if (options.hideTabs) {
    $('menu-tabs').classList.add('is-hidden');
  } else {
    $('menu-tabs').innerHTML = tabs.map((tab) =>
      `<a href="${tab.href}" class="menu-tab${tab.key === options.tab ? ' is-active' : ''}">${tab.label}</a>`
    ).join('');
  }

  // 팀 만들기 모달 (D-073)
  const modal = document.createElement('div');
  modal.id = 'team-create-modal';
  modal.className = 'modal-backdrop-x is-hidden';
  modal.innerHTML = `
    <div class="modal-x" role="dialog" aria-label="팀 만들기">
      <div class="modal-title-x">팀 만들기</div>
      <div class="field" style="margin-bottom:0">
        <label class="field-label" for="team-name-input">팀 이름</label>
        <div id="ctl-team-name" class="control no-icon"><input id="team-name-input" type="text" maxlength="20" placeholder="팀 이름을 입력해 주세요" /></div>
        <div id="team-name-error" class="message is-error is-hidden"><i class="bi bi-exclamation-circle"></i><span id="team-name-error-text">팀 이름을 입력해 주세요.</span></div>
      </div>
      <div class="modal-actions">
        <button type="button" id="btn-team-create-cancel" class="btn-x btn-outline-x">취소</button>
        <button type="button" id="btn-team-create" class="btn-x btn-primary-x">만들기</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  bindLayout();
}

// ---------- 공통 레이아웃 동작 (MainLayout_screen.md "4. 동작") ----------
function closePopovers() {
  hide('notification-box', 'profile-menu');
  $('bell').classList.remove('is-open');
  $('profile-button').classList.remove('is-open');
}
function openNotificationBox() {
  hide('profile-menu');
  $('profile-button').classList.remove('is-open');
  show('notification-box');
  $('bell').classList.add('is-open');
  // 알림 창을 열면 모두 본 것으로 (D-096)
  hide('bell-badge');
  document.querySelectorAll('.notification-item.is-unread').forEach((item) => item.classList.remove('is-unread'));
}
function refreshNotificationEmpty() {
  const empty = !document.querySelector('#notification-list .notification-item');
  $('notification-list').classList.toggle('is-hidden', empty);
  $('notification-empty').classList.toggle('is-hidden', !empty);
}
async function onNotificationAction(button) {
  const item = button.closest('.notification-item');
  const action = button.dataset.action;
  if (action === 'accept') {
    item.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    setLoading(button, '수락');
    await wait(600);
    item.remove();
    // 수락하면 그 팀이 팀 목록 맨 위 (D-089)
    $('team-list').insertAdjacentHTML('afterbegin', teamNavHtml({ id: 8, name: '마케팅팀' }, false));
    show('team-list');
    hide('team-empty');
    flash('success', '마케팅팀 팀에 가입했습니다.');
  } else {
    item.remove();
  }
  refreshNotificationEmpty();
}
async function createTeam() {
  const name = $('team-name-input').value.trim();
  if (!name) {
    $('ctl-team-name').classList.add('is-invalid');
    $('team-name-error-text').textContent = '팀 이름을 입력해 주세요.';
    show('team-name-error');
    $('team-name-input').focus();
    return;
  }
  setLoading($('btn-team-create'), '만드는 중...');
  await wait(500);
  // 만든 팀의 팀 정보 탭으로 이동 (D-073). 시안에서는 팀 이름을 주소로 넘긴다
  location.href = `team_info_view.html?team=${encodeURIComponent(name)}`;
}
function bindLayout() {
  $('bell').addEventListener('click', (event) => {
    event.stopPropagation();
    if ($('notification-box').classList.contains('is-hidden')) { openNotificationBox(); } else { closePopovers(); }
  });
  $('profile-button').addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = $('profile-menu').classList.contains('is-hidden');
    closePopovers();
    if (opening) { show('profile-menu'); $('profile-button').classList.add('is-open'); }
  });
  $('notification-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) { event.stopPropagation(); onNotificationAction(button); }
  });
  $('notification-box').addEventListener('click', (event) => event.stopPropagation());
  $('profile-menu').addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', closePopovers);
  $('btn-logout').addEventListener('click', (event) => {
    event.preventDefault();
    $('btn-logout').innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>로그아웃 중...';
    setTimeout(() => { location.href = 'login_view.html'; }, 500);
  });
  $('btn-team-add').addEventListener('click', () => {
    $('team-name-input').value = '';
    $('ctl-team-name').classList.remove('is-invalid');
    hide('team-name-error');
    setLabel($('btn-team-create'), '만들기');
    show('team-create-modal');
    $('team-name-input').focus();
  });
  $('btn-team-create-cancel').addEventListener('click', () => hide('team-create-modal'));
  $('btn-team-create').addEventListener('click', createTeam);
  $('team-name-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { createTeam(); } });
  $('team-name-input').addEventListener('input', () => { $('ctl-team-name').classList.remove('is-invalid'); hide('team-name-error'); });
  closeOnBackdrop('team-create-modal');
  escapeHandlers.push(() => { closePopovers(); hide('team-create-modal'); });
  // 팀 목록 드래그로 순서 변경 (D-089). 5px 이상 움직여야 드래그로 본다
  if (window.Sortable) {
    Sortable.create($('team-list'), {
      animation: 150, delay: 150, delayOnTouchOnly: true, forceFallback: true, fallbackTolerance: 5,
      ghostClass: 'nav-ghost', fallbackClass: 'nav-dragging',
    });
  }
}

// 레이아웃 상태를 처음으로 되돌린다 (main_layout.html 상태 막대에서 쓴다)
function resetLayout() {
  ['notification-box', 'profile-menu', 'team-create-modal', 'notification-empty', 'team-empty', 'team-name-error'].forEach((id) => hide(id));
  ['notification-list', 'team-list', 'bell-badge'].forEach((id) => show(id));
  $('notification-list').innerHTML = NOTIFICATION_ITEMS;
  $('bell').classList.remove('is-open');
  $('profile-button').classList.remove('is-open');
  $('bell-badge').textContent = '2';
  $('nickname').textContent = '홍길동';
  $('email').textContent = 'user@example.com';
  $('ctl-team-name').classList.remove('is-invalid');
  $('team-name-input').value = '';
  setLabel($('btn-team-create'), '만들기');
  document.querySelectorAll('#team-list .nav-item').forEach((item) => item.classList.remove('is-dragging'));
  document.querySelectorAll('.nav-drop-line').forEach((line) => line.remove());
  $('btn-logout').innerHTML = '<i class="bi bi-box-arrow-right"></i>로그아웃';
}

// ---------- 로그인·회원가입·찾기 화면의 브랜드 영역 (AuthBrandPanel, SignupView_screen.md) ----------
function renderBrandPanel() {
  $('brand-panel').innerHTML = `
    <div class="brand-logo"><span class="brand-logo-mark"><i class="bi bi-check2-square"></i></span>TODO</div>
    <div class="brand-copy">
      <div class="brand-headline">함께 세우는 일정,<br />한눈에 보이는 진행</div>
      <div class="brand-desc">팀원과 할 일을 나누고, 칸반보드와 캘린더로<br />진행 상황을 실시간으로 확인하세요.</div>
      <ul class="brand-features">
        <li><span class="brand-feature-icon"><i class="bi bi-kanban"></i></span>대기 · 진행 · 완료 칸반보드</li>
        <li><span class="brand-feature-icon"><i class="bi bi-calendar3"></i></span>기간이 보이는 캘린더</li>
        <li><span class="brand-feature-icon"><i class="bi bi-people"></i></span>팀원과 실시간 협업</li>
      </ul>
      <div class="brand-board">
        <div class="brand-board-col"><span class="brand-board-title">대기</span><span class="brand-board-card"></span><span class="brand-board-card is-short is-dim"></span></div>
        <div class="brand-board-col"><span class="brand-board-title">진행</span><span class="brand-board-card"></span><span class="brand-board-card is-short"></span><span class="brand-board-card is-dim"></span></div>
        <div class="brand-board-col"><span class="brand-board-title">완료</span><span class="brand-board-card is-dim"></span></div>
      </div>
    </div>`;
}

// ---------- 이메일 인증번호 (회원가입·찾기·회원정보 수정이 같이 쓴다, SignupView_screen.md) ----------
// 시안 규칙: 맞는 인증번호는 123456. 5번 틀리면 무효. 유효 5분, 재발송은 1분 뒤 (D-035)
const DEMO_CODE = '123456';
function createCodeTimer(onTick, onExpire) {
  let timer = null;
  let left = 0;
  const format = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return {
    start(seconds) {
      clearInterval(timer);
      left = seconds;
      onTick(format(left), left);
      timer = setInterval(() => {
        left -= 1;
        onTick(format(Math.max(left, 0)), left);
        if (left <= 0) { clearInterval(timer); onExpire(); }
      }, 1000);
    },
    stop() { clearInterval(timer); },
    format,
  };
}
