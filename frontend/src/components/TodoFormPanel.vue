<!-- 할일 입력 UI (TaskView_screen.md 할일 입력 UI). 추가·수정 -->
<script setup>
import { reactive, ref, watch } from 'vue';
import PeriodFields from './PeriodFields.vue';
import LoadingLabel from './LoadingLabel.vue';
import { toPeriodForm, validatePeriodForm } from '../utils/period.js';

const props = defineProps({
  todo: { type: Object, default: null },
  isSaving: { type: Boolean, default: false },
  isChangedByOther: { type: Boolean, default: false },
});
const emit = defineEmits(['save', 'close']);

const form = reactive(toPeriodForm(props.todo));
const errors = reactive({});
const fields = ref(null);

watch(() => props.todo?.todoId, () => {
  Object.assign(form, toPeriodForm(props.todo));
  Object.keys(errors).forEach((key) => delete errors[key]);
});

function save() {
  Object.keys(errors).forEach((key) => delete errors[key]);
  Object.assign(errors, validatePeriodForm(form));
  if (Object.keys(errors).length > 0) {
    fields.value?.focusFirstError();
    return;
  }
  emit('save', form);
}
</script>

<template>
  <aside class="panel side-panel">
    <div v-if="isChangedByOther" class="warn-strip"><i class="bi bi-exclamation-circle"></i>다른 팀원이 이 할일을 바꿨습니다.</div>
    <div class="side-head">
      <h2 class="panel-title">{{ todo ? '할일 수정' : '할일 추가' }}</h2>
      <button type="button" class="icon-button" aria-label="닫기" @click="emit('close')"><i class="bi bi-x-lg"></i></button>
    </div>
    <PeriodFields ref="fields" :form="form" :errors="errors" id-prefix="todo" :is-todo-form="true" />
    <div class="form-buttons">
      <button type="button" class="btn-x btn-outline-x" @click="emit('close')">취소</button>
      <button type="button" class="btn-submit" :disabled="isSaving" @click="save">
        <LoadingLabel :is-loading="isSaving" loading-text="저장 중..." text="저장" />
      </button>
    </div>
  </aside>
</template>
