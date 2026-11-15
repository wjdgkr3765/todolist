// 회원가입 시안 동작 (signup_view.html). 상태 막대로 미리 정해 둔 상태를 보거나, 화면을 직접 눌러 동작을 확인한다 (D-146, D-149)
// 시안 규칙: 사용 중인 아이디 todo2026·admin123, 가입된 이메일 user@example.com·used@example.com, 인증번호 123456,
// 가입된 전화번호 01000000000, 하루 발송 제한 번호 01099999999, 문자 발송 실패 번호 01088888888 (D-168)
const $ = (id) => document.getElementById(id);
const SAMPLE = { loginId: 'todo2026', nickname: '홍길동', email: 'user@example.com', phone: '01012345678', pw: 'abcd123!' };
const FIELD_IDS = ['login-id', 'password', 'password-confirm', 'nickname', 'email', 'code', 'phone', 'phone-code'];

const show = (id) => $(id).classList.remove('is-hidden');
const hide = (id) => $(id).classList.add('is-hidden');
const ctl = (id) => $('ctl-' + id);
const markInvalid = (id) => ctl(id).classList.add('is-invalid');
const markValid = (id) => ctl(id).classList.add('is-valid');
const setText = (id, text) => { $(id).lastChild.textContent = text; };
const clearField = (id) => { ctl(id).classList.remove('is-invalid', 'is-valid'); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function busy(button, label) {
  const spinner = document.createElement('span');
  spinner.className = 'spinner-border spinner-border-sm me-1';
  button.replaceChildren(spinner, document.createTextNode(label));
  button.disabled = true;
}

const RULES = {
  'login-id': /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,15}$/,
  password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!-/:-@[-`{-~])[!-~]{8,15}$/,
  nickname: /^[가-힣A-Za-z0-9]{1,8}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^010\d{8}$/,
};
const PHONE_MESSAGE = '010으로 시작하는 숫자 11자리로 입력해 주세요.';

// ---------- 인증번호 (이메일 D-035, 전화번호 D-168: 6자리, 5분, 재발송 1분 뒤, 5번 틀리면 무효) ----------
// 이메일과 전화번호가 같은 흐름을 쓴다. ids 는 그 인증의 요소 id 모음
function makeVerifier(ids, rules) {
  const flow = { codeSent: false, verified: false, fails: 0, left: 0, timer: null };

  function reset() {
    clearInterval(flow.timer);
    Object.assign(flow, { codeSent: false, verified: false, fails: 0, left: 0 });
    [ids.codeRow, ids.resend, ids.change, ids.mark].forEach(hide);
    show(ids.send);
    $(ids.resend).disabled = true;
    $(ids.resend).textContent = '재발송 0:59';
    $(ids.timer).textContent = '4:59';
  }
  function showSent() {
    show(ids.codeRow);
    hide(ids.send);
    show(ids.resend);
    show(ids.sent);
  }
  function showVerified() {
    $(ids.field).readOnly = true;
    ctl(ids.field).classList.add('is-readonly');
    show(ids.mark);
    hide(ids.send);
    show(ids.change);
    show(ids.verified);
  }
  function startTimer() {
    clearInterval(flow.timer);
    flow.left = 300;
    const tick = () => {
      const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      $(ids.timer).textContent = fmt(Math.max(flow.left, 0));
      const resend = flow.left - 240;
      $(ids.resend).disabled = resend > 0;
      $(ids.resend).textContent = resend > 0 ? `재발송 ${fmt(resend)}` : '재발송';
      if (flow.left <= 0) { clearInterval(flow.timer); }
      flow.left -= 1;
    };
    tick();
    flow.timer = setInterval(tick, 1000);
  }
  function fieldError(text) { setText(ids.invalid, text); markInvalid(ids.field); show(ids.invalid); }
  async function send() {
    const value = $(ids.field).value.trim();
    [ids.sent, ids.invalid].forEach(hide);
    clearField(ids.field);
    if (!rules.format.test(value)) { fieldError(rules.formatMessage); return; }
    const button = flow.codeSent ? $(ids.resend) : $(ids.send);
    busy(button, '발송 중');
    await pause(500);
    if (!flow.codeSent) { $(ids.send).textContent = '인증번호 발송'; $(ids.send).disabled = false; }
    const serverError = rules.serverError(value);
    if (serverError) {
      fieldError(serverError);
      if (flow.codeSent) { $(ids.resend).textContent = '재발송'; $(ids.resend).disabled = false; }
      return;
    }
    flow.codeSent = true;
    flow.fails = 0;
    $(ids.code).value = '';
    clearField(ids.code);
    [ids.mismatch, ids.expired, ids.send].forEach(hide);
    [ids.codeRow, ids.resend, ids.sent].forEach(show);
    startTimer();
    $(ids.code).focus();
  }
  function codeError(id, text) { [ids.mismatch, ids.expired].forEach(hide); setText(id, text); markInvalid(ids.code); show(id); }
  function verify() {
    if (flow.left < 0) { codeError(ids.expired, '인증번호가 만료되었습니다. 다시 발송해 주세요.'); return; }
    if (flow.fails >= 5) { codeError(ids.expired, '인증번호가 무효가 되었습니다. 다시 발송해 주세요.'); return; }
    if ($(ids.code).value !== '123456') {
      flow.fails += 1;
      if (flow.fails >= 5) { codeError(ids.expired, '인증번호가 무효가 되었습니다. 다시 발송해 주세요.'); return; }
      codeError(ids.mismatch, `인증번호가 틀렸습니다. (남은 횟수 ${5 - flow.fails}회)`);
      return;
    }
    clearInterval(flow.timer);
    flow.verified = true;
    [ids.codeRow, ids.resend, ids.sent, ids.invalid].forEach(hide);
    clearField(ids.field);
    showVerified();
  }
  // 인증을 마친 뒤 [변경]: 인증 취소하고 다시 입력 (D-039)
  function change() {
    flow.verified = false;
    flow.codeSent = false;
    $(ids.field).readOnly = false;
    ctl(ids.field).classList.remove('is-readonly');
    [ids.mark, ids.change, ids.verified].forEach(hide);
    show(ids.send);
    $(ids.field).focus();
  }
  // 발송 뒤 칸을 고치면 처음부터 다시 발송
  function onInput() {
    if (flow.codeSent && !flow.verified) {
      clearInterval(flow.timer);
      flow.codeSent = false;
      [ids.codeRow, ids.resend, ids.sent, ids.mismatch, ids.expired].forEach(hide);
      show(ids.send);
    }
    clearField(ids.field);
    hide(ids.invalid);
  }

  $(ids.send).addEventListener('click', send);
  $(ids.resend).addEventListener('click', send);
  $(ids.verifyButton).addEventListener('click', verify);
  $(ids.code).addEventListener('input', () => { $(ids.code).value = $(ids.code).value.replace(/\D/g, ''); });
  $(ids.code).addEventListener('keydown', (event) => { if (event.key === 'Enter') { verify(); } });
  $(ids.change).addEventListener('click', change);
  return { flow, ids, reset, showSent, showVerified, onInput };
}

const emailAuth = makeVerifier({
  field: 'email', send: 'btn-send-code', resend: 'btn-resend-code', change: 'btn-change-email', mark: 'email-mark',
  sent: 'email-sent', verified: 'email-verified', invalid: 'email-invalid', codeRow: 'code-row', code: 'code',
  timer: 'timer', verifyButton: 'btn-verify-code', mismatch: 'code-mismatch', expired: 'code-expired',
}, {
  format: RULES.email,
  formatMessage: '이메일 형식이 올바르지 않습니다.',
  serverError: (value) => (['user@example.com', 'used@example.com'].includes(value.toLowerCase()) ? '이미 가입된 이메일입니다.' : null),
});

const phoneAuth = makeVerifier({
  field: 'phone', send: 'btn-send-phone-code', resend: 'btn-resend-phone-code', change: 'btn-change-phone', mark: 'phone-mark',
  sent: 'phone-sent', verified: 'phone-verified', invalid: 'phone-invalid', codeRow: 'phone-code-row', code: 'phone-code',
  timer: 'phone-timer', verifyButton: 'btn-verify-phone-code', mismatch: 'phone-code-mismatch', expired: 'phone-code-expired',
}, {
  format: RULES.phone,
  formatMessage: PHONE_MESSAGE,
  serverError: (value) => ({
    '01000000000': '이미 가입된 전화번호입니다.',
    '01099999999': '오늘은 이 번호로 더 보낼 수 없습니다. 내일 다시 시도해 주세요.',
    '01088888888': '문자를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
  })[value] ?? null,
});

// ---------- 상태 막대 ----------
let idChecked = false;

function resetState() {
  document.querySelectorAll('form input, form button').forEach((el) => { el.disabled = false; });
  document.querySelectorAll('.message, .toast-box').forEach((el) => el.classList.add('is-hidden'));
  FIELD_IDS.forEach((id) => {
    ctl(id).classList.remove('is-invalid', 'is-valid', 'is-readonly');
    $(id).readOnly = false;
    $(id).value = '';
  });
  hide('login-id-mark');
  emailAuth.reset();
  phoneAuth.reset();
  idChecked = false;
  $('btn-submit').disabled = false;
  $('btn-submit').textContent = '가입하기';
}

function fillSample() {
  $('login-id').value = SAMPLE.loginId;
  $('password').value = SAMPLE.pw;
  $('password-confirm').value = SAMPLE.pw;
  $('nickname').value = SAMPLE.nickname;
  $('email').value = SAMPLE.email;
  $('phone').value = SAMPLE.phone;
}

function showIdChecked() {
  markValid('login-id');
  show('login-id-mark');
  show('login-id-valid');
}

function showAllVerified() {
  fillSample();
  showIdChecked();
  emailAuth.showVerified();
  phoneAuth.showVerified();
}

function showCodeSent(auth, value) {
  $(auth.ids.field).value = value;
  auth.showSent();
}

const STATES = {
  'default': () => {},
  'input-error': () => {
    $('login-id').value = 'todo';
    $('password').value = 'abcd';
    $('password-confirm').value = 'abce';
    $('nickname').value = '홍길동_1';
    $('email').value = 'user@example';
    $('phone').value = '02123456789';
    ['login-id', 'password', 'password-confirm', 'nickname', 'email', 'phone'].forEach(markInvalid);
    ['login-id-invalid', 'password-invalid', 'password-confirm-invalid', 'nickname-invalid', 'email-invalid', 'phone-invalid'].forEach(show);
    setText('phone-invalid', PHONE_MESSAGE);
  },
  'id-checked': () => {
    $('login-id').value = SAMPLE.loginId;
    showIdChecked();
  },
  'code-sent': () => showCodeSent(emailAuth, SAMPLE.email),
  'code-mismatch': () => {
    showCodeSent(emailAuth, SAMPLE.email);
    hide('email-sent');
    $('code').value = '123455';
    markInvalid('code');
    $('timer').textContent = '3:12';
    show('code-mismatch');
  },
  'code-expired': () => {
    showCodeSent(emailAuth, SAMPLE.email);
    hide('email-sent');
    markInvalid('code');
    $('timer').textContent = '0:00';
    $('btn-resend-code').disabled = false;
    $('btn-resend-code').textContent = '재발송';
    show('code-expired');
  },
  'phone-code-sent': () => showCodeSent(phoneAuth, SAMPLE.phone),
  'phone-code-mismatch': () => {
    showCodeSent(phoneAuth, SAMPLE.phone);
    hide('phone-sent');
    $('phone-code').value = '123455';
    markInvalid('phone-code');
    $('phone-timer').textContent = '3:12';
    show('phone-code-mismatch');
  },
  'phone-duplicated': () => {
    $('phone').value = '01000000000';
    markInvalid('phone');
    setText('phone-invalid', '이미 가입된 전화번호입니다.');
    show('phone-invalid');
  },
  'phone-daily-limit': () => {
    $('phone').value = '01099999999';
    markInvalid('phone');
    setText('phone-invalid', '오늘은 이 번호로 더 보낼 수 없습니다. 내일 다시 시도해 주세요.');
    show('phone-invalid');
  },
  'verified': () => showAllVerified(),
  'loading': () => {
    showAllVerified();
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm me-2';
    spinner.setAttribute('aria-hidden', 'true');
    $('btn-submit').replaceChildren(spinner, document.createTextNode('가입 중...'));
    $('btn-submit').disabled = true;
  },
  'complete': () => {
    showAllVerified();
    show('toast-complete');
    // 가입 완료 후 폼 전체 잠금 (D-048). 실제 화면은 1.5초 뒤 로그인 화면(login_view.html)으로 이동 (D-040)
    document.querySelectorAll('form .control').forEach((el) => el.classList.add('is-readonly'));
    document.querySelectorAll('form input, form button').forEach((el) => { el.disabled = true; });
  },
  'server-error': () => {
    showAllVerified();
    show('toast-error');
  },
};

$('state-select').addEventListener('change', (event) => {
  resetState();
  STATES[event.target.value]();
});

// ---------- 동작 (D-146, D-149): SignupView_screen.md "4. 동작"을 서버 없이 흉내 낸다 ----------
// 아이디 중복 확인 (D-038)
async function checkId() {
  const value = $('login-id').value.trim();
  ['login-id-valid', 'login-id-invalid'].forEach(hide);
  clearField('login-id');
  if (!RULES['login-id'].test(value)) { setText('login-id-invalid', '영어와 숫자를 모두 포함해 6~15자로 입력해 주세요.'); markInvalid('login-id'); show('login-id-invalid'); return; }
  busy($('btn-check-id'), '확인 중');
  await pause(400);
  $('btn-check-id').textContent = '중복 확인';
  $('btn-check-id').disabled = false;
  if (['todo2026', 'admin123'].includes(value.toLowerCase())) { setText('login-id-invalid', '이미 사용 중인 아이디입니다.'); markInvalid('login-id'); show('login-id-invalid'); return; }
  idChecked = true;
  showIdChecked();
}
// 칸을 떠날 때 형식 검사
function checkField(id) {
  const value = $(id).value;
  clearField(id);
  hide(`${id}-invalid`);
  if (!value) { return true; }
  const ok = id === 'password-confirm' ? value === $('password').value : RULES[id].test(value);
  if (!ok) {
    if (id === 'phone') { setText('phone-invalid', PHONE_MESSAGE); }
    markInvalid(id);
    show(`${id}-invalid`);
  }
  return ok;
}

async function signup() {
  let first = null;
  const fail = (id, msgId, text) => { if (text) { setText(msgId, text); } markInvalid(id); show(msgId); if (!first) { first = id; } };
  ['login-id', 'password', 'password-confirm', 'nickname'].forEach((id) => {
    if (!$(id).value) { fail(id, `${id}-invalid`); } else if (!checkField(id) && !first) { first = id; }
  });
  if ($('login-id').value && RULES['login-id'].test($('login-id').value) && !idChecked) { fail('login-id', 'login-id-invalid', '아이디 중복 확인을 해 주세요.'); }
  if (!emailAuth.flow.verified) { fail('email', 'email-invalid', '이메일 인증을 완료해 주세요.'); }
  if (!phoneAuth.flow.verified) { fail('phone', 'phone-invalid', '전화번호 인증을 완료해 주세요.'); }
  if (first) { $(first).focus(); return; }
  busy($('btn-submit'), '가입 중...');
  await pause(600);
  // 가입 성공: 모든 입력칸과 버튼 잠금 + 안내 + 1.5초 뒤 로그인 화면 (D-040, D-048)
  $('btn-submit').textContent = '가입하기';
  document.querySelectorAll('form .control').forEach((el) => el.classList.add('is-readonly'));
  document.querySelectorAll('form input, form button').forEach((el) => { el.disabled = true; });
  show('toast-complete');
  setTimeout(() => { location.href = 'login_view.html'; }, 1500);
}

$('btn-check-id').addEventListener('click', checkId);
$('login-id').addEventListener('input', () => { idChecked = false; clearField('login-id'); ['login-id-valid', 'login-id-invalid', 'login-id-mark'].forEach(hide); });
['password', 'password-confirm', 'nickname'].forEach((id) => $(id).addEventListener('blur', () => checkField(id)));
$('phone').addEventListener('blur', () => { if (!phoneAuth.flow.codeSent && !phoneAuth.flow.verified) { checkField('phone'); } });
$('phone').addEventListener('input', () => { $('phone').value = $('phone').value.replace(/\D/g, ''); phoneAuth.onInput(); });
$('email').addEventListener('input', () => emailAuth.onInput());
$('btn-submit').addEventListener('click', signup);
$('btn-eye').addEventListener('click', () => {
  const input = $('password');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('btn-eye').querySelector('i').className = `bi ${input.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}`;
});

// 검사용: ?check=all 이면 모든 상태를 그려 본다
if (new URLSearchParams(location.search).get('check') === 'all') { Object.keys(STATES).forEach((key) => { resetState(); STATES[key](); }); console.info('MOCKUP_CHECK_DONE ' + Object.keys(STATES).length); resetState(); }
