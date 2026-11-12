<!-- 작업 상세 모달 (보기 전용). 캘린더(CalendarView_screen.md, D-108)와 히스토리(HistoryView_screen.md, D-112)가 같이 쓴다 -->
<script setup>
import { computed } from 'vue';
import { STATUS_LABELS, formatPeriodFull, logTypeText } from '../utils/period.js';
import { formatDateTime } from '../utils/format.js';

const props = defineProps({
  task: { type: Object, required: true },
  isTeam: { type: Boolean, required: true },
  isHistory: { type: Boolean, default: false },
  // 히스토리: 완료일과 수정 내역을 보여준다
  logs: { type: Array, default: null },
  isLogsLoading: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
const period = computed(() => formatPeriodFull(props.task));
const isHistoryPage = computed(() => props.logs !== null);
</script>

<template>
  <div class="modal-backdrop-x" @click.self="emit('close')">
    <div class="modal-x" :class="isHistoryPage ? 'is-wider' : 'is-wide'" role="dialog" aria-label="작업 상세">
      <div class="modal-title-x">작업 상세<button type="button" class="icon-button" aria-label="닫기" @click="emit('close')"><i class="bi bi-x-lg"></i></button></div>
      <div class="detail-item"><div class="detail-label">상태</div>
        <span v-if="isHistory" class="badge-x badge-history">히스토리</span>
        <span v-else class="badge-x" :class="`badge-${task.status}`">{{ STATUS_LABELS[task.status] }}</span>
      </div>
      <div class="detail-item"><div class="detail-label">제목</div><div class="detail-value">{{ task.title }}</div></div>
      <div class="detail-item"><div class="detail-label">기간</div>
        <div class="detail-value"><template v-if="period">{{ period }}</template><span v-else class="badge-x badge-undecided">미정</span></div>
      </div>
      <div v-if="task.doneDate" class="detail-item"><div class="detail-label">완료일</div><div class="detail-value">{{ formatDateTime(task.doneDate) }}</div></div>
      <div v-if="isTeam" class="detail-item"><div class="detail-label">작업자</div>
        <div class="detail-value"><template v-if="task.assignees.length">{{ task.assignees.map((a) => a.nickname).join(', ') }}</template><span v-else class="muted">없음</span></div>
      </div>
      <div class="detail-item"><div class="detail-label">내용</div>
        <div class="detail-value detail-content" :style="{ maxHeight: isHistoryPage ? '200px' : '240px' }">{{ task.content }}</div>
      </div>
      <div v-if="isHistoryPage" class="log-section">
        <div class="log-title">수정 내역<span>({{ logs.length }})</span></div>
        <div v-if="isLogsLoading" class="loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span></div>
        <div v-else class="log-list">
          <div v-for="log in logs" :key="log.logId" class="log-row">
            <div class="log-type">{{ logTypeText(log) }}</div>
            <div class="log-meta">{{ formatDateTime(log.createDate) }} · {{ log.logType === 'create' ? '만든 사람' : '수정한 사람' }} {{ log.nickname }}</div>
          </div>
        </div>
      </div>
      <div class="modal-actions"><button type="button" class="btn-x btn-outline-x" @click="emit('close')">닫기</button></div>
    </div>
  </div>
</template>

<style scoped>
.detail-item { margin-bottom: 14px; }
.detail-label { font-size: 13px; font-weight: 600; color: var(--color-sub); margin-bottom: 4px; }
.detail-value { font-size: 15px; word-break: break-all; }
.detail-content { white-space: pre-wrap; overflow-y: auto; }
.muted { color: var(--color-muted); }
.log-section { border-top: 1px solid var(--color-border); padding-top: 16px; }
.log-title { font-size: 15px; font-weight: 800; margin-bottom: 8px; }
.log-title span { color: var(--color-muted); font-weight: 600; margin-left: 2px; }
.log-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.log-row { padding: 10px 12px; border-radius: 10px; }
.log-type { font-size: 14px; font-weight: 600; }
.log-meta { font-size: 12px; color: var(--color-sub); margin-top: 2px; }
</style>
