<!-- 팀 정보 탭: 팀 정보 카드, 팀원 게시판, 답을 기다리는 초대, 팀 해체·탈퇴 (TeamInfoView_screen.md, 시안 docs/mockups/team_info_view.html) -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import LoadingLabel from '../components/LoadingLabel.vue';
import { apiRequest } from '../api/client.js';
import { useAuthStore } from '../stores/auth.js';
import { useTeamsStore } from '../stores/teams.js';
import { useToastStore } from '../stores/toast.js';
import { isEmail } from '../utils/validation.js';

const ROLE_LABELS = { owner: '관리자', manager: '부관리자', member: '팀원' };

const route = useRoute();
const router = useRouter();
const { user } = storeToRefs(useAuthStore());
const teamsStore = useTeamsStore();
const toastStore = useToastStore();

const teamId = computed(() => Number(route.params.teamId));
const base = computed(() => `/api/teams/${teamId.value}`);
const team = ref(null);
const members = ref([]);
const invitations = ref([]);
const isLoading = ref(true);
const myRole = computed(() => team.value?.myRole ?? 'member');

const isRenaming = ref(false);
const renameValue = ref('');
const renameError = ref('');
const isRenameSaving = ref(false);
const renameInput = ref(null);
const openMenuUserId = ref(null);
const isInviteOpen = ref(false);
const inviteEmail = ref('');
const inviteError = ref('');
const isInviting = ref(false);
const inviteInput = ref(null);
// 확인창: { kind, title, text, okText, isDanger, target? }
const confirm = ref(null);
const isConfirmLoading = ref(false);
const dissolveName = ref('');

const pad = (value) => String(value).padStart(2, '0');
function formatDate(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

// 내 역할로 그 행에 할 수 있는 동작 (화면 문서 "행 메뉴 항목")
function menuItems(member) {
  if (member.userId === user.value?.userId || member.role === 'owner') {
    return [];
  }
  if (myRole.value === 'owner') {
    return [member.role === 'manager' ? 'unset-manager' : 'set-manager', 'transfer', 'remove'];
  }
  if (myRole.value === 'manager' && member.role === 'member') {
    return ['remove'];
  }
  return [];
}
const MENU_LABELS = { 'set-manager': '부관리자 지정', 'unset-manager': '부관리자 해제', transfer: '관리자 넘기기', remove: '내보내기' };

async function goPersonalWithNotFound() {
  toastStore.show('error', '팀을 찾을 수 없습니다.');
  await teamsStore.fetchTeams().catch(() => {});
  await router.replace('/personal/tasks');
}

async function loadTeam() {
  team.value = await apiRequest('GET', base.value);
}
async function loadMembers() {
  members.value = (await apiRequest('GET', `${base.value}/members`)).members;
}
async function loadInvitations() {
  invitations.value = (await apiRequest('GET', `${base.value}/invitations`)).invitations;
}

async function loadAll() {
  isLoading.value = true;
  isRenaming.value = false;
  try {
    await Promise.all([loadTeam(), loadMembers(), loadInvitations()]);
  } catch (error) {
    if (error.status === 404) {
      await goPersonalWithNotFound();
    }
  } finally {
    isLoading.value = false;
  }
}

// 모든 API 의 403·404·이름 불일치 공통 처리
async function handleCommonError(error) {
  if (error.status === 403) {
    toastStore.show('error', '권한이 없습니다.');
    await Promise.all([loadTeam(), loadMembers()]).catch(() => {});
  } else if (error.status === 404) {
    try {
      await loadTeam();
      toastStore.show('error', '이미 팀에 없는 회원입니다.');
      await loadMembers();
    } catch {
      await goPersonalWithNotFound();
    }
  } else if (error.code === 'TEAM_NAME_MISMATCH') {
    toastStore.show('error', '팀 이름이 맞지 않습니다.');
    await loadTeam().catch(() => {});
  }
}

// ---------- 이름 수정 ----------
async function startRename() {
  renameValue.value = team.value.name;
  renameError.value = '';
  isRenaming.value = true;
  await nextTick();
  renameInput.value?.focus();
}
async function saveRename() {
  const name = renameValue.value.trim();
  renameError.value = !name ? '팀 이름을 입력해 주세요.' : (name.length > 20 ? '팀 이름은 20자 이하로 입력해 주세요.' : '');
  if (renameError.value) {
    renameInput.value?.focus();
    return;
  }
  isRenameSaving.value = true;
  try {
    team.value = await apiRequest('POST', `${base.value}/update`, { body: { name } });
    isRenaming.value = false;
    await teamsStore.fetchTeams().catch(() => {});
    toastStore.show('success', '팀 이름을 바꿨습니다.');
  } catch (error) {
    await handleCommonError(error);
  } finally {
    isRenameSaving.value = false;
  }
}

// ---------- 초대 ----------
async function openInvite() {
  inviteEmail.value = '';
  inviteError.value = '';
  isInviteOpen.value = true;
  await nextTick();
  inviteInput.value?.focus();
}
const INVITE_ERRORS = {
  USER_NOT_FOUND: '가입된 회원이 아닙니다.',
  ALREADY_TEAM_MEMBER: '이미 팀원인 회원입니다.',
  INVITATION_DUPLICATED: '이미 초대한 회원입니다.',
  INVITATION_RECENTLY_DECLINED: '초대를 거절한 회원입니다. 거절한 때부터 24시간 뒤에 다시 초대할 수 있습니다.',
  INVALID_INPUT: '이메일 형식이 올바르지 않습니다.',
};
async function sendInvite() {
  if (isInviting.value) {
    return;
  }
  const email = inviteEmail.value.trim();
  inviteError.value = !email ? '이메일을 입력해 주세요.' : (isEmail(email) ? '' : '이메일 형식이 올바르지 않습니다.');
  if (inviteError.value) {
    inviteInput.value?.focus();
    return;
  }
  isInviting.value = true;
  try {
    const data = await apiRequest('POST', `${base.value}/invitations`, { body: { email } });
    isInviteOpen.value = false;
    toastStore.show('success', data.isMailSent ? '초대했습니다.' : '초대했지만 안내 메일은 보내지 못했습니다.');
    await loadInvitations().catch(() => {});
  } catch (error) {
    if (INVITE_ERRORS[error.code]) {
      inviteError.value = INVITE_ERRORS[error.code];
    } else if (error.status === 404) {
      isInviteOpen.value = false;
      await goPersonalWithNotFound();
    }
  } finally {
    isInviting.value = false;
  }
}

// ---------- 행 메뉴·확인창 ----------
function toggleMenu(member) {
  openMenuUserId.value = openMenuUserId.value === member.userId ? null : member.userId;
}

async function runMenu(action, member) {
  openMenuUserId.value = null;
  if (action === 'set-manager' || action === 'unset-manager') {
    try {
      const role = action === 'set-manager' ? 'manager' : 'member';
      members.value = (await apiRequest('POST', `${base.value}/members/${member.userId}/role`, { body: { role } })).members;
      toastStore.show('success', role === 'manager' ? '부관리자로 지정했습니다.' : '부관리자를 해제했습니다.');
    } catch (error) {
      await handleCommonError(error);
    }
    return;
  }
  confirm.value = action === 'transfer'
    ? { kind: 'transfer', title: '관리자 넘기기', text: `${member.nickname}님에게 관리자를 넘길까요? 넘기면 나는 부관리자가 됩니다.`, okText: '넘기기', isDanger: false, member }
    : { kind: 'remove', title: '내보내기', text: `${member.nickname}님을 팀에서 내보낼까요? 이 회원이 맡은 작업의 작업자에서도 빠집니다.`, okText: '내보내기', isDanger: true, member };
}

function askCancelInvite(invite) {
  confirm.value = { kind: 'cancel-invite', title: '초대 취소', text: `${invite.nickname}님에게 보낸 초대를 취소할까요?`, okText: '초대 취소', isDanger: true, invite, cancelText: '닫기' };
}
function askLeave() {
  confirm.value = { kind: 'leave', title: '팀 탈퇴', text: `${team.value.name} 팀에서 탈퇴할까요? 내가 맡은 작업의 작업자에서도 빠집니다.`, okText: '탈퇴', isDanger: true };
}
function askDissolve() {
  dissolveName.value = '';
  confirm.value = { kind: 'dissolve-1', title: '팀 해체', text: '팀을 해체하려면 팀 이름을 입력해 주세요.', okText: '다음', isDanger: true };
}

async function leaveTeamPage(message) {
  confirm.value = null;
  await teamsStore.fetchTeams().catch(() => {});
  await router.replace('/personal/tasks');
  toastStore.show('success', message);
}

async function runConfirm() {
  const current = confirm.value;
  if (current.kind === 'dissolve-1') {
    confirm.value = { kind: 'dissolve-2', title: '팀 해체', text: '정말 삭제할까요? 되돌릴 수 없습니다.', okText: '삭제', isDanger: true };
    return;
  }
  isConfirmLoading.value = true;
  try {
    if (current.kind === 'transfer') {
      const data = await apiRequest('POST', `${base.value}/owner`, { body: { userId: current.member.userId } });
      members.value = data.members;
      team.value = { teamId: data.teamId, name: data.name, myRole: data.myRole, ownerNickname: data.ownerNickname, memberCount: data.memberCount, createDate: data.createDate };
      confirm.value = null;
      toastStore.show('success', '관리자를 넘겼습니다.');
    } else if (current.kind === 'remove') {
      members.value = (await apiRequest('POST', `${base.value}/members/${current.member.userId}/remove`)).members;
      confirm.value = null;
      await loadTeam().catch(() => {});
      toastStore.show('success', `${current.member.nickname}님을 내보냈습니다.`);
    } else if (current.kind === 'cancel-invite') {
      invitations.value = (await apiRequest('POST', `${base.value}/invitations/${current.invite.notificationId}/cancel`)).invitations;
      confirm.value = null;
      toastStore.show('success', '초대를 취소했습니다.');
    } else if (current.kind === 'leave') {
      await apiRequest('POST', `${base.value}/leave`);
      await leaveTeamPage('팀에서 탈퇴했습니다.');
    } else if (current.kind === 'dissolve-2') {
      await apiRequest('POST', `${base.value}/delete`, { body: { name: dissolveName.value.trim() } });
      await leaveTeamPage('팀을 해체했습니다.');
    }
  } catch (error) {
    confirm.value = null;
    if (current.kind === 'cancel-invite' && error.status === 404) {
      toastStore.show('error', '이미 답했거나 취소된 초대입니다.');
      await loadInvitations().catch(() => {});
    } else {
      await handleCommonError(error);
    }
  } finally {
    isConfirmLoading.value = false;
  }
}

function onDocumentClick() {
  openMenuUserId.value = null;
}
function onKeydown(event) {
  if (event.key === 'Escape') {
    openMenuUserId.value = null;
    isInviteOpen.value = false;
    confirm.value = null;
    isRenaming.value = false;
  }
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
  loadAll();
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
watch(() => route.params.teamId, () => {
  if (route.params.teamId) {
    loadAll();
  }
});
</script>

<template>
  <div class="team-info">
    <div v-if="isLoading" class="card-x loading-box"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>불러오는 중...</div>
    <div v-else-if="team">
      <section class="card-x">
        <div v-if="!isRenaming" class="team-name-row">
          <h1 class="team-name">{{ team.name }}</h1>
          <button v-if="myRole !== 'member'" type="button" class="btn-x btn-soft-x" @click="startRename"><i class="bi bi-pencil"></i>이름 수정</button>
        </div>
        <div v-else class="name-edit">
          <div class="field">
            <div class="control no-icon" :class="{ 'is-invalid': renameError }">
              <input ref="renameInput" v-model="renameValue" type="text" maxlength="20" aria-label="팀 이름" @input="renameError = ''" @keydown.enter.prevent="saveRename" />
            </div>
            <div v-if="renameError" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ renameError }}</span></div>
          </div>
          <button type="button" class="btn-x btn-outline-x" @click="isRenaming = false">취소</button>
          <button type="button" class="btn-x btn-primary-x" :disabled="isRenameSaving" @click="saveRename">
            <LoadingLabel :is-loading="isRenameSaving" loading-text="저장 중..." text="저장" />
          </button>
        </div>
        <div class="team-meta">
          <span><i class="bi bi-person-badge"></i><span>{{ team.ownerNickname }}</span></span>
          <span><i class="bi bi-people"></i><span>{{ team.memberCount }}명</span></span>
          <span><i class="bi bi-calendar"></i><span>{{ formatDate(team.createDate) }}</span></span>
        </div>
      </section>

      <section class="card-x">
        <div class="card-title-x"><span>팀원 ({{ members.length }}명)</span>
          <button type="button" class="btn-x btn-primary-x btn-invite" @click="openInvite"><i class="bi bi-person-plus"></i>초대</button>
        </div>
        <table class="table-x member-table">
          <thead><tr><th>닉네임</th><th class="col-email">이메일</th><th>역할</th><th>합류일</th><th class="col-menu"></th></tr></thead>
          <tbody>
            <tr v-for="member in members" :key="member.userId">
              <td>{{ member.nickname }}<span v-if="member.userId === user?.userId" class="me-mark">(나)</span><span class="email-sub">{{ member.email }}</span></td>
              <td class="col-email">{{ member.email }}</td>
              <td><span class="badge-x" :class="`badge-${member.role}`">{{ ROLE_LABELS[member.role] }}</span></td>
              <td>{{ formatDate(member.joinDate) }}</td>
              <td class="col-menu">
                <template v-if="menuItems(member).length > 0">
                  <button type="button" class="icon-button" aria-label="팀원 메뉴" @click.stop="toggleMenu(member)"><i class="bi bi-three-dots-vertical"></i></button>
                  <div v-if="openMenuUserId === member.userId" class="popover-box row-menu" @click.stop>
                    <button v-for="action in menuItems(member)" :key="action" type="button" class="row-menu-item"
                      :class="{ 'is-danger': action === 'remove' }" @click="runMenu(action, member)">{{ MENU_LABELS[action] }}</button>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="invitations.length > 0" class="card-x">
        <div class="card-title-x"><span>답을 기다리는 초대 ({{ invitations.length }})</span></div>
        <div v-for="invite in invitations" :key="invite.notificationId" class="invite-row">
          <div class="invite-who"><b>{{ invite.nickname }}</b><small>{{ invite.email }}</small></div>
          <span class="invite-meta">{{ invite.senderNickname }}님이 초대 · {{ formatDate(invite.createDate) }}</span>
          <button v-if="invite.canCancel" type="button" class="btn-x btn-outline-x" @click="askCancelInvite(invite)">취소</button>
        </div>
      </section>

      <div class="bottom-action">
        <button v-if="myRole === 'owner'" type="button" class="btn-x btn-danger-x btn-lg-x btn-block-x" @click="askDissolve"><i class="bi bi-trash"></i>팀 해체</button>
        <button v-else type="button" class="btn-x btn-outline-danger-x btn-lg-x btn-block-x" @click="askLeave"><i class="bi bi-box-arrow-left"></i>팀 탈퇴</button>
      </div>
    </div>

    <div v-if="isInviteOpen" class="modal-backdrop-x" @click.self="isInviteOpen = false">
      <div class="modal-x" role="dialog" aria-label="팀원 초대">
        <div class="modal-title-x">팀원 초대</div>
        <div class="modal-sub" style="margin: 0 0 16px">초대할 회원의 이메일을 입력해 주세요. 상대가 알림에서 수락하면 팀에 들어옵니다.</div>
        <div class="field" style="margin-bottom: 0">
          <label class="field-label" for="invite-email">이메일</label>
          <div class="control no-icon" :class="{ 'is-invalid': inviteError }">
            <input id="invite-email" ref="inviteInput" v-model="inviteEmail" type="email" maxlength="100" @input="inviteError = ''" @keydown.enter.prevent="sendInvite" />
          </div>
          <div v-if="inviteError" class="message is-error"><i class="bi bi-exclamation-circle"></i><span>{{ inviteError }}</span></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-x btn-outline-x" @click="isInviteOpen = false">취소</button>
          <button type="button" class="btn-x btn-primary-x" :disabled="isInviting" @click="sendInvite">
            <LoadingLabel :is-loading="isInviting" loading-text="초대 중..." text="초대" />
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog v-if="confirm" :title="confirm.title" :text="confirm.text" :confirm-text="confirm.okText" :is-danger="confirm.isDanger"
      :cancel-text="confirm.cancelText ?? '취소'" :loading-text="confirm.kind === 'dissolve-2' ? '삭제 중...' : '처리 중...'"
      :is-loading="isConfirmLoading" :is-confirm-disabled="confirm.kind === 'dissolve-1' && dissolveName.trim() !== team?.name"
      @confirm="runConfirm" @cancel="confirm = null">
      <template v-if="confirm.kind === 'dissolve-1'">
        <div class="confirm-name">{{ team.name }}</div>
        <div class="field" style="margin: 12px 0 0">
          <div class="control no-icon"><input v-model="dissolveName" type="text" maxlength="20" aria-label="팀 이름 확인" /></div>
        </div>
      </template>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* TeamInfoView_screen.md 7. 디자인 값 (시안 team_info_view.html 과 같은 값) */
.team-info { max-width: 880px; }
.team-name-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.team-name { font-size: 22px; font-weight: 800; word-break: break-all; margin: 0; }
.team-meta { display: flex; flex-wrap: wrap; gap: 6px 20px; margin-top: 12px; font-size: 14px; color: var(--color-sub); }
.team-meta span { display: inline-flex; align-items: center; gap: 6px; }
.name-edit { display: flex; gap: 8px; align-items: flex-start; }
.name-edit .field { flex: 1; margin: 0; }
.name-edit .btn-x { height: 51px; padding: 0 16px; }
.btn-invite { height: 40px; padding: 0 16px; border-radius: 10px; font-weight: 700; }
.badge-owner { background: var(--color-primary); color: #fff; }
.badge-manager { background: var(--color-primary-soft); color: var(--color-primary-dark); }
.badge-member { background: #f3f4f6; color: var(--color-sub); }
.member-table td { height: 52px; }
.member-table .col-menu { width: 48px; text-align: right; position: relative; }
.me-mark { font-size: 13px; color: var(--color-muted); margin-left: 4px; }
.row-menu { position: absolute; right: 8px; top: 44px; z-index: 20; width: 180px; padding: 6px; border-radius: 12px; }
.row-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; height: 40px; border: 0; background: transparent; border-radius: 8px; padding: 0 10px; font-size: 14px; font-weight: 600; color: var(--color-ink); white-space: nowrap; }
.row-menu-item:hover { background: var(--color-hover-bg); }
.row-menu-item.is-danger { color: var(--color-danger); }
.email-sub { display: none; font-size: 12px; color: var(--color-sub); }
.invite-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.invite-row:last-child { border-bottom: 0; }
.invite-who { flex: 1; min-width: 0; }
.invite-who b { font-weight: 600; }
.invite-who small { color: var(--color-sub); margin-left: 6px; }
.invite-meta { color: var(--color-sub); font-size: 13px; white-space: nowrap; }
.bottom-action { margin-top: 20px; }
.confirm-name { font-weight: 800; margin-top: 6px; }
@media (max-width: 767.98px) {
  .member-table .col-email { display: none; }
  .email-sub { display: block; }
  .invite-who small { display: block; margin-left: 0; }
}
</style>
