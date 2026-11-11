// 팀 정보 시안 동작 (D-146, D-149). TeamInfoView_screen.md "4. 동작"을 서버 없이 흉내 낸다.
// 나는 홍길동. 새로고침하면 처음 상태. 팀 만들기에서 넘어오면(?team=이름) 나 혼자인 새 팀이다

renderLayout({ space: 'team', tab: 'info', hideTabs: false });

const ROLE_LABEL = { owner: '관리자', manager: '부관리자', member: '팀원' };
const ROLE_ORDER = { owner: 0, manager: 1, member: 2 };
// 시안 규칙: 초대 이메일에 따라 서버 응답을 흉내 낸다
const KNOWN_USERS = { 'sujin.choi@example.com': '최수진', 'daeun@example.com': '정다은', 'declined@example.com': '한지민', 'mailfail@example.com': '오세훈', 'new.member@example.com': '윤서아' };

let team;
let openMenuId = null;
let confirmAction = null;

function initialTeam() {
  if (newTeamName) { return newTeam(); }
  return sampleTeam();
}
function newTeam() {
  {
    return { name: newTeamName, date: '2026.11.11', members: [{ id: 1, nickname: '홍길동', email: 'user@example.com', role: 'owner', join: '2026.11.11 10:30' }], invites: [] };
  }
}
function sampleTeam() {
  return {
    name: '디자인팀',
    date: '2026.11.01',
    members: [
      { id: 1, nickname: '홍길동', email: 'user@example.com', role: 'owner', join: '2026.11.01 09:00' },
      { id: 2, nickname: '이영희', email: 'younghee@example.com', role: 'manager', join: '2026.11.02 09:00' },
      { id: 3, nickname: '김민수', email: 'minsu@example.com', role: 'member', join: '2026.11.03 09:00' },
      { id: 4, nickname: '박지성', email: 'jisung.park@example.com', role: 'member', join: '2026.11.05 09:00' },
    ],
    invites: [
      { id: 11, nickname: '최수진', email: 'sujin.choi@example.com', sender: '홍길동', date: '2026.11.10' },
      { id: 12, nickname: '정다은', email: 'daeun@example.com', sender: '이영희', date: '2026.11.11' },
    ],
  };
}
const me = () => team.members.find((member) => member.id === 1);

// 내 역할로 그 행에 할 수 있는 메뉴 (TeamInfoView_screen.md "행 메뉴 항목")
function menuItems(target) {
  const myRole = me().role;
  if (target.id === 1 || target.role === 'owner') { return []; }
  if (myRole === 'owner') {
    return [target.role === 'manager' ? 'unset-manager' : 'set-manager', 'transfer', 'remove'];
  }
  if (myRole === 'manager' && target.role === 'member') { return ['remove']; }
  return [];
}
const MENU_LABEL = { 'set-manager': '부관리자 지정', 'unset-manager': '부관리자 해제', transfer: '관리자 넘기기', remove: '내보내기' };

function render() {
  team.members.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.join.localeCompare(b.join));
  const myRole = me().role;
  $('team-name').textContent = team.name;
  $('owner-nickname').textContent = team.members[0].nickname;
  $('member-count').textContent = team.members.length;
  $('team-date').textContent = team.date;
  $('member-title-count').textContent = `(${team.members.length}명)`;
  $('btn-name-edit').classList.toggle('is-hidden', myRole === 'member');
  $('btn-dissolve').classList.toggle('is-hidden', myRole !== 'owner');
  $('btn-leave').classList.toggle('is-hidden', myRole === 'owner');

  $('member-body').innerHTML = team.members.map((member) => {
    const items = menuItems(member);
    const menu = items.length
      ? `<button type="button" class="icon-button" aria-label="팀원 메뉴" data-menu="${member.id}"><i class="bi bi-three-dots-vertical"></i></button>${openMenuId === member.id
        ? `<div class="popover-box row-menu">${items.map((item) => `<button type="button" class="row-menu-item${item === 'remove' ? ' is-danger' : ''}" data-action="${item}" data-id="${member.id}">${MENU_LABEL[item]}</button>`).join('')}</div>` : ''}`
      : '';
    return `<tr><td>${escapeHtml(member.nickname)}${member.id === 1 ? '<span class="me-mark">(나)</span>' : ''}<span class="email-sub">${escapeHtml(member.email)}</span></td>
      <td class="col-email">${escapeHtml(member.email)}</td><td><span class="badge-x badge-${member.role}">${ROLE_LABEL[member.role]}</span></td>
      <td>${member.join.slice(0, 10)}</td><td class="col-menu">${menu}</td></tr>`;
  }).join('');

  $('invite-section').classList.toggle('is-hidden', !team.invites.length);
  $('invite-count').textContent = `(${team.invites.length})`;
  $('invite-list').innerHTML = team.invites.map((invite) => {
    // [취소]는 초대한 본인, 관리자·부관리자 (D-120)
    const canCancel = invite.sender === '홍길동' || myRole !== 'member';
    return `<div class="invite-row"><div class="invite-who"><b>${escapeHtml(invite.nickname)}</b><small>${escapeHtml(invite.email)}</small></div>
      <span class="invite-meta">${escapeHtml(invite.sender)}님이 초대 · ${invite.date}</span>
      ${canCancel ? `<button type="button" class="btn-x btn-outline-x" data-cancel="${invite.id}">취소</button>` : ''}</div>`;
  }).join('');
}

// ---------- 확인창 ----------
function openConfirm(title, text, okLabel, danger, action) {
  $('confirm-title').textContent = title;
  $('confirm-text').innerHTML = text;
  hide('dissolve-input');
  $('confirm-cancel').textContent = '취소';
  setLabel($('confirm-ok'), escapeHtml(okLabel));
  $('confirm-ok').className = `btn-x ${danger ? 'btn-danger-x' : 'btn-primary-x'}`;
  confirmAction = action;
  show('confirm');
}
async function runConfirm() {
  if (!confirmAction || $('confirm-ok').disabled) { return; }
  setLoading($('confirm-ok'), '처리 중...');
  await wait(400);
  const action = confirmAction;
  confirmAction = null;
  hide('confirm');
  action();
}

// ---------- 팀원 메뉴 동작 ----------
function onMenuAction(action, id) {
  const target = team.members.find((member) => member.id === id);
  openMenuId = null;
  if (action === 'set-manager' || action === 'unset-manager') {
    target.role = action === 'set-manager' ? 'manager' : 'member';
    render();
    flash('success', action === 'set-manager' ? '부관리자로 지정했습니다.' : '부관리자를 해제했습니다.');
  } else if (action === 'transfer') {
    render();
    openConfirm('관리자 넘기기', `${escapeHtml(target.nickname)}님에게 관리자를 넘길까요? 넘기면 나는 부관리자가 됩니다.`, '넘기기', false, () => {
      me().role = 'manager';
      target.role = 'owner';
      render();
      flash('success', '관리자를 넘겼습니다.');
    });
  } else if (action === 'remove') {
    render();
    openConfirm('내보내기', `${escapeHtml(target.nickname)}님을 팀에서 내보낼까요? 이 회원이 맡은 작업의 작업자에서도 빠집니다.`, '내보내기', true, () => {
      team.members = team.members.filter((member) => member.id !== id);
      render();
      flash('success', `${target.nickname}님을 내보냈습니다.`);
    });
  }
}

// ---------- 이름 수정 ----------
function startRename() {
  $('team-rename').value = team.name;
  $('ctl-team-rename').classList.remove('is-invalid');
  hide('rename-error', 'name-read');
  show('name-edit');
  setLabel($('btn-rename-save'), '저장');
  $('team-rename').focus();
}
function cancelRename() { hide('name-edit'); show('name-read'); }
async function saveRename() {
  const name = $('team-rename').value.trim();
  if (!name) { $('ctl-team-rename').classList.add('is-invalid'); show('rename-error'); return; }
  setLoading($('btn-rename-save'), '저장 중...');
  await wait(400);
  team.name = name;
  // 좌측 네비 팀 이름도 바꾼다
  const navText = document.querySelector('#team-list .nav-item.is-active .nav-text');
  if (navText) { navText.textContent = name; }
  cancelRename();
  render();
  flash('success', '팀 이름을 바꿨습니다.');
}

// ---------- 초대 ----------
function openInvite() {
  $('invite-email').value = '';
  $('ctl-invite-email').classList.remove('is-invalid');
  hide('invite-error');
  setLabel($('btn-invite-send'), '초대');
  show('invite-modal');
  $('invite-email').focus();
}
function inviteError(text) {
  $('ctl-invite-email').classList.add('is-invalid');
  $('invite-error-text').textContent = text;
  show('invite-error');
}
async function sendInvite() {
  const email = $('invite-email').value.trim().toLowerCase();
  $('ctl-invite-email').classList.remove('is-invalid');
  hide('invite-error');
  if (!email) { inviteError('이메일을 입력해 주세요.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { inviteError('이메일 형식이 올바르지 않습니다.'); return; }
  setLoading($('btn-invite-send'), '초대 중...');
  await wait(500);
  setLabel($('btn-invite-send'), '초대');
  if (team.members.some((member) => member.email === email) || email === 'minsu@example.com') { inviteError('이미 팀원인 회원입니다.'); return; }
  if (team.invites.some((invite) => invite.email === email)) { inviteError('이미 초대한 회원입니다.'); return; }
  if (email === 'declined@example.com') { inviteError('초대를 거절한 회원입니다. 거절한 때부터 24시간 뒤에 다시 초대할 수 있습니다.'); return; }
  if (!KNOWN_USERS[email]) { inviteError('가입된 회원이 아닙니다.'); return; }
  team.invites.unshift({ id: Date.now(), nickname: KNOWN_USERS[email], email, sender: '홍길동', date: '2026.11.11' });
  hide('invite-modal');
  render();
  flash('success', email === 'mailfail@example.com' ? '초대했지만 안내 메일은 보내지 못했습니다.' : '초대했습니다.');
}
function cancelInvite(id) {
  const invite = team.invites.find((item) => item.id === id);
  openConfirm('초대 취소', `${escapeHtml(invite.nickname)}님에게 보낸 초대를 취소할까요?`, '초대 취소', true, () => {
    team.invites = team.invites.filter((item) => item.id !== id);
    render();
    flash('success', '초대를 취소했습니다.');
  });
  $('confirm-cancel').textContent = '닫기';
}

// ---------- 탈퇴·해체 (탈퇴·해체하면 개인 작업 화면으로, D-075, D-080) ----------
function leaveTeam() {
  openConfirm('팀 탈퇴', `${escapeHtml(team.name)} 팀에서 탈퇴할까요? 내가 맡은 작업의 작업자에서도 빠집니다.`, '탈퇴', true, () => { location.href = 'task_view.html?teamGone=left'; });
}
function dissolveStep1() {
  openConfirm('팀 해체', `팀을 해체하려면 팀 이름을 입력해 주세요.<br /><span class="confirm-name">${escapeHtml(team.name)}</span>`, '다음', true, dissolveStep2);
  $('dissolve-name').value = '';
  show('dissolve-input');
  $('confirm-ok').disabled = true;
  $('dissolve-name').focus();
}
function dissolveStep2() {
  openConfirm('팀 해체', '정말 삭제할까요? 되돌릴 수 없습니다.', '삭제', true, () => { location.href = 'task_view.html?teamGone=dissolved'; });
}

// ---------- 이벤트 ----------
$('btn-name-edit').addEventListener('click', startRename);
$('btn-rename-cancel').addEventListener('click', cancelRename);
$('btn-rename-save').addEventListener('click', saveRename);
$('team-rename').addEventListener('keydown', (event) => { if (event.key === 'Enter') { saveRename(); } if (event.key === 'Escape') { cancelRename(); } });
$('member-body').addEventListener('click', (event) => {
  const menuButton = event.target.closest('[data-menu]');
  const actionButton = event.target.closest('[data-action]');
  event.stopPropagation();
  if (actionButton) { onMenuAction(actionButton.dataset.action, Number(actionButton.dataset.id)); return; }
  if (menuButton) { const id = Number(menuButton.dataset.menu); openMenuId = openMenuId === id ? null : id; render(); }
});
document.addEventListener('click', () => { if (openMenuId !== null) { openMenuId = null; render(); } });
$('invite-list').addEventListener('click', (event) => { const button = event.target.closest('[data-cancel]'); if (button) { cancelInvite(Number(button.dataset.cancel)); } });
$('btn-invite').addEventListener('click', openInvite);
$('btn-invite-cancel').addEventListener('click', () => hide('invite-modal'));
$('btn-invite-send').addEventListener('click', sendInvite);
$('invite-email').addEventListener('keydown', (event) => { if (event.key === 'Enter') { sendInvite(); } });
$('btn-leave').addEventListener('click', leaveTeam);
$('btn-dissolve').addEventListener('click', dissolveStep1);
// 팀 이름과 똑같이(앞뒤 공백만 무시) 입력해야 [다음]이 켜진다 (D-080)
$('dissolve-name').addEventListener('input', () => { $('confirm-ok').disabled = $('dissolve-name').value.trim() !== team.name; });
$('confirm-ok').addEventListener('click', runConfirm);
$('confirm-cancel').addEventListener('click', () => { confirmAction = null; hide('confirm'); });
closeOnBackdrop('invite-modal');
closeOnBackdrop('confirm', () => { confirmAction = null; });
escapeHandlers.push(() => { hide('invite-modal', 'confirm'); confirmAction = null; if (openMenuId !== null) { openMenuId = null; render(); } });

// ---------- 시안 상태 막대 ----------
addToast('toast-forbidden', 'error', '권한이 없습니다.', '');
addToast('toast-member-gone', 'error', '이미 팀에 없는 회원입니다.', '');
addToast('toast-name-mismatch', 'error', '팀 이름이 맞지 않습니다.', '');
addToast('toast-invite-gone', 'error', '이미 답했거나 취소된 초대입니다.', '');
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');

function resetState() {
  clearFlash();
  team = initialTeam();
  openMenuId = null;
  confirmAction = null;
  hide('page-loading', 'name-edit', 'invite-modal', 'confirm');
  show('page-body', 'name-read');
  render();
}
// 다른 사람 역할로 보기: 이영희가 관리자인 상태로 바꾼다
function viewAs(role) {
  if (role !== 'owner') { team.members.find((m) => m.nickname === '이영희').role = 'owner'; me().role = role; }
  render();
}
const STATES = {
  'owner': { label: '관리자로 봄 (직접 눌러 보세요)', run: () => {} },
  'manager': { label: '부관리자로 봄', run: () => viewAs('manager') },
  'member': { label: '팀원으로 봄', run: () => viewAs('member') },
  'alone': { label: '혼자 남은 관리자', run: () => { team.members = [team.members[0]]; team.invites = []; render(); } },
  'loading': { label: '로딩 중', run: () => { hide('page-body'); show('page-loading'); } },
  'rename': { label: '이름 수정 중', run: startRename },
  'rename-error': { label: '이름 입력 오류', run: () => { startRename(); $('team-rename').value = ''; saveRename(); } },
  'row-menu-owner': { label: '행 메뉴 열림 (관리자 → 팀원)', run: () => { openMenuId = 3; render(); } },
  'row-menu-manager-target': { label: '행 메뉴 열림 (관리자 → 부관리자)', run: () => { openMenuId = 2; render(); } },
  'row-menu-by-manager': { label: '행 메뉴 열림 (부관리자 → 팀원)', run: () => { viewAs('manager'); openMenuId = 3; render(); } },
  'confirm-owner': { label: '확인창: 관리자 넘기기', run: () => onMenuAction('transfer', 3) },
  'confirm-remove': { label: '확인창: 내보내기', run: () => onMenuAction('remove', 3) },
  'confirm-leave': { label: '확인창: 팀 탈퇴', run: () => { viewAs('member'); leaveTeam(); } },
  'confirm-dissolve-1': { label: '확인창: 팀 해체 1단계 ([다음] 꺼짐)', run: dissolveStep1 },
  'confirm-dissolve-1-ok': { label: '확인창: 팀 해체 1단계 (이름 일치)', run: () => { dissolveStep1(); $('dissolve-name').value = team.name; $('dissolve-name').dispatchEvent(new Event('input')); } },
  'confirm-dissolve-2': { label: '확인창: 팀 해체 2단계', run: dissolveStep2 },
  'invite': { label: '초대 모달', run: openInvite },
  'invite-format': { label: '초대 입력 오류 (형식)', run: () => { openInvite(); $('invite-email').value = 'someone@'; sendInvite(); } },
  'invite-not-user': { label: '초대 오류: 가입된 회원 아님', run: () => { openInvite(); inviteError('가입된 회원이 아닙니다.'); } },
  'invite-member': { label: '초대 오류: 이미 팀원', run: () => { openInvite(); inviteError('이미 팀원인 회원입니다.'); } },
  'invite-dup': { label: '초대 오류: 이미 초대함', run: () => { openInvite(); inviteError('이미 초대한 회원입니다.'); } },
  'invite-declined': { label: '초대 오류: 24시간 안에 거절함', run: () => { openInvite(); inviteError('초대를 거절한 회원입니다. 거절한 때부터 24시간 뒤에 다시 초대할 수 있습니다.'); } },
  'confirm-invite-cancel': { label: '확인창: 초대 취소', run: () => cancelInvite(11) },
  'error-403': { label: '오류: 권한 없음 (403)', run: () => show('toast-forbidden') },
  'error-404-member': { label: '오류: 이미 팀에 없는 회원', run: () => show('toast-member-gone') },
  'error-name-mismatch': { label: '오류: 팀 이름 불일치', run: () => show('toast-name-mismatch') },
  'error-invite-gone': { label: '오류: 이미 없는 초대', run: () => show('toast-invite-gone') },
  'server-error': { label: '서버 오류', run: () => show('toast-server') },
};
// 기본 상태 말고는 예시 팀(팀원 4명)으로 보여준다 (팀 만들기에서 넘어온 새 팀은 나 혼자라서)
Object.keys(STATES).filter((key) => key !== 'owner').forEach((key) => {
  const run = STATES[key].run;
  STATES[key].run = () => { team = sampleTeam(); render(); run(); };
});
setupStates(STATES, resetState);
