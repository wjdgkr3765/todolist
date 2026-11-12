// 알림 목록과 안 본 알림 개수 (api.md 6.7, D-096)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../api/client.js';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([]);
  const unreadCount = ref(0);
  const isOpen = ref(false);

  async function fetchNotifications() {
    const data = await apiRequest('GET', '/api/notifications');
    notifications.value = data.notifications;
    unreadCount.value = data.unreadCount;
    return data;
  }

  async function markAllRead() {
    unreadCount.value = (await apiRequest('POST', '/api/notifications/read')).unreadCount;
  }

  // 알림 창을 열 때: 목록을 다시 불러오고, 안 본 것이 있으면 모두 읽음 (화면 강조는 그대로 둔다)
  async function openAndRead() {
    await fetchNotifications();
    if (unreadCount.value > 0) {
      await markAllRead();
    }
  }

  function removeLocal(notificationId) {
    notifications.value = notifications.value.filter((item) => item.notificationId !== notificationId);
  }

  async function remove(notificationId) {
    unreadCount.value = (await apiRequest('POST', `/api/notifications/${notificationId}/delete`)).unreadCount;
    removeLocal(notificationId);
  }

  async function accept(notificationId) {
    const team = await apiRequest('POST', `/api/notifications/${notificationId}/accept`);
    removeLocal(notificationId);
    return team;
  }

  async function decline(notificationId) {
    await apiRequest('POST', `/api/notifications/${notificationId}/decline`);
    removeLocal(notificationId);
  }

  function clear() {
    notifications.value = [];
    unreadCount.value = 0;
    isOpen.value = false;
  }

  return {
    notifications, unreadCount, isOpen, fetchNotifications, markAllRead, openAndRead, remove, accept, decline, clear,
  };
});
