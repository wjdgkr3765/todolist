<!-- 공통 레이아웃 (MainLayout_screen.md, 시안 docs/mockups/main_layout.html) -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import draggable from 'vuedraggable';
import NotificationPanel from '../components/NotificationPanel.vue';
import TeamCreateModal from '../components/TeamCreateModal.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { useAuthStore } from '../stores/auth.js';
import { useTeamsStore } from '../stores/teams.js';
import { useNotificationsStore } from '../stores/notifications.js';
import { useToastStore } from '../stores/toast.js';
import { connectRealtime, disconnectRealtime, onRealtime } from '../realtime/socket.js';

const PERSONAL_TABS = [
  { key: 'tasks', label: '작업' }, { key: 'calendar', label: '캘린더' }, { key: 'history', label: '히스토리' },
];
const TEAM_TABS = [
  { key: 'tasks', label: '작업' }, { key: 'calendar', label: '캘린더' }, { key: 'info', label: '팀 정보' },
  { key: 'history', label: '히스토리' }, { key: 'reports', label: '일일보고' },
];

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const teamsStore = useTeamsStore();
const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const { user } = storeToRefs(auth);
const { teams } = storeToRefs(teamsStore);
const { unreadCount } = storeToRefs(notificationsStore);

const isNotificationOpen = ref(false);
const isProfileMenuOpen = ref(false);
const isTeamModalOpen = ref(false);
const isLoggingOut = ref(false);

const currentTeamId = computed(() => (route.params.teamId ? Number(route.params.teamId) : null));
const space = computed(() => {
  if (route.name === 'profile') {
    return 'none';
  }
  return currentTeamId.value ? 'team' : 'personal';
});
const tabs = computed(() => (space.value === 'team' ? TEAM_TABS : PERSONAL_TABS));
const badgeText = computed(() => (unreadCount.value >= 100 ? '99+' : String(unreadCount.value)));

function tabPath(key) {
  return space.value === 'team' ? `/teams/${currentTeamId.value}/${key}` : `/personal/${key}`;
}

function closePopovers() {
  isNotificationOpen.value = false;
  isProfileMenuOpen.value = false;
  notificationsStore.isOpen = false;
}

async function toggleNotifications() {
  const opening = !isNotificationOpen.value;
  closePopovers();
  if (!opening) {
    return;
  }
  isNotificationOpen.value = true;
  notificationsStore.isOpen = true;
  await notificationsStore.openAndRead().catch(() => {});
}

function toggleProfileMenu() {
  const opening = !isProfileMenuOpen.value;
  closePopovers();
  isProfileMenuOpen.value = opening;
}

function openTeamModal() {
  closePopovers();
  isTeamModalOpen.value = true;
}

function goProfile() {
  closePopovers();
  router.push('/profile');
}

async function logout() {
  isLoggingOut.value = true;
  try {
    await auth.logout();
    disconnectRealtime();
    teamsStore.clear();
    notificationsStore.clear();
    await router.push('/login');
  } catch {
    // 오류 토스트는 API 공통 처리가 띄운다
  } finally {
    isLoggingOut.value = false;
  }
}

// 팀 목록 드래그 (D-089). 놓은 자리로 먼저 옮기고 서버 순서로 맞춘다
let teamsBeforeDrag = [];
function onDragStart() {
  teamsBeforeDrag = [...teams.value];
}
async function onDragEnd(event) {
  if (event.oldIndex === event.newIndex) {
    return;
  }
  const moved = teams.value[event.newIndex];
  try {
    await teamsStore.moveTeam(moved.teamId, event.newIndex, teamsBeforeDrag);
  } catch (error) {
    if (error.status > 0 && error.status < 500) {
      toastStore.showServerError();
    }
  }
}

// 내가 속하지 않은 팀 주소면 개인 작업 화면으로 (팀 경로 열기)
async function checkTeamRoute() {
  if (!currentTeamId.value || !teamsStore.isLoaded || teamsStore.findTeam(currentTeamId.value)) {
    return;
  }
  await teamsStore.fetchTeams().catch(() => {});
  if (!teamsStore.findTeam(currentTeamId.value)) {
    toastStore.show('error', '팀을 찾을 수 없습니다.');
    await router.replace('/personal/tasks');
  }
}

function onDocumentClick() {
  closePopovers();
}
function onKeydown(event) {
  if (event.key === 'Escape') {
    closePopovers();
    isTeamModalOpen.value = false;
  }
}

const offHandlers = [];
onMounted(async () => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
  connectRealtime();
  offHandlers.push(
    onRealtime('notifications:changed', async (data) => {
      notificationsStore.unreadCount = data.unreadCount;
      if (isNotificationOpen.value) {
        await notificationsStore.openAndRead().catch(() => {});
      }
    }),
    onRealtime('teams:changed', async (data) => {
      await teamsStore.fetchTeams().catch(() => {});
      if ((data.reason === 'removed' || data.reason === 'dissolved') && currentTeamId.value === data.teamId) {
        isTeamModalOpen.value = false;
        closePopovers();
        toastStore.show('error', data.reason === 'removed' ? '팀에서 내보내졌습니다.' : '팀이 해체되었습니다.');
        await router.replace('/personal/tasks');
      }
    }),
    onRealtime('reconnected', async () => {
      await Promise.all([notificationsStore.fetchNotifications(), teamsStore.fetchTeams()]).catch(() => {});
    }),
  );
  await Promise.all([teamsStore.fetchTeams(), notificationsStore.fetchNotifications()]).catch(() => {});
  await checkTeamRoute();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
  offHandlers.forEach((off) => off());
});

// 화면을 옮기면 안 본 알림 개수를 다시 불러오고, 팀 주소를 확인한다
watch(() => route.fullPath, async () => {
  closePopovers();
  await notificationsStore.fetchNotifications().catch(() => {});
  await checkTeamRoute();
});
</script>

<template>
  <div class="main-layout">
    <nav class="side-nav" aria-label="공간">
      <div class="nav-top">
        <RouterLink to="/personal/tasks" class="logo"><span class="logo-mark"><i class="bi bi-check2-square"></i></span>TODO</RouterLink>
        <button type="button" class="bell-button" :class="{ 'is-open': isNotificationOpen }" aria-label="알림" @click.stop="toggleNotifications">
          <i class="bi bi-bell"></i>
          <span v-if="unreadCount > 0" class="bell-badge">{{ badgeText }}</span>
        </button>
        <NotificationPanel v-if="isNotificationOpen" @close="closePopovers" />
      </div>

      <RouterLink to="/personal/tasks" class="nav-item" :class="{ 'is-active': space === 'personal' }">
        <i class="bi bi-person"></i>개인
      </RouterLink>
      <div class="nav-section-title">팀<button type="button" class="nav-add" aria-label="팀 만들기" @click.stop="openTeamModal"><i class="bi bi-plus-lg"></i></button></div>
      <draggable v-if="teams.length > 0" v-model="teams" item-key="teamId" class="nav-team-list" :animation="150" :delay="150"
        :delay-on-touch-only="true" :force-fallback="true" :fallback-tolerance="5" ghost-class="nav-ghost" fallback-class="nav-dragging"
        @start="onDragStart" @end="onDragEnd">
        <template #item="{ element }">
          <RouterLink :to="`/teams/${element.teamId}/tasks`" class="nav-item" :class="{ 'is-active': currentTeamId === element.teamId }">
            <i class="bi bi-people"></i><span class="nav-text">{{ element.name }}</span>
          </RouterLink>
        </template>
      </draggable>
      <div v-else class="nav-empty">아직 속한 팀이 없습니다.</div>

      <div class="profile">
        <div v-if="isProfileMenuOpen" class="popover-box profile-menu" role="menu" @click.stop>
          <button type="button" class="profile-menu-item" role="menuitem" @click="goProfile"><i class="bi bi-person-gear"></i>회원정보 수정</button>
          <button type="button" class="profile-menu-item" role="menuitem" :disabled="isLoggingOut" @click="logout">
            <template v-if="!isLoggingOut"><i class="bi bi-box-arrow-right"></i></template>
            <LoadingLabel :is-loading="isLoggingOut" loading-text="로그아웃 중..." text="로그아웃" />
          </button>
        </div>
        <button type="button" class="profile-button" :class="{ 'is-open': isProfileMenuOpen }" aria-haspopup="menu" @click.stop="toggleProfileMenu">
          <span class="profile-text">
            <span class="profile-nickname">{{ user?.nickname }}</span>
            <span class="profile-email">{{ user?.email }}</span>
          </span>
          <i class="bi bi-three-dots-vertical profile-more"></i>
        </button>
      </div>
    </nav>

    <nav v-if="space !== 'none'" class="menu-tabs" aria-label="메뉴">
      <RouterLink v-for="tab in tabs" :key="tab.key" :to="tabPath(tab.key)" class="menu-tab"
        :class="{ 'is-active': route.meta.tab === tab.key }">{{ tab.label }}</RouterLink>
    </nav>

    <main class="content">
      <RouterView />
    </main>

    <TeamCreateModal v-if="isTeamModalOpen" @close="isTeamModalOpen = false" />
  </div>
</template>
