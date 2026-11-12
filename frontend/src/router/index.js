// 화면 경로 (overview.md 5)
// - guestOnly: 로그인한 회원이 오면 로그인 후 화면으로 / requiresAuth: 비회원이 오면 로그인 화면으로 (D-051)
// - 없는 주소 처리(D-119)는 로그인 후 화면(/personal/tasks)을 만들 때 넣는다 (그 전에 넣으면 같은 곳을 계속 돌게 된다)
import { createRouter, createWebHistory } from 'vue-router';
import { setSessionExpiredHandler } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';

export const HOME_PATH = '/personal/tasks';
export const LOGIN_PATH = '/login';

export const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true } },
  { path: '/signup', name: 'signup', component: () => import('../views/SignupView.vue'), meta: { guestOnly: true } },
];

// 화면 이동 전 로그인 여부 확인 (D-051)
export async function authGuard(to) {
  const { guestOnly, requiresAuth } = to.meta;
  if (!guestOnly && !requiresAuth) {
    return true;
  }
  const auth = useAuthStore();
  let user;
  try {
    user = await auth.fetchMe();
  } catch {
    // 서버 오류면 토스트만 띄우고 화면은 그대로 연다
    return true;
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
    await router.push(LOGIN_PATH);
  });
  return router;
}
