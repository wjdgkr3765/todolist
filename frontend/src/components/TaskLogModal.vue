<!-- 수정 내역 모달: 그 시점 내용 (TaskView_screen.md, D-065, D-147). 히스토리·캘린더 상세에서도 쓴다 -->
<script setup>
import { computed } from 'vue';
import { STATUS_LABELS, formatPeriodFull, logTypeText } from '../utils/period.js';
import { formatDateTime } from '../utils/format.js';

const props = defineProps({
  log: { type: Object, required: true },
  isTeam: { type: Boolean, required: true },
});
const emit = defineEmits(['close']);
const period = computed(() => formatPeriodFull(props.log));
const actor = computed(() => (props.log.logType === 'create' ? '만든 사람' : '수정한 사람'));
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal-x is-wide" role="dialog" aria-label="수정 내역">
      <div class="modal-title-x">수정 내역<button type="button" class="icon-button" aria-label="닫기" @click="emit('close')"><i class="bi bi-x-lg"></i></button></div>
      <div class="log-modal-info">
        <div class="log-type">{{ logTypeText(log) }}</div>
        <div class="log-meta">{{ formatDateTime(log.createDate) }} · {{ actor }} {{ log.nickname }}</div>
      </div>
      <div class="detail-item"><div class="detail-label">상태</div><span class="badge-x" :class="`badge-${log.status}`">{{ STATUS_LABELS[log.status] }}</span></div>
      <div class="detail-item"><div class="detail-label">제목</div><div class="detail-value">{{ log.title }}</div></div>
      <div class="detail-item"><div class="detail-label">기간</div>
        <div class="detail-value"><template v-if="period">{{ period }}</template><span v-else class="badge-x badge-undecided">미정</span></div>
      </div>
      <div v-if="isTeam" class="detail-item"><div class="detail-label">작업자</div>
        <div class="detail-value"><template v-if="log.assigneeNicknames.length">{{ log.assigneeNicknames.join(', ') }}</template><span v-else class="muted">없음</span></div>
      </div>
      <div class="detail-item"><div class="detail-label">내용</div><div class="detail-value detail-content" style="max-height: 240px">{{ log.content }}</div></div>
      <div class="modal-actions"><button type="button" class="btn-x btn-outline-x" @click="emit('close')">닫기</button></div>
    </div>
  </div>
</template>
