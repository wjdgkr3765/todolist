<!-- 이메일 인증번호 발송·확인 (아이디·비밀번호 찾기, 회원정보 수정의 이메일 변경). 규칙은 회원가입과 같다 (D-035, D-039, D-164) -->
<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import LoadingLabel from './LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useToastStore } from '../stores/toast.js';
import { formatSeconds, isEmail, isVerificationCode } from '../utils/validation.js';

const props = defineProps({
  modelValue: { type: String, required: true },
  purpose: { type: String, required: true },
  // 발송 요청에 더 넣을 값 (비밀번호 찾기: loginId)
  extraBody: { type: Function, default: () => ({}) },
  // 발송 전에 부모가 확인할 것 (false 를 돌려주면 발송하지 않는다)
  beforeSend: { type: Function, default: () => true },
  // 발송 오류 코드 → 이메일 칸 아래 문구
  errorMessages: { type: Object, default: () => ({}) },
  verifiedText: { type: String, default: '인증되었습니다.' },
  // 인증을 마친 뒤 [변경] 버튼을 보일지
  canChange: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
  label: { type: String, default: '이메일' },
  inputId: { type: String, default: 'email' },
  // 회원정보 수정: 인증번호 줄을 이메일 바로 아래(라벨 없이)에 둔다
  isCodeInline: { type: Boolean, default: false },
  // 회원정보 수정: 지금 이메일과 같으면 발송 버튼을 잠근다
  isSendDisabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'verified', 'reset']);
defineExpose({ reset, focusEmail, setEmailError, isVerified: () => state.isVerified, verificationId: () => state.id });

const toastStore = useToastStore();
const state = reactive({ id: null, isCodeSent: false, isVerified: false, expireAt: 0, resendAt: 0 });
const code = ref('');
const emailError = ref('');
const codeError = ref('');
const isSending = ref(false);
const isVerifying = ref(false);
const emailInput = ref(null);
const codeInput = ref(null);
const now = ref(Date.now());
let clock = null;

const remaining = computed(() => Math.max(0, Math.floor((state.expireAt - now.value) / 1000)));
const resendLeft = computed(() => Math.max(0, Math.ceil((state.resendAt - now.value) / 1000)));

function stopClock() {
  clearInterval(clock);
  clock = null;
}
onBeforeUnmount(stopClock);

function reset() {
  stopClock();
  Object.assign(state, { id: null, isCodeSent: false, isVerified: false, expireAt: 0, resendAt: 0 });
  code.value = '';
  codeError.value = '';
  emailError.value = '';
}
async function focusEmail() {
  await nextTick();
  emailInput.value?.focus();
}
function setEmailError(message) {
  emailError.value = message;
}

function onEmailInput(event) {
  emit('update:modelValue', event.target.value);
  emailError.value = '';
  // 발송 뒤 이메일을 고치면 처음부터 다시 발송한다
  if (state.isCodeSent && !state.isVerified) {
    reset();
    emit('reset');
  }
}

async function send() {
  const email = props.modelValue.trim();
  emit('update:modelValue', email);
  emailError.value = '';
  const isEmailOk = isEmail(email);
  if (!props.beforeSend() || !isEmailOk) {
    if (!isEmailOk) {
      emailError.value = '이메일 형식이 올바르지 않습니다.';
    }
    return;
  }
  isSending.value = true;
  try {
    const data = await apiRequest('POST', '/api/email-verifications', { body: { email, purpose: props.purpose, ...props.extraBody() } });
    const sentAt = Date.now();
    const issuedMs = Date.parse(data.resendAvailableDate) - 60 * 1000;
    Object.assign(state, {
      id: data.verificationId, isCodeSent: true, isVerified: false,
      expireAt: sentAt + (Date.parse(data.expireDate) - issuedMs), resendAt: sentAt + 60 * 1000,
    });
    code.value = '';
    codeError.value = '';
    stopClock();
    now.value = Date.now();
    clock = setInterval(() => { now.value = Date.now(); }, 1000);
    await nextTick();
    codeInput.value?.focus();
  } catch (error) {
    if (error.code === 'MAIL_SEND_FAILED') {
      toastStore.show('error', '메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } else if (props.errorMessages[error.code]) {
      emailError.value = props.errorMessages[error.code];
    } else if (error.code === 'INVALID_INPUT') {
      emailError.value = '이메일 형식이 올바르지 않습니다.';
    } else if (error.code === 'VERIFICATION_RESEND_TOO_SOON') {
      emailError.value = error.message;
    }
  } finally {
    isSending.value = false;
  }
}

async function verify() {
  if (!isVerificationCode(code.value) || isVerifying.value) {
    return;
  }
  codeError.value = '';
  isVerifying.value = true;
  try {
    await apiRequest('POST', `/api/email-verifications/${state.id}/verify`, { body: { code: code.value } });
    stopClock();
    state.isVerified = true;
    emit('verified', state.id);
  } catch (error) {
    if (['VERIFICATION_CODE_MISMATCH', 'VERIFICATION_EXPIRED', 'VERIFICATION_LOCKED'].includes(error.code)) {
      codeError.value = error.message;
    } else if (error.code === 'NOT_FOUND') {
      codeError.value = '인증번호가 무효가 되었습니다. 다시 발송해 주세요.';
    }
    if (['VERIFICATION_EXPIRED', 'VERIFICATION_LOCKED', 'NOT_FOUND'].includes(error.code)) {
      state.expireAt = Date.now();
    }
  } finally {
    isVerifying.value = false;
  }
}

// [변경]: 인증 취소, 이메일 다시 입력 (D-039)
async function change() {
  reset();
  emit('reset');
  await focusEmail();
}
</script>

<template>
  <div class="field">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <div class="field-row">
      <div class="control" :class="{ 'is-invalid': emailError, 'is-locked': state.isVerified || isLocked }">
        <span class="control-icon"><i class="bi bi-envelope"></i></span>
        <input :id="inputId" ref="emailInput" :value="modelValue" type="email" maxlength="100" placeholder="example@email.com" autocomplete="email"
          :readonly="state.isVerified" :disabled="isLocked" @input="onEmailInput" />
        <span v-if="state.isVerified" class="control-suffix"><span class="verified-pill"><i class="bi bi-check-circle-fill"></i>인증</span></span>
      </div>
      <button tabindex="-1" v-if="state.isVerified && canChange" type="button" class="btn-side" :disabled="isLocked" @click="change">변경</button>
      <button tabindex="-1" v-else-if="!state.isVerified" type="button" class="btn-side" :disabled="isSending || isLocked || isSendDisabled || (state.isCodeSent && resendLeft > 0)" @click="send">
        <LoadingLabel :is-loading="isSending" loading-text="발송 중"
          :text="!state.isCodeSent ? '인증번호 발송' : (resendLeft > 0 ? `재발송 ${formatSeconds(resendLeft)}` : '재발송')" />
      </button>
    </div>
    <div v-if="emailError" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ emailError }}</span></div>
    <div v-else-if="state.isVerified" class="message is-success"><i class="bi bi-check-circle"></i><span>{{ verifiedText }}</span></div>
    <div v-else-if="state.isCodeSent && !codeError" class="message is-info"><i class="bi bi-info-circle"></i><span>인증번호를 보냈습니다. 메일을 확인해 주세요.</span></div>
    <template v-if="isCodeInline && state.isCodeSent && !state.isVerified">
    <div class="field-row" style="margin-top: 10px">
      <div class="control" :class="{ 'is-invalid': codeError }">
        <span class="control-icon"><i class="bi bi-key"></i></span>
        <input :id="`${inputId}-code`" ref="codeInput" v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="인증번호 6자리"
          autocomplete="one-time-code" :disabled="isLocked" @input="code = code.replace(/\D/g, '')" @keydown.enter.prevent="verify" />
        <span class="control-suffix"><span class="timer-pill">{{ formatSeconds(remaining) }}</span></span>
      </div>
      <button tabindex="-1" type="button" class="btn-side" :disabled="!isVerificationCode(code) || isVerifying || isLocked" @click="verify">
        <LoadingLabel :is-loading="isVerifying" loading-text="확인 중" text="확인" />
      </button>
    </div>
    <div v-if="codeError" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ codeError }}</span></div>
    </template>
    <slot name="after"></slot>
  </div>
  <div v-if="!isCodeInline && state.isCodeSent && !state.isVerified" class="field">
    <label class="field-label" :for="`${inputId}-code`">인증번호</label>
    <div class="field-row">
      <div class="control" :class="{ 'is-invalid': codeError }">
        <span class="control-icon"><i class="bi bi-key"></i></span>
        <input :id="`${inputId}-code`" ref="codeInput" v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="인증번호 6자리"
          autocomplete="one-time-code" :disabled="isLocked" @input="code = code.replace(/\D/g, '')" @keydown.enter.prevent="verify" />
        <span class="control-suffix"><span class="timer-pill">{{ formatSeconds(remaining) }}</span></span>
      </div>
      <button tabindex="-1" type="button" class="btn-side" :disabled="!isVerificationCode(code) || isVerifying || isLocked" @click="verify">
        <LoadingLabel :is-loading="isVerifying" loading-text="확인 중" text="확인" />
      </button>
    </div>
    <div v-if="codeError" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ codeError }}</span></div>
  </div>
</template>
