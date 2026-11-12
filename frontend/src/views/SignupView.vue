<!-- 회원가입 화면 (SignupView_screen.md, 시안 docs/mockups/signup_view.html) -->
<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthBrandPanel from '../components/AuthBrandPanel.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useToastStore } from '../stores/toast.js';
import {
  formatSeconds, isEmail, isLoginId, isNickname, isPassword, isPhone, isVerificationCode,
} from '../utils/validation.js';

const MESSAGES = {
  loginIdFormat: '영어와 숫자를 모두 포함해 6~15자로 입력해 주세요.',
  loginIdUsed: '이미 사용 중인 아이디입니다.',
  loginIdNotChecked: '아이디 중복 확인을 해 주세요.',
  password: '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.',
  passwordConfirm: '비밀번호가 일치하지 않습니다.',
  nickname: '한글, 영어, 숫자로 1~8자 입력해 주세요.',
  emailFormat: '이메일 형식이 올바르지 않습니다.',
  emailUsed: '이미 가입된 이메일입니다.',
  emailNotVerified: '이메일 인증을 완료해 주세요.',
  phone: '숫자만 11자리로 입력해 주세요.',
  phoneUsed: '이미 가입된 전화번호입니다.',
};
const FIELD_ORDER = ['loginId', 'password', 'passwordConfirm', 'nickname', 'email', 'phone'];
const DONE_REDIRECT_MS = 1500;

const router = useRouter();
const toastStore = useToastStore();

const form = reactive({ loginId: '', password: '', passwordConfirm: '', nickname: '', email: '', code: '', phone: '' });
const errors = reactive({ loginId: '', password: '', passwordConfirm: '', nickname: '', email: '', code: '', phone: '' });
const loading = reactive({ checkId: false, sendCode: false, verifyCode: false, submit: false });
const inputs = reactive({});

const isIdChecked = ref(false);
const isPasswordVisible = ref(false);
const isDone = ref(false);
// 인증: id, 남은 시간 기준 시각(브라우저 시계 기준으로 바꾼 값)
const verification = reactive({ id: null, isCodeSent: false, isVerified: false, expireAt: 0, resendAt: 0 });
const now = ref(Date.now());
let clockTimer = null;

const remainingSeconds = computed(() => Math.max(0, Math.floor((verification.expireAt - now.value) / 1000)));
const resendSeconds = computed(() => Math.max(0, Math.ceil((verification.resendAt - now.value) / 1000)));
const isResendWaiting = computed(() => resendSeconds.value > 0);
const isCodeComplete = computed(() => isVerificationCode(form.code));
const isLocked = computed(() => isDone.value);

function startClock() {
  stopClock();
  now.value = Date.now();
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
}
function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}
onBeforeUnmount(stopClock);

function setInputRef(name) {
  return (element) => { inputs[name] = element; };
}

// ---------- 아이디 ----------
function onLoginIdInput() {
  isIdChecked.value = false;
  errors.loginId = '';
}

async function checkLoginId() {
  errors.loginId = '';
  isIdChecked.value = false;
  if (!isLoginId(form.loginId)) {
    errors.loginId = MESSAGES.loginIdFormat;
    return;
  }
  loading.checkId = true;
  try {
    const data = await apiRequest('GET', '/api/users/login-id-availability', { query: { loginId: form.loginId } });
    if (data.isAvailable) {
      isIdChecked.value = true;
    } else {
      errors.loginId = MESSAGES.loginIdUsed;
    }
  } catch (error) {
    if (error.code === 'INVALID_INPUT') {
      errors.loginId = MESSAGES.loginIdFormat;
    }
  } finally {
    loading.checkId = false;
  }
}

// ---------- 칸을 떠날 때 형식 검사 ----------
const BLUR_CHECKS = {
  password: () => isPassword(form.password) || MESSAGES.password,
  passwordConfirm: () => form.passwordConfirm === form.password || MESSAGES.passwordConfirm,
  nickname: () => isNickname(form.nickname) || MESSAGES.nickname,
  phone: () => isPhone(form.phone) || MESSAGES.phone,
};

function checkField(name) {
  errors[name] = '';
  if (!form[name]) {
    return true;
  }
  const result = BLUR_CHECKS[name]();
  if (result !== true) {
    errors[name] = result;
  }
  return result === true;
}

function onPhoneInput() {
  form.phone = form.phone.replace(/\D/g, '');
  if (errors.phone === MESSAGES.phoneUsed) {
    errors.phone = '';
  }
}

// ---------- 이메일 인증 ----------
function resetVerification() {
  stopClock();
  Object.assign(verification, { id: null, isCodeSent: false, isVerified: false, expireAt: 0, resendAt: 0 });
  form.code = '';
  errors.code = '';
}

function onEmailInput() {
  if (verification.isCodeSent && !verification.isVerified) {
    resetVerification();
  }
  errors.email = '';
}

async function sendCode() {
  form.email = form.email.trim();
  errors.email = '';
  if (!isEmail(form.email)) {
    errors.email = MESSAGES.emailFormat;
    return;
  }
  loading.sendCode = true;
  try {
    const data = await apiRequest('POST', '/api/email-verifications', { body: { email: form.email, purpose: 'signup' } });
    const sentAt = Date.now();
    const resendMs = Date.parse(data.resendAvailableDate);
    const expireMs = Date.parse(data.expireDate);
    // 서버 시계와 브라우저 시계가 달라도 남은 시간이 맞도록, 발송 시각(재발송 가능 - 1분) 기준 길이만 쓴다
    const issuedMs = resendMs - 60 * 1000;
    Object.assign(verification, {
      id: data.verificationId,
      isCodeSent: true,
      isVerified: false,
      expireAt: sentAt + (expireMs - issuedMs),
      resendAt: sentAt + (resendMs - issuedMs),
    });
    form.code = '';
    errors.code = '';
    startClock();
    await nextTick();
    inputs.code?.focus();
  } catch (error) {
    if (error.code === 'EMAIL_DUPLICATED') {
      errors.email = MESSAGES.emailUsed;
    } else if (error.code === 'INVALID_INPUT') {
      errors.email = MESSAGES.emailFormat;
    } else if (error.code === 'VERIFICATION_RESEND_TOO_SOON') {
      errors.email = error.message;
    }
  } finally {
    loading.sendCode = false;
  }
}

function onCodeInput() {
  form.code = form.code.replace(/\D/g, '');
}

async function verifyCode() {
  if (!isCodeComplete.value || loading.verifyCode) {
    return;
  }
  errors.code = '';
  loading.verifyCode = true;
  try {
    await apiRequest('POST', `/api/email-verifications/${verification.id}/verify`, { body: { code: form.code } });
    stopClock();
    verification.isVerified = true;
    errors.email = '';
  } catch (error) {
    if (['VERIFICATION_CODE_MISMATCH', 'VERIFICATION_EXPIRED', 'VERIFICATION_LOCKED'].includes(error.code)) {
      errors.code = error.message;
    } else if (error.code === 'NOT_FOUND') {
      errors.code = '인증번호가 무효가 되었습니다. 다시 발송해 주세요.';
    }
    if (error.code === 'VERIFICATION_EXPIRED' || error.code === 'VERIFICATION_LOCKED' || error.code === 'NOT_FOUND') {
      // 재발송 버튼을 바로 누를 수 있게 한다 (상태별 화면 "인증 만료 / 무효")
      verification.expireAt = Date.now();
    }
  } finally {
    loading.verifyCode = false;
  }
}

// 인증을 마친 뒤 [변경]: 인증 취소하고 이메일을 다시 입력 (D-039)
async function changeEmail() {
  resetVerification();
  errors.email = '';
  await nextTick();
  inputs.email?.focus();
}

// ---------- 가입하기 ----------
function validateAll() {
  ['loginId', 'password', 'passwordConfirm', 'nickname', 'phone'].forEach((name) => { errors[name] = ''; });
  if (!form.loginId || !isLoginId(form.loginId)) {
    errors.loginId = MESSAGES.loginIdFormat;
  } else if (!isIdChecked.value) {
    errors.loginId = MESSAGES.loginIdNotChecked;
  }
  // 빈 칸은 그 칸의 형식 안내를 오류로 보여준다 (시안과 같음)
  ['password', 'passwordConfirm', 'nickname', 'phone'].forEach((name) => {
    if (!form[name]) {
      errors[name] = MESSAGES[name];
    } else {
      checkField(name);
    }
  });
  if (!verification.isVerified) {
    errors.email = MESSAGES.emailNotVerified;
  }
  return FIELD_ORDER.find((name) => errors[name]) ?? null;
}

async function focusField(name) {
  await nextTick();
  inputs[name]?.focus();
}

async function submit() {
  const firstError = validateAll();
  if (firstError) {
    await focusField(firstError);
    return;
  }
  loading.submit = true;
  try {
    await apiRequest('POST', '/api/users', {
      body: {
        loginId: form.loginId,
        password: form.password,
        nickname: form.nickname,
        email: form.email,
        phone: form.phone,
        verificationId: verification.id,
      },
    });
    // 가입 성공: 모든 입력칸과 버튼 잠금 + 안내 + 1.5초 뒤 로그인 화면 (D-040, D-048)
    isDone.value = true;
    toastStore.show('success', '가입이 완료되었습니다.', '로그인 화면으로 이동합니다.');
    setTimeout(() => router.push('/login'), DONE_REDIRECT_MS);
  } catch (error) {
    await handleSubmitError(error);
  } finally {
    loading.submit = false;
  }
}

async function handleSubmitError(error) {
  if (error.code === 'LOGIN_ID_DUPLICATED') {
    isIdChecked.value = false;
    errors.loginId = MESSAGES.loginIdUsed;
    await focusField('loginId');
  } else if (error.code === 'EMAIL_DUPLICATED' || error.code === 'EMAIL_NOT_VERIFIED') {
    resetVerification();
    errors.email = error.code === 'EMAIL_DUPLICATED' ? MESSAGES.emailUsed : MESSAGES.emailNotVerified;
    await focusField('email');
  } else if (error.code === 'PHONE_DUPLICATED') {
    errors.phone = MESSAGES.phoneUsed;
    await focusField('phone');
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <AuthBrandPanel />

      <section class="form-panel">
        <h1 class="form-heading">회원가입</h1>
        <p class="form-subheading">몇 가지 정보만 입력하면 바로 시작할 수 있어요.</p>

        <form novalidate @submit.prevent="submit">
          <div class="form-section-title">계정 정보</div>

          <!-- 아이디 -->
          <div class="field">
            <label class="field-label" for="login-id">아이디</label>
            <div class="field-row">
              <div class="control" :class="{ 'is-invalid': errors.loginId, 'is-valid': isIdChecked, 'is-readonly': isLocked }">
                <span class="control-icon"><i class="bi bi-person"></i></span>
                <input id="login-id" :ref="setInputRef('loginId')" v-model="form.loginId" type="text" maxlength="15"
                  placeholder="영어와 숫자를 모두 포함 6~15자" autocomplete="username" :disabled="isLocked" @input="onLoginIdInput" />
                <span v-if="isIdChecked" class="control-suffix"><span class="valid-mark"><i class="bi bi-check-circle-fill"></i></span></span>
              </div>
              <button type="button" class="btn-soft" :disabled="loading.checkId || isLocked" @click="checkLoginId">
                <LoadingLabel :is-loading="loading.checkId" loading-text="확인 중" text="중복 확인" />
              </button>
            </div>
            <div v-if="isIdChecked" class="message is-success"><i class="bi bi-check-circle"></i>사용할 수 있는 아이디입니다.</div>
            <div v-if="errors.loginId" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.loginId }}</div>
          </div>

          <!-- 비밀번호 -->
          <div class="field">
            <label class="field-label" for="password">비밀번호</label>
            <div class="control" :class="{ 'is-invalid': errors.password, 'is-readonly': isLocked }">
              <span class="control-icon"><i class="bi bi-lock"></i></span>
              <input id="password" :ref="setInputRef('password')" v-model="form.password" :type="isPasswordVisible ? 'text' : 'password'"
                maxlength="15" placeholder="영어, 숫자, 특수문자를 모두 포함 8~15자" autocomplete="new-password" :disabled="isLocked"
                @blur="checkField('password')" />
              <span class="control-suffix">
                <button type="button" class="icon-button" :aria-label="isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'"
                  :disabled="isLocked" @click="isPasswordVisible = !isPasswordVisible">
                  <i class="bi" :class="isPasswordVisible ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </span>
            </div>
            <div v-if="errors.password" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.password }}</div>
          </div>

          <!-- 비밀번호 확인 -->
          <div class="field">
            <label class="field-label" for="password-confirm">비밀번호 확인</label>
            <div class="control" :class="{ 'is-invalid': errors.passwordConfirm, 'is-readonly': isLocked }">
              <span class="control-icon"><i class="bi bi-shield-lock"></i></span>
              <input id="password-confirm" :ref="setInputRef('passwordConfirm')" v-model="form.passwordConfirm" type="password"
                maxlength="15" placeholder="비밀번호를 한 번 더 입력" autocomplete="new-password" :disabled="isLocked"
                @blur="checkField('passwordConfirm')" />
            </div>
            <div v-if="errors.passwordConfirm" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.passwordConfirm }}</div>
          </div>

          <!-- 닉네임 -->
          <div class="field">
            <label class="field-label" for="nickname">닉네임</label>
            <div class="control" :class="{ 'is-invalid': errors.nickname, 'is-readonly': isLocked }">
              <span class="control-icon"><i class="bi bi-emoji-smile"></i></span>
              <input id="nickname" :ref="setInputRef('nickname')" v-model="form.nickname" type="text" maxlength="8"
                placeholder="한글, 영어, 숫자 1~8자" autocomplete="nickname" :disabled="isLocked" @blur="checkField('nickname')" />
            </div>
            <div v-if="errors.nickname" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.nickname }}</div>
          </div>

          <div class="form-section-title mt-4">본인 확인</div>

          <!-- 이메일 -->
          <div class="field">
            <label class="field-label" for="email">이메일</label>
            <div class="field-row">
              <div class="control" :class="{ 'is-invalid': errors.email, 'is-readonly': verification.isVerified || isLocked }">
                <span class="control-icon"><i class="bi bi-envelope"></i></span>
                <input id="email" :ref="setInputRef('email')" v-model="form.email" type="email" maxlength="100"
                  placeholder="example@email.com" autocomplete="email" :readonly="verification.isVerified" :disabled="isLocked"
                  @input="onEmailInput" />
                <span v-if="verification.isVerified" class="control-suffix"><span class="valid-mark"><i class="bi bi-patch-check-fill"></i></span></span>
              </div>
              <button v-if="!verification.isCodeSent && !verification.isVerified" type="button" class="btn-soft"
                :disabled="loading.sendCode || isLocked" @click="sendCode">
                <LoadingLabel :is-loading="loading.sendCode" loading-text="발송 중" text="인증번호 발송" />
              </button>
              <button v-if="verification.isCodeSent && !verification.isVerified" type="button" class="btn-soft"
                :disabled="isResendWaiting || loading.sendCode || isLocked" @click="sendCode">
                <LoadingLabel :is-loading="loading.sendCode" loading-text="발송 중"
                  :text="isResendWaiting ? `재발송 ${formatSeconds(resendSeconds)}` : '재발송'" />
              </button>
              <button v-if="verification.isVerified" type="button" class="btn-ghost" :disabled="isLocked" @click="changeEmail">변경</button>
            </div>
            <div v-if="verification.isCodeSent && !verification.isVerified && !errors.email && !errors.code" class="message is-info">
              <i class="bi bi-send"></i>인증번호를 보냈습니다. 메일을 확인해 주세요.
            </div>
            <div v-if="verification.isVerified" class="message is-success"><i class="bi bi-check-circle"></i>이메일 인증이 완료되었습니다.</div>
            <div v-if="errors.email" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.email }}</div>

            <!-- 인증번호 (발송 후 표시) -->
            <div v-if="verification.isCodeSent && !verification.isVerified" class="field-row mt-2">
              <div class="control" :class="{ 'is-invalid': errors.code }">
                <span class="control-icon"><i class="bi bi-key"></i></span>
                <input id="code" :ref="setInputRef('code')" v-model="form.code" type="text" inputmode="numeric" maxlength="6"
                  placeholder="인증번호 6자리" autocomplete="one-time-code" aria-label="인증번호" :disabled="isLocked"
                  @input="onCodeInput" @keydown.enter.prevent="verifyCode" />
                <span class="control-suffix"><span class="timer-pill">{{ formatSeconds(remainingSeconds) }}</span></span>
              </div>
              <button type="button" class="btn-soft" :disabled="!isCodeComplete || loading.verifyCode || isLocked" @click="verifyCode">
                <LoadingLabel :is-loading="loading.verifyCode" loading-text="확인 중" text="확인" />
              </button>
            </div>
            <div v-if="errors.code" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.code }}</div>
          </div>

          <!-- 전화번호 -->
          <div class="field">
            <label class="field-label" for="phone">전화번호</label>
            <div class="control" :class="{ 'is-invalid': errors.phone, 'is-readonly': isLocked }">
              <span class="control-icon"><i class="bi bi-phone"></i></span>
              <input id="phone" :ref="setInputRef('phone')" v-model="form.phone" type="tel" inputmode="numeric" maxlength="11"
                placeholder="숫자만 11자리 (예: 01012345678)" autocomplete="tel" :disabled="isLocked"
                @input="onPhoneInput" @blur="checkField('phone')" />
            </div>
            <div v-if="errors.phone" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.phone }}</div>
          </div>

          <button type="submit" class="btn-submit" :disabled="loading.submit || isLocked">
            <LoadingLabel :is-loading="loading.submit" loading-text="가입 중..." text="가입하기" />
          </button>
        </form>

        <div class="form-footer">이미 계정이 있으신가요?<RouterLink to="/login">로그인</RouterLink></div>
      </section>
    </div>
  </main>
</template>
