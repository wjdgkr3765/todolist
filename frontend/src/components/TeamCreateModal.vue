<!-- 팀 만들기 모달 (MainLayout_screen.md, D-073) -->
<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LoadingLabel from './LoadingLabel.vue';
import { useTeamsStore } from '../stores/teams.js';

const emit = defineEmits(['close']);
const router = useRouter();
const teamsStore = useTeamsStore();
const name = ref('');
const error = ref('');
const isLoading = ref(false);
const input = ref(null);

onMounted(async () => {
  await nextTick();
  input.value?.focus();
});

async function create() {
  if (isLoading.value) {
    return;
  }
  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = '팀 이름을 입력해 주세요.';
  } else if (trimmed.length > 20) {
    error.value = '팀 이름은 20자 이하로 입력해 주세요.';
  }
  if (error.value) {
    input.value?.focus();
    return;
  }
  isLoading.value = true;
  try {
    const team = await teamsStore.createTeam(trimmed);
    emit('close');
    await router.push(`/teams/${team.teamId}/info`);
  } catch (caught) {
    if (caught.code === 'TEAM_LIMIT_EXCEEDED') {
      error.value = '가입된 팀이 20개라 더 만들 수 없습니다.';
    } else if (caught.code === 'INVALID_INPUT') {
      error.value = '팀 이름을 입력해 주세요.';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal-x" role="dialog" aria-label="팀 만들기">
      <div class="modal-title-x">팀 만들기</div>
      <div class="field" style="margin-bottom: 0">
        <label class="field-label" for="team-name-input">팀 이름</label>
        <div class="control no-icon" :class="{ 'is-invalid': error }">
          <input id="team-name-input" ref="input" v-model="name" type="text" maxlength="20" placeholder="팀 이름을 입력해 주세요"
            @input="error = ''" @keydown.enter.prevent="create" />
        </div>
        <div v-if="error" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ error }}</span></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-x btn-outline-x" @click="emit('close')">취소</button>
        <button type="button" class="btn-x btn-primary-x" :disabled="isLoading" @click="create">
          <LoadingLabel :is-loading="isLoading" loading-text="만드는 중..." text="만들기" />
        </button>
      </div>
    </div>
  </div>
</template>
