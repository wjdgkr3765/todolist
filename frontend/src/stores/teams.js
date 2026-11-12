// 내 팀 목록 (좌측 네비, api.md 6.6). 서버가 준 순서로 그린다 (D-089)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiRequest } from '../api/client.js';

export const useTeamsStore = defineStore('teams', () => {
  const teams = ref([]);
  const isLoaded = ref(false);

  async function fetchTeams() {
    teams.value = (await apiRequest('GET', '/api/teams')).teams;
    isLoaded.value = true;
    return teams.value;
  }

  async function createTeam(name) {
    const team = await apiRequest('POST', '/api/teams', { body: { name } });
    teams.value = [team, ...teams.value.filter((item) => item.teamId !== team.teamId)];
    return team;
  }

  // 화면에서 먼저 옮긴 뒤 서버 순서로 다시 맞춘다. 실패하면 이전 순서로 되돌린다
  async function moveTeam(teamId, index, previous) {
    try {
      teams.value = (await apiRequest('POST', `/api/teams/${teamId}/move`, { body: { index } })).teams;
    } catch (error) {
      teams.value = previous;
      throw error;
    }
  }

  function addOnTop(team) {
    teams.value = [team, ...teams.value.filter((item) => item.teamId !== team.teamId)];
  }

  function findTeam(teamId) {
    return teams.value.find((team) => team.teamId === teamId) ?? null;
  }

  function clear() {
    teams.value = [];
    isLoaded.value = false;
  }

  return { teams, isLoaded, fetchTeams, createTeam, moveTeam, addOnTop, findTeam, clear };
});
