<!-- 비밀번호 찾기 (FindPasswordView_screen.md, 시안 docs/mockups/find_password_view.html, D-020, D-115, D-116, D-117) -->
<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthBrandPanel from '../components/AuthBrandPanel.vue';
import EmailVerifyField from '../components/EmailVerifyField.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useToastStore } from '../stores/toast.js';
import { isPassword } from '../utils/validation.js';

const PASSWORD_MESSAGE = '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.';
const CONFIRM_MESSAGE = '비밀번호가 일치하지 않습니다.';

const router = useRouter();
const toastStore = useToastStore();
const loginId = ref('');
const loginIdError = ref('');
const email = ref('');
const verificationId = ref(null);
const form = reactive({ password: '', confirm: '' });
const errors = reactive({ password: '', confirm: '' });
const isPasswordVisible = ref(false);
const isSaving = ref(false);
const isDone = ref(false);
const verifyField = ref(null);
const passwordInput = ref(null);

// 아이디 찾기에서 넘어오면 아이디·이메일을 채운다 (화면 이동 상태)
onMounted(() => {
  const state = router.options.history.state ?? {};
  if (typeof state.loginId === 'string') {
    loginId.value = state.loginId;
  }
  if (typeof state.email === 'string') {
    email.value = state.email;
  }
});

function checkLoginId() {
  loginId.value = loginId.value.trim();
  loginIdError.value = loginId.value ? '' : '아이디를 입력해 주세요.';
  return !loginIdError.value;
}

function onLoginIdInput() {
  loginIdError.value = '';
  // 발송 뒤 아이디를 고치면 처음부터 다시 발송한다
  if (verifyField.value?.verificationId() && !verifyField.value?.isVerified()) {
    verifyField.value.reset();
  }
}

async function onVerified(id) {
  verificationId.value = id;
  await nextTick();
  passwordInput.value?.focus();
}

function resetVerification() {
  verificationId.value = null;
  form.password = '';
  form.confirm = '';
  errors.password = '';
  errors.confirm = '';
}

function checkPasswordField(name) {
  errors[name] = '';
  const value = form[name];
  if (!value) {
    return;
  }
  if (name === 'password' && !isPassword(value)) {
    errors.password = PASSWORD_MESSAGE;
  } else if (name === 'confirm' && value !== form.password) {
    errors.confirm = CONFIRM_MESSAGE;
  }
}

async function submit() {
  errors.password = isPassword(form.password) ? '' : PASSWORD_MESSAGE;
  errors.confirm = form.confirm && form.confirm === form.password ? '' : CONFIRM_MESSAGE;
  if (errors.password || errors.confirm) {
    await nextTick();
    document.getElementById(errors.password ? 'new-password' : 'new-check')?.focus();
    return;
  }
  isSaving.value = true;
  try {
    await apiRequest('POST', '/api/users/reset-password', {
      body: { loginId: loginId.value, email: email.value, verificationId: verificationId.value, password: form.password },
    });
    // 성공: 모든 입력칸·버튼 잠금 + 안내 + 1.5초 뒤 로그인 화면 (D-116)
    isDone.value = true;
    toastStore.show('success', '비밀번호를 바꿨습니다.', '새 비밀번호로 로그인해 주세요.');
    setTimeout(() => router.push('/login'), 1500);
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      verifyField.value?.reset();
      resetVerification();
      verifyField.value?.setEmailError('인증 시간이 지났습니다. 다시 인증해 주세요.');
    } else if (error.code === 'ACCOUNT_NOT_FOUND') {
      verifyField.value?.reset();
      resetVerification();
      toastStore.show('error', '아이디와 이메일이 일치하는 회원이 없습니다.');
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <AuthBrandPanel />
      <section class="form-panel find-form-panel">
        <h1 class="form-heading">비밀번호 찾기</h1>
        <p class="form-subheading">아이디와 가입한 이메일로 본인을 확인해요.</p>

        <div class="section-title">본인 확인</div>
        <div class="field">
          <label class="field-label" for="login-id">아이디</label>
          <div class="control" :class="{ 'is-invalid': loginIdError, 'is-locked': verificationId || isDone }">
            <span class="control-icon"><i class="bi bi-person"></i></span>
            <input id="login-id" v-model="loginId" type="text" maxlength="15" placeholder="아이디" autocomplete="username"
              :readonly="Boolean(verificationId)" :disabled="isDone" @input="onLoginIdInput" />
          </div>
          <div v-if="loginIdError" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ loginIdError }}</div>
        </div>
        <EmailVerifyField ref="verifyField" v-model="email" purpose="find_password" :extra-body="() => ({ loginId: loginId })"
          :before-send="checkLoginId" :error-messages="{ ACCOUNT_NOT_FOUND: '아이디와 이메일이 일치하는 회원이 없습니다.' }"
          :is-locked="isDone" @verified="onVerified" @reset="resetVerification" />

        <div v-if="verificationId">
          <div class="section-title is-second">새 비밀번호</div>
          <p class="change-guide">인증 후 30분 안에 변경해 주세요.</p>
          <div class="field">
            <label class="field-label" for="new-password">새 비밀번호</label>
            <div class="control" :class="{ 'is-invalid': errors.password, 'is-locked': isDone }">
              <span class="control-icon"><i class="bi bi-lock"></i></span>
              <input id="new-password" ref="passwordInput" v-model="form.password" :type="isPasswordVisible ? 'text' : 'password'" maxlength="15"
                placeholder="영어, 숫자, 특수문자를 모두 포함 8~15자" autocomplete="new-password" :disabled="isDone" @blur="checkPasswordField('password')" />
              <span class="control-suffix">
                <button type="button" class="icon-button" :aria-label="isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'" :disabled="isDone"
                  @click="isPasswordVisible = !isPasswordVisible"><i class="bi" :class="isPasswordVisible ? 'bi-eye-slash' : 'bi-eye'"></i></button>
              </span>
            </div>
            <div v-if="errors.password" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.password }}</div>
          </div>
          <div class="field">
            <label class="field-label" for="new-check">새 비밀번호 확인</label>
            <div class="control" :class="{ 'is-invalid': errors.confirm, 'is-locked': isDone }">
              <span class="control-icon"><i class="bi bi-shield-lock"></i></span>
              <input id="new-check" v-model="form.confirm" type="password" maxlength="15" placeholder="새 비밀번호를 한 번 더 입력" autocomplete="new-password"
                :disabled="isDone" @blur="checkPasswordField('confirm')" />
            </div>
            <div v-if="errors.confirm" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.confirm }}</div>
          </div>
          <button type="button" class="btn-submit" :disabled="isSaving || isDone" @click="submit">
            <LoadingLabel :is-loading="isSaving" loading-text="변경 중..." text="비밀번호 변경" />
          </button>
        </div>

        <div class="form-footer"><RouterLink to="/login">로그인으로 돌아가기</RouterLink></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* FindPasswordView_screen.md 7. 디자인 값 */
.find-form-panel { display: flex; flex-direction: column; justify-content: center; }
.section-title { margin-top: 0; }
.section-title.is-second { margin-top: 26px; }
.change-guide { font-size: 13px; color: var(--color-sub); margin: -6px 0 14px; }
</style>
