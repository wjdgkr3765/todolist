<!-- 아이디 찾기 (FindIdView_screen.md, 시안 docs/mockups/find_id_view.html, D-020, D-114, D-117) -->
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthBrandPanel from '../components/AuthBrandPanel.vue';
import EmailVerifyField from '../components/EmailVerifyField.vue';
import { apiRequest } from '../api/client.js';

const router = useRouter();
const email = ref('');
const result = ref(null);
const verifyField = ref(null);

const pad = (value) => String(value).padStart(2, '0');
function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

// 인증을 마치면 바로 아이디를 조회해 결과로 바꾼다
async function onVerified(verificationId) {
  try {
    result.value = await apiRequest('POST', '/api/users/find-id', { body: { email: email.value, verificationId } });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      verifyField.value?.reset();
      verifyField.value?.setEmailError('인증 시간이 지났습니다. 다시 인증해 주세요.');
    } else if (error.code === 'EMAIL_NOT_REGISTERED') {
      verifyField.value?.reset();
      verifyField.value?.setEmailError('가입되지 않은 이메일입니다.');
    }
  }
}

// 찾은 아이디는 쿼리가 아니라 화면 이동 상태로 넘긴다
function goLogin() {
  router.push({ path: '/login', state: { loginId: result.value.loginId } });
}
function goFindPassword() {
  router.push({ path: '/find-password', state: { loginId: result.value.loginId, email: email.value } });
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-shell">
      <AuthBrandPanel />
      <section class="form-panel find-form-panel">
        <h1 class="form-heading">아이디 찾기</h1>
        <p class="form-subheading">가입할 때 쓴 이메일로 인증번호를 보내 드려요.</p>

        <div v-if="!result">
          <EmailVerifyField ref="verifyField" v-model="email" purpose="find_id" :can-change="false"
            :error-messages="{ EMAIL_NOT_REGISTERED: '가입되지 않은 이메일입니다.' }" @verified="onVerified" />
        </div>
        <div v-else>
          <div class="result-card">
            <span class="result-icon"><i class="bi bi-person-check"></i></span>
            <div class="result-text">회원님의 아이디입니다.</div>
            <div class="result-id">{{ result.loginId }}</div>
            <div class="result-date">가입일 {{ formatDate(result.createDate) }}</div>
          </div>
          <div class="result-buttons">
            <button type="button" class="btn-submit" @click="goLogin">로그인하기</button>
            <button type="button" class="btn-x btn-soft-x btn-lg-x btn-block-x" @click="goFindPassword">비밀번호 찾기</button>
          </div>
        </div>

        <div class="form-footer"><RouterLink to="/login">로그인으로 돌아가기</RouterLink></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* FindIdView_screen.md 7. 디자인 값 (시안 find_id_view.html 과 같은 값) */
.find-form-panel { display: flex; flex-direction: column; justify-content: center; }
.result-card { background: var(--color-input-bg); border: 1px solid var(--color-border); border-radius: 16px; padding: 28px 24px; text-align: center; }
.result-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); font-size: 26px; display: inline-grid; place-items: center; }
.result-text { font-size: 15px; color: var(--color-sub); margin-top: 12px; }
.result-id { font-size: 26px; font-weight: 800; color: var(--color-ink); margin-top: 6px; letter-spacing: 0.5px; word-break: break-all; }
.result-date { font-size: 13px; color: var(--color-muted); margin-top: 4px; }
.result-buttons { display: grid; gap: 8px; margin-top: 20px; }
.result-buttons .btn-submit { margin-top: 0; }
</style>
