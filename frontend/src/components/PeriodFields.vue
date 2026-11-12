<!-- 제목·내용·기간 입력칸 (할일 입력 UI 와 작업 수정이 같이 쓴다, TaskView_screen.md) -->
<script setup>
const props = defineProps({
  form: { type: Object, required: true },
  errors: { type: Object, required: true },
  idPrefix: { type: String, required: true },
  // 할일 입력 UI: 제목 → 내용 → 기간 (placeholder 있음) / 작업 수정: 제목 → 기간 → 작업자 → 내용 (시안과 같음)
  isTodoForm: { type: Boolean, default: false },
});
defineExpose({ focusFirstError });

const id = (name) => `${props.idPrefix}-${name}`;

function onUndecided() {
  if (props.form.isPeriodUndecided) {
    Object.assign(props.form, { startDate: '', endDate: '', hasTime: false, startTime: '', endTime: '' });
  }
  delete props.errors.period;
}

// 시간 지정을 켜면 09:00 / 18:00 으로 채우고, 끄면 값을 버린다 (D-135)
function onHasTime() {
  Object.assign(props.form, props.form.hasTime ? { startTime: '09:00', endTime: '18:00' } : { startTime: '', endTime: '' });
  delete props.errors.period;
}

function focusFirstError() {
  // 화면에 보이는 순서대로 첫 오류 칸
  const order = props.isTodoForm
    ? [['title', 'title'], ['content', 'content'], ['period', 'start']]
    : [['title', 'title'], ['period', 'start'], ['content', 'content']];
  const found = order.find(([key]) => props.errors[key]);
  if (found) {
    document.getElementById(id(found[1]))?.focus();
  }
}
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id('title')">제목</label>
    <div class="control no-icon" :class="{ 'is-invalid': errors.title }">
      <input :id="id('title')" v-model="form.title" type="text" maxlength="50" :placeholder="isTodoForm ? '할일 제목' : ''" @input="delete errors.title" />
    </div>
    <div v-if="errors.title" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.title }}</div>
    <div class="char-count">{{ form.title.length }}/50</div>
  </div>
  <slot name="after-title"></slot>
  <div v-if="isTodoForm" class="field">
    <label class="field-label" :for="id('content')">내용</label>
    <div class="control no-icon" :class="{ 'is-invalid': errors.content }">
      <textarea :id="id('content')" v-model="form.content" rows="8" maxlength="2000" :placeholder="isTodoForm ? '할일 내용' : ''" @input="delete errors.content"></textarea>
    </div>
    <div v-if="errors.content" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.content }}</div>
    <div class="char-count">{{ form.content.length }}/2000</div>
  </div>
  <div class="field">
    <span class="field-label">기간</span>
    <div class="period-row">
      <div class="control no-icon" :class="{ 'is-invalid': errors.period, 'is-locked': form.isPeriodUndecided }">
        <input :id="id('start')" v-model="form.startDate" type="date" aria-label="시작일" :disabled="form.isPeriodUndecided" @input="delete errors.period" />
      </div><span>~</span>
      <div class="control no-icon" :class="{ 'is-invalid': errors.period, 'is-locked': form.isPeriodUndecided }">
        <input :id="id('end')" v-model="form.endDate" type="date" aria-label="종료일" :disabled="form.isPeriodUndecided" @input="delete errors.period" />
      </div>
    </div>
    <div v-if="form.hasTime" class="period-row is-time">
      <div class="control no-icon" :class="{ 'is-invalid': errors.period }">
        <input :id="id('start-time')" v-model="form.startTime" type="time" step="300" aria-label="시작 시각" @input="delete errors.period" />
      </div><span>~</span>
      <div class="control no-icon" :class="{ 'is-invalid': errors.period }">
        <input :id="id('end-time')" v-model="form.endTime" type="time" step="300" aria-label="종료 시각" @input="delete errors.period" />
      </div>
    </div>
    <div class="period-checks">
      <label class="undecided-check"><input v-model="form.isPeriodUndecided" type="checkbox" @change="onUndecided" />기간 미정</label>
      <label class="undecided-check"><input v-model="form.hasTime" type="checkbox" :disabled="form.isPeriodUndecided" @change="onHasTime" />시간 지정</label>
    </div>
    <div v-if="errors.period" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ errors.period }}</span></div>
  </div>
  <slot name="before-content"></slot>
  <div v-if="!isTodoForm" class="field">
    <label class="field-label" :for="id('content')">내용</label>
    <div class="control no-icon" :class="{ 'is-invalid': errors.content }">
      <textarea :id="id('content')" v-model="form.content" rows="8" maxlength="2000" :placeholder="isTodoForm ? '할일 내용' : ''" @input="delete errors.content"></textarea>
    </div>
    <div v-if="errors.content" class="message is-error"><i class="bi bi-exclamation-circle"></i>{{ errors.content }}</div>
    <div class="char-count">{{ form.content.length }}/2000</div>
  </div>
</template>
