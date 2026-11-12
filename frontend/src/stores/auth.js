// 로그인 회원 상태 (api.md 6.3). 화면을 옮길 때마다 GET /api/sessions/me 로 확인한다 (D-051)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../api/client.js';

export const useAuthStore = defineStore('auth', () => {
  // { userId, loginId, nickname, email } 또는 null
  const user = ref(null);

  async function fetchMe() {
    try {
      user.value = await apiRequest('GET', '/api/sessions/me');
    } catch (error) {
      if (error.status !== 401) {
        throw error;
      }
      user.value = null;
    }
    return user.value;
  }

  async function login(loginId, password) {
    user.value = await apiRequest('POST', '/api/sessions', { body: { loginId, password } });
    return user.value;
  }

  async function logout() {
    await apiRequest('POST', '/api/sessions/logout');
    user.value = null;
  }

  function clear() {
    user.value = null;
  }

  return { user, fetchMe, login, logout, clear };
});
