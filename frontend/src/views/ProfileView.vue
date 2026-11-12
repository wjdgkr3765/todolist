<!-- 회원정보 수정·탈퇴 (ProfileView_screen.md, 시안 docs/mockups/profile_view.html, D-021, D-129~D-131) -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import EmailVerifyField from '../components/EmailVerifyField.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import { useTeamsStore } from '../stores/teams.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useToastStore } from '../stores/toast.js';
import { disconnectRealtime } from '../realtime/socket.js';
import { isNickname, isPassword, isPhone } from '../utils/validation.js';

const router = useRouter();
const auth = useAuthStore();
const toastStore = useToastStore();

const me = ref(null);
const isLoading = ref(true);
const nickname = ref('');
const nicknameError = ref('');
const isNicknameSaving = ref(false);
const email = ref('');
const emailVerificationId = ref(null);
const isEmailSaving = ref(false);
const verifyField = ref(null);
const phone = ref('');
const phoneError = ref('');
const isPhoneSaving = ref(false);
const passwords = reactive({ current: '', next: '', check: '' });
const passwordErrors = reactive({ current: '', next: '', check: '' });
const visible = reactive({ current: false, next: false });
const isPasswordSaving = ref(false);
// 탈퇴 창: null / { step: 'blocked', teams } / { step: 'confirm', soloTeams } / { step: 'final', soloTeams }
const withdrawal = ref(null);
const withdrawPassword = ref('');
const withdrawError = ref('');
const isWithdrawing = ref(false);
const isWithdrawChecking = ref(false);

const isNicknameChanged = computed(() => me.value && nickname.value !== me.value.nickname);
const isPhoneChanged = computed(() => me.value && phone.value !== me.value.phone);

const pad = (value) => String(value).padStart(2, '0');
function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function applyMe(data) {
  me.value = data;
  nickname.value = data.nickname;
  phone.value = data.phone;
  email.value = data.email;
  // 좌측 하단 닉네임·이메일도 바꾼다
  if (auth.user) {
    auth.user = { ...auth.user, nickname: data.nickname, email: data.email };
  }
}

// 비밀번호 확인이 잠겼을 때 문구 (서버 문구의 남은 분을 쓴다)
function showLocked(error) {
  const minutes = /(\d+)분/.exec(error.message)?.[1] ?? '10';
  toastStore.show('error', `비밀번호를 여러 번 틀려 ${minutes}분 동안 확인할 수 없습니다.`);
}

async function saveNickname() {
  nicknameError.value = isNickname(nickname.value) ? '' : '한글, 영어, 숫자 1~8자로 입력해 주세요.';
  if (nicknameError.value) {
    return;
  }
  isNicknameSaving.value = true;
  try {
    applyMe(await apiRequest('POST', '/api/users/me/nickname', { body: { nickname: nickname.value } }));
    toastStore.show('success', '닉네임을 바꿨습니다.');
  } catch (error) {
    if (error.code === 'INVALID_INPUT') {
      nicknameError.value = '한글, 영어, 숫자 1~8자로 입력해 주세요.';
    }
  } finally {
    isNicknameSaving.value = false;
  }
}

async function saveEmail() {
  isEmailSaving.value = true;
  try {
    applyMe(await apiRequest('POST', '/api/users/me/email', { body: { email: email.value, verificationId: emailVerificationId.value } }));
    emailVerificationId.value = null;
    verifyField.value?.reset();
    toastStore.show('success', '이메일을 바꿨습니다.');
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED' || error.code === 'EMAIL_DUPLICATED') {
      emailVerificationId.value = null;
      verifyField.value?.reset();
      verifyField.value?.setEmailError(error.code === 'EMAIL_DUPLICATED' ? '이미 가입된 이메일입니다.' : '인증 시간이 지났습니다. 다시 인증해 주세요.');
    }
  } finally {
    isEmailSaving.value = false;
  }
}

function onPhoneInput() {
  phone.value = phone.value.replace(/\D/g, '');
  phoneError.value = '';
}
async function savePhone() {
  phoneError.value = isPhone(phone.value) ? '' : '숫자만 11자리로 입력해 주세요.';
  if (phoneError.value) {
    return;
  }
  isPhoneSaving.value = true;
  try {
    applyMe(await apiRequest('POST', '/api/users/me/phone', { body: { phone: phone.value } }));
    toastStore.show('success', '전화번호를 바꿨습니다.');
  } catch (error) {
    if (error.code === 'PHONE_DUPLICATED') {
      phoneError.value = '이미 가입된 전화번호입니다.';
    }
  } finally {
    isPhoneSaving.value = false;
  }
}

function checkPasswordField(name) {
  passwordErrors[name] = '';
  if (name === 'next' && passwords.next && !isPassword(passwords.next)) {
    passwordErrors.next = '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.';
  } else if (name === 'check' && passwords.check && passwords.check !== passwords.next) {
    passwordErrors.check = '비밀번호가 일치하지 않습니다.';
  }
}

async function savePassword() {
  passwordErrors.current = passwords.current ? '' : '현재 비밀번호를 입력해 주세요.';
  passwordErrors.next = isPassword(passwords.next) ? '' : '영어, 숫자, 특수문자를 모두 포함해 8~15자로 입력해 주세요.';
  passwordErrors.check = passwords.check && passwords.check === passwords.next ? '' : '비밀번호가 일치하지 않습니다.';
  const first = ['current', 'next', 'check'].find((name) => passwordErrors[name]);
  if (first) {
    document.getElementById({ current: 'current-password', next: 'new-password', check: 'new-password-check' }[first])?.focus();
    return;
  }
  isPasswordSaving.value = true;
  try {
    await apiRequest('POST', '/api/users/me/password', { body: { currentPassword: passwords.current, newPassword: passwords.next } });
    Object.assign(passwords, { current: '', next: '', check: '' });
    toastStore.show('success', '비밀번호를 바꿨습니다.');
  } catch (error) {
    if (error.code === 'CURRENT_PASSWORD_MISMATCH') {
      passwordErrors.current = '현재 비밀번호가 맞지 않습니다.';
    } else if (error.code === 'LOGIN_LOCKED') {
      showLocked(error);
    }
  } finally {
    isPasswordSaving.value = false;
  }
}

// ---------- 회원 탈퇴 ----------
async function openWithdrawal() {
  isWithdrawChecking.value = true;
  try {
    const data = await apiRequest('GET', '/api/users/me/withdrawal-check');
    withdrawPassword.value = '';
    withdrawError.value = '';
    withdrawal.value = data.blockingTeams.length > 0
      ? { step: 'blocked', teams: data.blockingTeams }
      : { step: 'confirm', soloTeams: data.soloTeams };
  } catch {
    // 오류 토스트는 API 공통 처리
  } finally {
    isWithdrawChecking.value = false;
  }
}

function closeWithdrawal() {
  withdrawal.value = null;
  withdrawPassword.value = '';
}

async function goTeam(team) {
  closeWithdrawal();
  await router.push(`/teams/${team.teamId}/info`);
}

async function runWithdraw() {
  isWithdrawing.value = true;
  try {
    await apiRequest('POST', '/api/users/me/withdraw', { body: { password: withdrawPassword.value } });
    withdrawal.value = null;
    disconnectRealtime();
    auth.clear();
    useTeamsStore().clear();
    useNotificationsStore().clear();
    await router.push('/login');
    toastStore.show('success', '탈퇴가 완료되었습니다.');
  } catch (error) {
    if (error.code === 'CURRENT_PASSWORD_MISMATCH') {
      withdrawal.value = { ...withdrawal.value, step: 'confirm' };
      withdrawError.value = '현재 비밀번호가 맞지 않습니다.';
    } else if (error.code === 'TEAM_OWNER_CANNOT_WITHDRAW') {
      withdrawal.value = { step: 'blocked', teams: error.teams ?? [] };
    } else if (error.code === 'LOGIN_LOCKED') {
      closeWithdrawal();
      showLocked(error);
    }
  } finally {
    isWithdrawing.value = false;
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    closeWithdrawal();
  }
}
onMounted(async () => {
  document.addEventListener('keydown', onKeydown);
  try {
    applyMe(await apiRequest('GET', '/api/users/me'));
  } catch {
    // 401 은 로그인 만료 처리, 그 밖은 오류 토스트
  } finally {
    isLoading.value = false;
  }
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="profile-page">
    <h1 class="page-title">회원정보 수정</h1>
    <div v-if="isLoading" class="card-x loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
    <template v-else-if="me">
      <section class="card-x">
        <h2 class="card-title-x">내 정보</h2>
        <div class="read-row">
          <div><div class="read-label">아이디</div><div class="read-value">{{ me.loginId }}</div><div class="read-note">아이디는 바꿀 수 없습니다.</div></div>
          <div><div class="read-label">가입일</div><div class="read-value">{{ formatDate(me.createDate) }}</div></div>
        </div>
        <div class="field">
          <label class="field-label" for="nickname-input">닉네임</label>
          <div class="field-row">
            <div class="control" :class="{ 'is-invalid': nicknameError }"><span class="control-icon"><i class="bi bi-emoji-smile"></i></span>
              <input id="nickname-input" v-model="nickname" type="text" maxlength="8" @input="nicknameError = ''" @keydown.enter.prevent="saveNickname" />
            </div>
            <button type="button" class="btn-side" :disabled="!isNicknameChanged || isNicknameSaving" @click="saveNickname">
              <LoadingLabel :is-loading="isNicknameSaving" loading-text="저장 중..." text="저장" />
            </button>
          </div>
          <div v-if="nicknameError" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ nicknameError }}</div>
          <div class="hint">이미 남은 수정 내역에는 예전 닉네임이 그대로 보입니다.</div>
        </div>
        <EmailVerifyField ref="verifyField" v-model="email" purpose="change_email" input-id="email-input" :is-code-inline="true"
          :is-send-disabled="email.trim() === me.email" :error-messages="{ EMAIL_DUPLICATED: '이미 가입된 이메일입니다.' }"
          @verified="emailVerificationId = $event" @reset="emailVerificationId = null">
          <template #after>
            <button v-if="emailVerificationId" type="button" class="btn-x btn-primary-x btn-email-change" :disabled="isEmailSaving" @click="saveEmail">
              <LoadingLabel :is-loading="isEmailSaving" loading-text="변경 중..." text="이메일 변경" />
            </button>
          </template>
        </EmailVerifyField>
        <div class="field" style="margin-bottom: 0">
          <label class="field-label" for="phone-input">전화번호</label>
          <div class="field-row">
            <div class="control" :class="{ 'is-invalid': phoneError }"><span class="control-icon"><i class="bi bi-phone"></i></span>
              <input id="phone-input" v-model="phone" type="tel" inputmode="numeric" maxlength="11" @input="onPhoneInput" @keydown.enter.prevent="savePhone" />
            </div>
            <button type="button" class="btn-side" :disabled="!isPhoneChanged || isPhoneSaving" @click="savePhone">
              <LoadingLabel :is-loading="isPhoneSaving" loading-text="저장 중..." text="저장" />
            </button>
          </div>
          <div v-if="phoneError" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ phoneError }}</div>
        </div>
      </section>

      <section class="card-x">
        <h2 class="card-title-x">비밀번호 변경</h2>
        <div class="field">
          <label class="field-label" for="current-password">현재 비밀번호</label>
          <div class="control" :class="{ 'is-invalid': passwordErrors.current }"><span class="control-icon"><i class="bi bi-lock"></i></span>
            <input id="current-password" v-model="passwords.current" :type="visible.current ? 'text' : 'password'" maxlength="15" placeholder="현재 비밀번호"
              autocomplete="current-password" @input="passwordErrors.current = ''" />
            <span class="control-suffix"><button type="button" class="icon-button" :aria-label="visible.current ? '비밀번호 숨기기' : '비밀번호 보기'"
              @click="visible.current = !visible.current"><i class="bi" :class="visible.current ? 'bi-eye-slash' : 'bi-eye'"></i></button></span>
          </div>
          <div v-if="passwordErrors.current" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ passwordErrors.current }}</div>
        </div>
        <div class="field">
          <label class="field-label" for="new-password">새 비밀번호</label>
          <div class="control" :class="{ 'is-invalid': passwordErrors.next }"><span class="control-icon"><i class="bi bi-lock"></i></span>
            <input id="new-password" v-model="passwords.next" :type="visible.next ? 'text' : 'password'" maxlength="15" placeholder="영어, 숫자, 특수문자를 모두 포함 8~15자"
              autocomplete="new-password" @blur="checkPasswordField('next')" />
            <span class="control-suffix"><button type="button" class="icon-button" :aria-label="visible.next ? '비밀번호 숨기기' : '비밀번호 보기'"
              @click="visible.next = !visible.next"><i class="bi" :class="visible.next ? 'bi-eye-slash' : 'bi-eye'"></i></button></span>
          </div>
          <div v-if="passwordErrors.next" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ passwordErrors.next }}</div>
        </div>
        <div class="field">
          <label class="field-label" for="new-password-check">새 비밀번호 확인</label>
          <div class="control" :class="{ 'is-invalid': passwordErrors.check }"><span class="control-icon"><i class="bi bi-shield-lock"></i></span>
            <input id="new-password-check" v-model="passwords.check" type="password" maxlength="15" placeholder="새 비밀번호를 한 번 더 입력"
              autocomplete="new-password" @blur="checkPasswordField('check')" />
          </div>
          <div v-if="passwordErrors.check" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ passwordErrors.check }}</div>
        </div>
        <button type="button" class="btn-x btn-primary-x btn-lg-x btn-block-x" :disabled="isPasswordSaving" @click="savePassword">
          <LoadingLabel :is-loading="isPasswordSaving" loading-text="변경 중..." text="비밀번호 변경" />
        </button>
      </section>

      <section class="card-x">
        <h2 class="card-title-x">회원 탈퇴</h2>
        <p class="withdraw-text">탈퇴하면 회원 정보와 개인 공간의 할일·작업이 모두 지워지고 되돌릴 수 없습니다. 팀 작업과 수정 내역은 팀에 남습니다.</p>
        <button type="button" class="btn-x btn-outline-danger-x btn-lg-x btn-block-x" :disabled="isWithdrawChecking" @click="openWithdrawal">
          <i class="bi bi-box-arrow-right"></i>회원 탈퇴
        </button>
      </section>
    </template>

    <div v-if="withdrawal?.step === 'blocked'" class="modal-backdrop-x" @click.self="closeWithdrawal">
      <div class="modal-x is-withdraw" role="dialog" aria-label="탈퇴할 수 없습니다">
        <div class="modal-title-x">탈퇴할 수 없습니다</div>
        <div class="modal-text">관리자인 팀이 있습니다. 먼저 관리자를 넘겨 주세요.</div>
        <ul class="team-list-x">
          <li v-for="team in withdrawal.teams" :key="team.teamId"><i class="bi bi-people"></i><a href="#" @click.prevent="goTeam(team)">{{ team.name }}</a></li>
        </ul>
        <div class="modal-actions"><button type="button" class="btn-x btn-outline-x" @click="closeWithdrawal">닫기</button></div>
      </div>
    </div>
    <div v-if="withdrawal?.step === 'confirm'" class="modal-backdrop-x" @click.self="closeWithdrawal">
      <div class="modal-x is-withdraw" role="dialog" aria-label="회원 탈퇴">
        <div class="modal-title-x">회원 탈퇴</div>
        <div class="modal-text">탈퇴하면 회원 정보와 개인 공간의 할일·작업이 모두 지워지고 되돌릴 수 없습니다. 팀 작업과 수정 내역은 팀에 남습니다.</div>
        <template v-if="withdrawal.soloTeams.length > 0">
          <div class="modal-sub">아래 팀은 나 혼자라 함께 해체됩니다.</div>
          <ul class="team-list-x"><li v-for="team in withdrawal.soloTeams" :key="team.teamId"><i class="bi bi-people"></i>{{ team.name }}</li></ul>
        </template>
        <div class="field" style="margin: 16px 0 0">
          <label class="field-label" for="withdraw-password">현재 비밀번호</label>
          <div class="control" :class="{ 'is-invalid': withdrawError }"><span class="control-icon"><i class="bi bi-lock"></i></span>
            <input id="withdraw-password" v-model="withdrawPassword" type="password" maxlength="15" placeholder="현재 비밀번호" @input="withdrawError = ''" />
          </div>
          <div v-if="withdrawError" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ withdrawError }}</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-x btn-outline-x" @click="closeWithdrawal">취소</button>
          <button type="button" class="btn-x btn-danger-x" :disabled="!withdrawPassword" @click="withdrawal = { ...withdrawal, step: 'final' }">다음</button>
        </div>
      </div>
    </div>
    <ConfirmDialog v-if="withdrawal?.step === 'final'" title="회원 탈퇴" text="정말 탈퇴할까요? 되돌릴 수 없습니다." confirm-text="탈퇴" loading-text="탈퇴 중..."
      :is-loading="isWithdrawing" @confirm="runWithdraw" @cancel="closeWithdrawal" />
  </div>
</template>

<style scoped>
/* ProfileView_screen.md 7. 디자인 값 (시안 profile_view.html 과 같은 값) */
.profile-page { max-width: 640px; }
.read-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.read-label { font-size: 13px; font-weight: 600; color: var(--color-sub); margin-bottom: 4px; }
.read-value { font-size: 15px; }
.read-note { font-size: 12px; color: var(--color-muted); margin-top: 2px; }
.hint { font-size: 12px; color: var(--color-muted); margin-top: 6px; }
.withdraw-text { font-size: 14px; color: var(--color-sub); line-height: 1.6; margin-bottom: 16px; }
.team-list-x { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 6px; }
.team-list-x li { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.team-list-x a { color: var(--color-primary-dark); }
.modal-x.is-withdraw { width: 440px; }
.btn-email-change { margin-top: 10px; height: 44px; }
@media (max-width: 575.98px) {
  .card-x { padding: 16px; }
}
</style>
