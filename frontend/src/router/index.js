// 화면 경로 (overview.md 5). 로그인 여부에 따른 이동(D-051)과 없는 주소 처리(D-119)는 로그인 기능을 만들 때 넣는다
import { createRouter, createWebHistory } from 'vue-router';

export const routes = [
  { path: '/signup', name: 'signup', component: () => import('../views/SignupView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
