<!-- 알림 창 (MainLayout_screen.md 3. 화면 요소, 4. 동작) -->
<script setup>
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useNotificationsStore } from '../stores/notifications.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';
import { formatDateTime, formatMonthDay } from '../utils/format.js';

const emit = defineEmits(['close']);
const router = useRouter();
const store = useNotificationsStore();
const teamsStore = useTeamsStore();
const toastStore = useToastStore();
const { notifications } = storeToRefs(store);
const busy = reactive({});

function dueText(item) {
  const time = item.taskEndTime ? ` ${item.taskEndTime}` : '';
  return `"${item.taskTitle}" 작업이 ${formatMonthDay(item.taskEndDate)}${time}에 마감됩니다.`;
}

async function reloadOnNotFound(error) {
  if (error.status === 404) {
    await store.fetchNotifications();
    return true;
  }
  return false;
}

async function accept(item) {
  busy[item.notificationId] = 'accept';
  try {
    const team = await store.accept(item.notificationId);
    teamsStore.addOnTop(team);
    toastStore.show('success', `${team.name} 팀에 가입했습니다.`);
  } catch (error) {
    if (error.code === 'TEAM_LIMIT_EXCEEDED') {
      toastStore.show('error', '가입된 팀이 20개라 더 가입할 수 없습니다.');
    } else if (await reloadOnNotFound(error)) {
      toastStore.show('error', '이미 없어진 초대입니다.');
    }
  } finally {
    delete busy[item.notificationId];
  }
}

async function decline(item) {
  busy[item.notificationId] = 'decline';
  try {
    await store.decline(item.notificationId);
  } catch (error) {
    await reloadOnNotFound(error);
  } finally {
    delete busy[item.notificationId];
  }
}

async function remove(item) {
  try {
    await store.remove(item.notificationId);
  } catch (error) {
    await reloadOnNotFound(error);
  }
}

// 작업자 지정·마감 임박: 그 작업 화면으로 가서 상세를 연다 (알림은 지우지 않는다)
function openTask(item) {
  emit('close');
  const base = item.teamId ? `/teams/${item.teamId}/tasks` : '/personal/tasks';
  router.push({ path: base, query: { taskId: String(item.taskId) } });
}
</script>

<template>
  <div class="popover-box notification-box" role="dialog" aria-label="알림" @click.stop>
    <div class="notification-title">알림</div>
    <div v-if="notifications.length > 0" class="notification-list">
      <div v-for="item in notifications" :key="item.notificationId" class="notification-item"
        :class="{ 'is-unread': !item.isRead }">
        <template v-if="item.notificationType === 'team_invite'">
          <i class="bi bi-people"></i>
          <div>{{ item.senderNickname }}님이 {{ item.teamName }} 팀에 초대했습니다.
            <div class="notification-time">{{ formatDateTime(item.createDate) }}</div>
            <div class="notification-actions">
              <button type="button" class="btn-x btn-primary-x" :disabled="Boolean(busy[item.notificationId])" @click="accept(item)">
                <span v-if="busy[item.notificationId] === 'accept'" class="spinner-border spinner-border-sm" aria-hidden="true"></span>수락
              </button>
              <button type="button" class="btn-x btn-outline-x" :disabled="Boolean(busy[item.notificationId])" @click="decline(item)">거절</button>
            </div>
          </div>
        </template>
        <template v-else>
          <i class="bi" :class="item.notificationType === 'due_soon' ? 'bi-alarm is-alarm' : 'bi-person-check'"></i>
          <a href="#" class="notification-link" @click.prevent="openTask(item)">
            <template v-if="item.notificationType === 'task_assigned'">{{ item.senderNickname }}님이 {{ item.teamName }} 팀의 "<span class="task-title">{{ item.taskTitle }}</span>" 작업자로 지정했습니다.</template>
            <template v-else>{{ dueText(item) }}<span class="notification-sub">{{ item.teamName ?? '개인' }}</span></template>
            <span class="notification-time">{{ formatDateTime(item.createDate) }}</span>
          </a>
          <button type="button" class="notification-close" aria-label="알림 지우기" @click.stop="remove(item)"><i class="bi bi-x-lg"></i></button>
        </template>
      </div>
    </div>
    <div v-else class="notification-empty"><i class="bi bi-bell-slash"></i>알림이 없습니다.</div>
  </div>
</template>

<style scoped>
.notification-link .task-title { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.notification-item:has(.notification-link):hover { background: var(--color-input-bg); }
</style>
