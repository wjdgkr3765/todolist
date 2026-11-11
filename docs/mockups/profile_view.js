// 회원정보 수정 시안 동작 (D-146, D-149). ProfileView_screen.md "4. 동작"을 서버 없이 흉내 낸다
// 시안 규칙: 현재 비밀번호 abcd123!, 인증번호 123456, 중복 이메일 used@example.com, 중복 전화번호 01000000000
renderLayout({ space: 'none', tab: null, hideTabs: true });

const DEMO_PASSWORD = 'abcd123!';
const NICKNAME_RULE = /^[가-힣A-Za-z0-9]{1,8}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!-/:-@[-`{-~])[!-~]{8,15}$/;

let me;
let codeFails = 0;
let passwordFails = 0;
let emailState = 'idle'; // idle | sent | verified

function error(ctlId, messageId, on) {
  $(ctlId).classList.toggle('is-invalid', on);
  $(messageId).classList.toggle('is-hidden', !on);
}

// ---------- 닉네임 ----------
$('nickname-input').addEventListener('input', () => {
  $('btn-nickname').disabled = $('nickname-input').value === me.nickname;
  error('ctl-nickname', 'nickname-error', false);
});
async function saveNickname() {
  const value = $('nickname-input').value.trim();
  if (!NICKNAME_RULE.test(value)) { error('ctl-nickname', 'nickname-error', true); return; }
  setLoading($('btn-nickname'), '저장 중...');
  await wait(400);
  me.nickname = value;
  setLabel($('btn-nickname'), '저장');
  $('btn-nickname').disabled = true;
  $('nickname').textContent = value; // 좌측 하단 닉네임도 바꾼다
  flash('success', '닉네임을 바꿨습니다.');
}
$('btn-nickname').addEventListener('click', saveNickname);

// ---------- 이메일 (다시 인증, D-021) ----------
const codeTimer = createCodeTimer((text, left) => {
  $('code-timer').textContent = text;
  // 재발송은 1분 뒤부터 (D-035)
  const resendLeft = left - 240;
  if (emailState === 'sent') {
    $('btn-email-send').disabled = resendLeft > 0;
    $('btn-email-send').textContent = resendLeft > 0 ? `재발송 ${codeTimer.format(resendLeft)}` : '재발송';
  }
}, () => { if (emailState === 'sent') { codeError('인증번호가 만료되었습니다. 다시 발송해 주세요.'); } });

function emailMessage(kind, text) {
  $('email-message').className = `message ${kind}`;
  $('email-message-text').textContent = text;
  show('email-message');
}
function codeError(text) {
  $('ctl-code').classList.add('is-invalid');
  $('code-error-text').textContent = text;
  show('code-error');
}
function resetEmailArea() {
  codeTimer.stop();
  emailState = 'idle';
  codeFails = 0;
  $('email-input').value = me.email;
  $('email-input').disabled = false;
  $('ctl-email').classList.remove('is-locked', 'is-invalid');
  hide('email-verified', 'btn-email-change-cancel', 'email-message', 'code-row', 'code-error', 'btn-email-change');
  show('btn-email-send');
  setLabel($('btn-email-send'), '인증번호 발송');
  $('btn-email-send').disabled = true;
}
$('email-input').addEventListener('input', () => {
  // 발송 후 이메일을 고치면 처음부터 다시 발송
  if (emailState === 'sent') { codeTimer.stop(); emailState = 'idle'; hide('code-row', 'code-error'); setLabel($('btn-email-send'), '인증번호 발송'); }
  $('ctl-email').classList.remove('is-invalid');
  hide('email-message');
  $('btn-email-send').disabled = !$('email-input').value.trim() || $('email-input').value.trim() === me.email;
});
async function sendCode() {
  const email = $('email-input').value.trim();
  if (!EMAIL_RULE.test(email)) { $('ctl-email').classList.add('is-invalid'); emailMessage('is-error', '이메일 형식이 올바르지 않습니다.'); return; }
  setLoading($('btn-email-send'), '발송 중...');
  await wait(500);
  if (email === 'used@example.com') {
    setLabel($('btn-email-send'), '인증번호 발송');
    $('ctl-email').classList.add('is-invalid');
    emailMessage('is-error', '이미 가입된 이메일입니다.');
    return;
  }
  emailState = 'sent';
  codeFails = 0;
  $('code-input').value = '';
  $('ctl-code').classList.remove('is-invalid');
  hide('code-error');
  show('code-row');
  emailMessage('is-success', '인증번호를 보냈습니다. 메일을 확인해 주세요.');
  codeTimer.start(300);
  $('code-input').focus();
}
function verifyCode() {
  if (emailState !== 'sent') { return; }
  if ($('code-timer').textContent === '0:00') { codeError('인증번호가 만료되었습니다. 다시 발송해 주세요.'); return; }
  if (codeFails >= 5) { codeError('인증번호가 무효가 되었습니다. 다시 발송해 주세요.'); return; }
  if ($('code-input').value !== DEMO_CODE) {
    codeFails += 1;
    codeError(codeFails >= 5 ? '인증번호가 무효가 되었습니다. 다시 발송해 주세요.' : `인증번호가 틀렸습니다. (남은 횟수 ${5 - codeFails}회)`);
    return;
  }
  codeTimer.stop();
  emailState = 'verified';
  $('email-input').disabled = true;
  $('ctl-email').classList.add('is-locked');
  hide('btn-email-send', 'code-row', 'code-error');
  show('email-verified', 'btn-email-change-cancel', 'btn-email-change');
  setLabel($('btn-email-change'), '이메일 변경');
  emailMessage('is-success', '인증되었습니다.');
}
async function changeEmail() {
  setLoading($('btn-email-change'), '변경 중...');
  await wait(400);
  me.email = $('email-input').value.trim();
  $('email').textContent = me.email; // 좌측 하단 이메일도 바꾼다
  resetEmailArea();
  flash('success', '이메일을 바꿨습니다.');
}
$('btn-email-send').addEventListener('click', sendCode);
$('btn-code-verify').addEventListener('click', verifyCode);
$('code-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { verifyCode(); } });
$('code-input').addEventListener('input', () => { $('ctl-code').classList.remove('is-invalid'); hide('code-error'); });
// [변경]: 인증 취소, 이메일 칸 다시 입력 가능 (D-039)
$('btn-email-change-cancel').addEventListener('click', () => { const typed = $('email-input').value; resetEmailArea(); $('email-input').value = typed; $('btn-email-send').disabled = false; $('email-input').focus(); });
$('btn-email-change').addEventListener('click', changeEmail);

// ---------- 전화번호 (인증 없음) ----------
$('phone-input').addEventListener('input', () => {
  $('phone-input').value = $('phone-input').value.replace(/\D/g, '');
  $('btn-phone').disabled = $('phone-input').value === me.phone;
  error('ctl-phone', 'phone-error', false);
});
async function savePhone() {
  const value = $('phone-input').value;
  if (!/^\d{11}$/.test(value)) { $('phone-error').lastChild.textContent = '숫자 11자리로 입력해 주세요.'; error('ctl-phone', 'phone-error', true); return; }
  setLoading($('btn-phone'), '저장 중...');
  await wait(400);
  setLabel($('btn-phone'), '저장');
  if (value === '01000000000') { $('phone-error').lastChild.textContent = '이미 가입된 전화번호입니다.'; error('ctl-phone', 'phone-error', true); return; }
  me.phone = value;
  $('btn-phone').disabled = true;
  flash('success', '전화번호를 바꿨습니다.');
}
$('btn-phone').addEventListener('click', savePhone);

// ---------- 비밀번호 변경 (현재 비밀번호 확인, 5번 틀리면 10분 잠금, D-130) ----------
document.querySelectorAll('.pw-eye').forEach((button) => button.addEventListener('click', () => {
  const input = $(button.dataset.target);
  input.type = input.type === 'password' ? 'text' : 'password';
  button.querySelector('i').className = `bi ${input.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}`;
}));
async function changePassword() {
  const current = $('current-password').value;
  const next = $('new-password').value;
  const check = $('new-password-check').value;
  error('ctl-current', 'current-error', false);
  error('ctl-new', 'new-error', !PASSWORD_RULE.test(next));
  error('ctl-check', 'check-error', next !== check || !check);
  if (!current) { $('current-error').lastChild.textContent = '현재 비밀번호를 입력해 주세요.'; error('ctl-current', 'current-error', true); }
  if (!current || !PASSWORD_RULE.test(next) || next !== check) { return; }
  if (passwordFails >= 5) { flash('error', '비밀번호를 여러 번 틀려 10분 동안 확인할 수 없습니다.'); return; }
  setLoading($('btn-password'), '변경 중...');
  await wait(400);
  setLabel($('btn-password'), '비밀번호 변경');
  if (current !== DEMO_PASSWORD) {
    passwordFails += 1;
    if (passwordFails >= 5) { flash('error', '비밀번호를 여러 번 틀려 10분 동안 확인할 수 없습니다.'); return; }
    $('current-error').lastChild.textContent = '현재 비밀번호가 맞지 않습니다.';
    error('ctl-current', 'current-error', true);
    return;
  }
  passwordFails = 0;
  ['current-password', 'new-password', 'new-password-check'].forEach((id) => { $(id).value = ''; });
  flash('success', '비밀번호를 바꿨습니다.');
}
$('btn-password').addEventListener('click', changePassword);

// ---------- 회원 탈퇴 (D-041, D-130, D-131) ----------
// 시안에서는 관리자로 다른 팀원이 있는 팀이 없고, 나 혼자인 "주말 스터디"가 함께 해체되는 경우로 보여준다. 막히는 경우는 상태 막대에서 본다
function openWithdraw() {
  $('withdraw-password').value = '';
  $('btn-withdraw-next').disabled = true;
  error('ctl-withdraw-password', 'withdraw-password-error', false);
  show('withdraw-step1', 'solo-teams');
  $('withdraw-password').focus();
}
$('btn-withdraw-open').addEventListener('click', openWithdraw);
$('withdraw-password').addEventListener('input', () => { $('btn-withdraw-next').disabled = !$('withdraw-password').value; error('ctl-withdraw-password', 'withdraw-password-error', false); });
$('btn-withdraw-next').addEventListener('click', () => { hide('withdraw-step1'); show('withdraw-step2'); });
async function withdraw() {
  setLoading($('btn-withdraw'), '탈퇴 중...');
  await wait(500);
  setLabel($('btn-withdraw'), '탈퇴');
  hide('withdraw-step2');
  if ($('withdraw-password').value !== DEMO_PASSWORD) {
    show('withdraw-step1');
    error('ctl-withdraw-password', 'withdraw-password-error', true);
    return;
  }
  location.href = 'login_view.html?state=withdrawn';
}
$('btn-withdraw').addEventListener('click', withdraw);
$('btn-blocked-close').addEventListener('click', () => hide('withdraw-blocked'));
$('btn-step1-cancel').addEventListener('click', () => hide('withdraw-step1'));
$('btn-step2-cancel').addEventListener('click', () => hide('withdraw-step2'));
['withdraw-blocked', 'withdraw-step1', 'withdraw-step2'].forEach((id) => closeOnBackdrop(id));
escapeHandlers.push(() => hide('withdraw-blocked', 'withdraw-step1', 'withdraw-step2'));

// ---------- 시안 상태 막대 ----------
addToast('toast-server', 'error', '일시적인 오류가 발생했습니다.', '잠시 후 다시 시도해 주세요.');
function resetState() {
  clearFlash();
  me = { nickname: '홍길동', email: 'user@example.com', phone: '01012345678' };
  codeFails = 0;
  passwordFails = 0;
  hide('page-loading', 'withdraw-blocked', 'withdraw-step1', 'withdraw-step2', 'solo-teams');
  show('page-body');
  $('nickname-input').value = me.nickname; $('btn-nickname').disabled = true; error('ctl-nickname', 'nickname-error', false);
  $('phone-input').value = me.phone; $('btn-phone').disabled = true; error('ctl-phone', 'phone-error', false);
  ['current-password', 'new-password', 'new-password-check'].forEach((id) => { $(id).value = ''; });
  [['ctl-current', 'current-error'], ['ctl-new', 'new-error'], ['ctl-check', 'check-error']].forEach(([c, m]) => error(c, m, false));
  setLabel($('btn-password'), '비밀번호 변경');
  resetEmailArea();
}
const typeEmail = (value) => { $('email-input').value = value; $('email-input').dispatchEvent(new Event('input')); };
const STATES = {
  'default': { label: '기본 (직접 눌러 보세요)', run: () => {} },
  'loading': { label: '로딩 중', run: () => { hide('page-body'); show('page-loading'); } },
  'nickname-error': { label: '닉네임 입력 오류', run: () => { $('nickname-input').value = '길동!'; saveNickname(); } },
  'email-duplicated': { label: '이메일 중복', run: () => { typeEmail('used@example.com'); $('ctl-email').classList.add('is-invalid'); emailMessage('is-error', '이미 가입된 이메일입니다.'); } },
  'email-sent': { label: '인증번호 발송 후', run: () => { typeEmail('new.mail@example.com'); emailState = 'sent'; show('code-row'); codeTimer.start(300); } },
  'code-wrong': { label: '인증번호 틀림', run: () => { typeEmail('new.mail@example.com'); emailState = 'sent'; show('code-row'); codeTimer.start(300); $('code-input').value = '111111'; verifyCode(); } },
  'email-verified': { label: '이메일 인증 완료 ([이메일 변경])', run: () => { typeEmail('new.mail@example.com'); emailState = 'sent'; $('code-input').value = DEMO_CODE; verifyCode(); } },
  'phone-duplicated': { label: '전화번호 중복', run: () => { $('phone-input').value = '01000000000'; $('phone-error').lastChild.textContent = '이미 가입된 전화번호입니다.'; error('ctl-phone', 'phone-error', true); } },
  'password-error': { label: '비밀번호 입력 오류', run: () => { $('new-password').value = 'abc'; $('new-password-check').value = 'abd'; $('current-password').value = 'x'; error('ctl-new', 'new-error', true); error('ctl-check', 'check-error', true); } },
  'password-mismatch': { label: '현재 비밀번호 틀림', run: () => { $('current-error').lastChild.textContent = '현재 비밀번호가 맞지 않습니다.'; error('ctl-current', 'current-error', true); } },
  'password-locked': { label: '5번 틀려 잠김 (423)', run: () => flash('error', '비밀번호를 여러 번 틀려 10분 동안 확인할 수 없습니다.') },
  'withdraw-blocked': { label: '탈퇴 막힘 (관리자인 팀, → 팀 정보)', run: () => show('withdraw-blocked') },
  'withdraw-step1': { label: '탈퇴 1단계 (혼자인 팀 함께 해체)', run: openWithdraw },
  'withdraw-step1-wrong': { label: '탈퇴 1단계 (비밀번호 틀림)', run: () => { openWithdraw(); $('withdraw-password').value = 'wrong'; $('btn-withdraw-next').disabled = false; error('ctl-withdraw-password', 'withdraw-password-error', true); } },
  'withdraw-step2': { label: '탈퇴 2단계', run: () => show('withdraw-step2') },
  'server-error': { label: '서버 오류', run: () => show('toast-server') },
};
setupStates(STATES, resetState);
