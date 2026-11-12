// 화면 경로 (overview.md 5)
// - guestOnly: 로그인한 회원이 오면 로그인 후 화면으로 / requiresAuth: 비회원이 오면 로그인 화면으로 (D-051)
// - 없는 주소: 로그인했으면 /personal/tasks, 아니면 /login (D-119)
import { createRouter, createWebHistory } from 'vue-router';
import { setSessionExpiredHandler } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import { disconnectRealtime } from '../realtime/socket.js';

export const HOME_PATH = '/personal/tasks';
export const LOGIN_PATH = '/login';

const ComingSoonView = () => import('../views/ComingSoonView.vue');
// 공통 레이아웃 안 화면. 아직 만들지 않은 화면은 ComingSoonView 로 둔다
const VIEWS = {
  tasks: () => import('../views/TaskView.vue'),
  calendar: () => import('../views/CalendarView.vue'),
  history: () => import('../views/HistoryView.vue'),
  info: () => import('../views/TeamInfoView.vue'),
  reports: ComingSoonView,
  profile: ComingSoonView,
};

const TEAM_ID = ':teamId(\\d+)';

export const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/signup', name: 'signup', component: () => import('../views/SignupView.vue'), meta: { guestOnly: true } },
  { path: '/find-id', name: 'find-id', component: () => import('../views/FindIdView.vue'), meta: { guestOnly: true } },
  { path: '/find-password', name: 'find-password', component: () => import('../views/FindPasswordView.vue'), meta: { guestOnly: true } },
  { path: '/', redirect: HOME_PATH },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'personal/tasks', name: 'personal-tasks', component: VIEWS.tasks, meta: { tab: 'tasks' } },
      { path: 'personal/calendar', name: 'personal-calendar', component: VIEWS.calendar, meta: { tab: 'calendar' } },
      { path: 'personal/history', name: 'personal-history', component: VIEWS.history, meta: { tab: 'history' } },
      { path: `teams/${TEAM_ID}/tasks`, name: 'team-tasks', component: VIEWS.tasks, meta: { tab: 'tasks' } },
      { path: `teams/${TEAM_ID}/calendar`, name: 'team-calendar', component: VIEWS.calendar, meta: { tab: 'calendar' } },
      { path: `teams/${TEAM_ID}/info`, name: 'team-info', component: VIEWS.info, meta: { tab: 'info' } },
      { path: `teams/${TEAM_ID}/history`, name: 'team-history', component: VIEWS.history, meta: { tab: 'history' } },
      { path: `teams/${TEAM_ID}/reports`, name: 'team-reports', component: VIEWS.reports, meta: { tab: 'reports' } },
      { path: 'profile', name: 'profile', component: VIEWS.profile },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: { render: () => null }, meta: { isNotFound: true } },
];

// 화면 이동 전 로그인 여부 확인 (D-051, D-119)
export async function authGuard(to) {
  const { guestOnly, requiresAuth, isNotFound } = to.meta;
  if (!guestOnly && !requiresAuth && !isNotFound) {
    return true;
  }
  const auth = useAuthStore();
  let user;
  try {
    user = await auth.fetchMe();
  } catch {
    // 서버 오류면 토스트만 띄우고 화면은 그대로 연다 (없는 주소는 로그인 화면으로)
    return isNotFound ? LOGIN_PATH : true;
  }
  if (isNotFound) {
    return user ? HOME_PATH : LOGIN_PATH;
  }
  if (guestOnly && user) {
    return HOME_PATH;
  }
  if (requiresAuth && !user) {
    return LOGIN_PATH;
  }
  return true;
}

export function createAppRouter(history = createWebHistory()) {
  const router = createRouter({ history, routes });
  router.beforeEach(authGuard);
  // 사용 중 로그인 만료(D-118): 로그인 정보를 지우고 로그인 화면으로
  setSessionExpiredHandler(async () => {
    useAuthStore().clear();
    disconnectRealtime();
    await router.push(LOGIN_PATH);
  });
  return router;
}
