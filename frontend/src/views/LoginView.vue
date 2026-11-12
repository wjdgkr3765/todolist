<!-- 로그인 화면 (LoginView_screen.md, 시안 docs/mockups/login_view.html) -->
<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthBrandPanel from '../components/AuthBrandPanel.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { useAuthStore } from '../stores/auth.js';
import { useToastStore } from '../stores/toast.js';
import { HOME_PATH } from '../router/index.js';

const router = useRouter();
const auth = useAuthStore();
const toastStore = useToastStore();

const form = reactive({ loginId: '', password: '' });
const errors = reactive({ loginId: '', password: '' });
const errorBox = ref('');
const isLoading = ref(false);
const isPasswordVisible = ref(false);
const inputs = reactive({});

function setInputRef(name) {
  return (element) => { inputs[name] = element; };
}

async function focusField(name) {
  await nextTick();
  inputs[name]?.focus();
}

// 아이디 찾기 결과의 [로그인하기]로 넘어오면 찾은 아이디를 채운다 (화면 이동 상태로 받는다)
onMounted(() => {
  const foundLoginId = window.history.state?.loginId;
  if (typeof foundLoginId === 'string' && foundLoginId) {
    form.loginId = foundLoginId;
    focusField('password');
  }
});

function onInput(name) {
  errors[name] = '';
  errorBox.value = '';
}

async function submit() {
  if (isLoading.value) {
    return;
  }
  form.loginId = form.loginId.trim();
  errors.loginId = form.loginId ? '' : '아이디를 입력해 주세요.';
  errors.password = form.password ? '' : '비밀번호를 입력해 주세요.';
  errorBox.value = '';
  if (errors.loginId || errors.password) {
    await focusField(errors.loginId ? 'loginId' : 'password');
    return;
  }
  isLoading.value = true;
  try {
    await auth.login(form.loginId, form.password);
    await router.push(HOME_PATH);
  } catch (error) {
    await handleLoginError(error);
  } finally {
    isLoading.value = false;
  }
}

async function handleLoginError(error) {
  if (error.code === 'LOGIN_FAILED') {
    errorBox.value = '아이디 또는 비밀번호가 올바르지 않습니다.';
    form.password = '';
    await focusField('password');
  } else if (error.code === 'LOGIN_LOCKED') {
    errorBox.value = error.message;
  } else if (error.status > 0 && error.status < 500) {
    // 5xx·연결 실패 토스트는 API 공통 처리가 이미 띄운다
    toastStore.showServerError();
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <AuthBrandPanel />

      <section class="form-panel login-form-panel">
        <h1 class="form-heading">로그인</h1>
        <p class="form-subheading">아이디와 비밀번호를 입력해 주세요.</p>

        <form novalidate @submit.prevent="submit">
          <div class="field">
            <label class="field-label" for="login-id">아이디</label>
            <div class="control" :class="{ 'is-invalid': errors.loginId }">
              <span class="control-icon"><i class="bi bi-person"></i></span>
              <input id="login-id" :ref="setInputRef('loginId')" v-model="form.loginId" type="text" maxlength="15"
                placeholder="아이디" autocomplete="username" @input="onInput('loginId')" />
            </div>
            <div v-if="errors.loginId" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.loginId }}</div>
          </div>

          <div class="field">
            <label class="field-label" for="password">비밀번호</label>
            <div class="control" :class="{ 'is-invalid': errors.password }">
              <span class="control-icon"><i class="bi bi-lock"></i></span>
              <input id="password" :ref="setInputRef('password')" v-model="form.password" :type="isPasswordVisible ? 'text' : 'password'"
                maxlength="15" placeholder="비밀번호" autocomplete="current-password" @input="onInput('password')" />
              <span class="control-suffix">
                <button type="button" class="icon-button" :aria-label="isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'"
                  @click="isPasswordVisible = !isPasswordVisible">
                  <i class="bi" :class="isPasswordVisible ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </span>
            </div>
            <div v-if="errors.password" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.password }}</div>
          </div>

          <div v-if="errorBox" class="error-box" role="alert"><i class="bi bi-exclamation-circle"></i><span>{{ errorBox }}</span></div>

          <button type="submit" class="btn-submit" :disabled="isLoading">
            <LoadingLabel :is-loading="isLoading" loading-text="로그인 중..." text="로그인" />
          </button>
        </form>

        <div class="find-links">
          <RouterLink to="/find-id">아이디 찾기</RouterLink><span class="dot">·</span><RouterLink to="/find-password">비밀번호 찾기</RouterLink>
        </div>
        <div class="form-footer">아직 계정이 없으신가요?<RouterLink to="/signup">회원가입</RouterLink></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* LoginView_screen.md 7. 디자인 값 */
.login-form-panel { display: flex; flex-direction: column; justify-content: center; }
.error-box {
  display: flex; align-items: flex-start; gap: 8px; background: var(--color-danger-soft); color: var(--color-danger);
  border-radius: var(--radius-control); padding: 12px 14px; font-size: 14px; margin-bottom: 4px;
}
.error-box i { font-size: 16px; line-height: 1.3; }
.find-links { text-align: center; font-size: 14px; color: var(--color-sub); margin-top: 16px; }
.find-links a { color: var(--color-sub); text-decoration: none; }
.find-links a:hover { color: var(--color-ink); text-decoration: underline; }
.find-links .dot { margin: 0 8px; color: var(--color-muted); }
</style>
