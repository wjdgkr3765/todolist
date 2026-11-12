// 팀 정보·이름 수정·내보내기·역할·관리자 넘기기·탈퇴·해체 (api.md 6.6, D-019, D-030, D-075, D-077, D-080, D-100, D-148)
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError, invalidInput, notFound } from '../utils/appError.js';
import { closeTeamRoom, emitToTeam, emitToUser, leaveTeamRoom } from '../realtime/index.js';
import { getMyTeam, listMembers } from './teamService.js';
import { getTask, writeTaskLog } from './taskCore.js';
import { notifyUnreadChanged } from './notificationService.js';

const forbidden = () => new AppError(403, 'FORBIDDEN', '권한이 없습니다.');

export async function getTeamDetail(userId, teamId, runner = null) {
  const team = await getMyTeam(userId, teamId, runner);
  const request = runner ? new sql.Request(runner) : (await getPool()).request();
  const result = await request.input('teamId', sql.BigInt, teamId)
    .query(`SELECT t.create_date,
              (SELECT u.nickname FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = t.id AND m.role = 'owner') AS owner_nickname,
              (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
            FROM teams t WHERE t.id = @teamId`);
  const row = result.recordset[0];
  return { ...team, ownerNickname: row.owner_nickname, memberCount: row.member_count, createDate: row.create_date.toISOString() };
}

// 그 팀의 team_members 행을 잠그고 내 역할·대상 역할을 다시 읽는다 (동시 변경 대비)
async function lockMembers(transaction, teamId, userId) {
  const result = await new sql.Request(transaction).input('teamId', sql.BigInt, teamId)
    .query('SELECT user_id, role FROM team_members WITH (UPDLOCK, HOLDLOCK) WHERE team_id = @teamId');
  const roles = new Map(result.recordset.map((row) => [Number(row.user_id), row.role]));
  if (!roles.has(userId)) {
    throw notFound();
  }
  return roles;
}

// 대상 회원 확인: 자기 자신이면 400, 팀에 없으면 404, 관리자면 403
function checkTarget(roles, userId, targetUserId) {
  if (targetUserId === userId) {
    throw invalidInput();
  }
  if (!roles.has(targetUserId)) {
    throw notFound();
  }
  if (roles.get(targetUserId) === 'owner') {
    throw forbidden();
  }
}

// 팀을 나가는 회원을 그 팀 작업의 작업자에서 빼고 기록을 남긴다 (D-100, D-148). 그 팀의 작업자 지정·마감 임박 알림도 지운다
async function removeFromAssignees(transaction, teamId, targetUserId, actorNickname) {
  const tasks = await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, targetUserId)
    .query(`SELECT a.task_id FROM task_assignees a JOIN tasks t ON t.id = a.task_id
            WHERE t.team_id = @teamId AND a.user_id = @userId`);
  const taskIds = tasks.recordset.map((row) => Number(row.task_id));
  for (const taskId of taskIds) {
    await new sql.Request(transaction).input('taskId', sql.BigInt, taskId).input('userId', sql.BigInt, targetUserId)
      .query(`DELETE FROM task_assignees WHERE task_id = @taskId AND user_id = @userId;
              UPDATE tasks SET update_date = SYSUTCDATETIME() WHERE id = @taskId;`);
    const task = await getTask(transaction, taskId);
    await writeTaskLog(transaction, {
      taskId, logType: 'change', nickname: actorNickname, snapshot: task,
      assigneeNicknames: task.assignees.map((a) => a.nickname), isAssigneeChanged: true,
    });
  }
  await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, targetUserId)
    .query(`DELETE FROM notifications WHERE user_id = @userId AND team_id = @teamId
              AND notification_type IN ('task_assigned', 'due_soon')`);
  return taskIds;
}

function afterMemberLeft(teamId, targetUserId, reason, taskIds, actorUserId) {
  leaveTeamRoom(targetUserId, teamId);
  emitToUser(targetUserId, 'teams:changed', { teamId, reason });
  if (taskIds.length > 0) {
    emitToTeam(teamId, 'team:tasks-changed', { teamId, taskIds, action: 'assignee-removed', actorUserId });
  }
}

export async function renameTeam(user, teamId, name) {
  await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    if (roles.get(user.userId) === 'member') {
      throw forbidden();
    }
    await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('name', sql.NVarChar(20), name)
      .query('UPDATE teams SET name = @name WHERE id = @teamId');
  });
  return getTeamDetail(user.userId, teamId);
}

export async function removeMember(user, teamId, targetUserId) {
  const taskIds = await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    checkTarget(roles, user.userId, targetUserId);
    const myRole = roles.get(user.userId);
    // 관리자는 부관리자·팀원을, 부관리자는 팀원만 (D-030)
    if (myRole === 'member' || (myRole === 'manager' && roles.get(targetUserId) !== 'member')) {
      throw forbidden();
    }
    const removed = await removeFromAssignees(transaction, teamId, targetUserId, user.nickname);
    await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, targetUserId)
      .query('DELETE FROM team_members WHERE team_id = @teamId AND user_id = @userId');
    return removed;
  });
  afterMemberLeft(teamId, targetUserId, 'removed', taskIds, user.userId);
  await notifyUnreadChanged(targetUserId);
  return listMembers(user.userId, teamId);
}

export async function setMemberRole(user, teamId, targetUserId, role) {
  await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    checkTarget(roles, user.userId, targetUserId);
    if (roles.get(user.userId) !== 'owner') {
      throw forbidden();
    }
    await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, targetUserId)
      .input('role', sql.NVarChar(10), role)
      .query('UPDATE team_members SET role = @role WHERE team_id = @teamId AND user_id = @userId AND role <> @role');
  });
  return listMembers(user.userId, teamId);
}

export async function transferOwner(user, teamId, targetUserId) {
  await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    checkTarget(roles, user.userId, targetUserId);
    if (roles.get(user.userId) !== 'owner') {
      throw forbidden();
    }
    // 관리자 1명 UNIQUE 필터 인덱스 때문에 원래 관리자를 먼저 manager 로 바꾼다
    await new sql.Request(transaction).input('teamId', sql.BigInt, teamId)
      .input('me', sql.BigInt, user.userId).input('target', sql.BigInt, targetUserId)
      .query(`UPDATE team_members SET role = 'manager' WHERE team_id = @teamId AND user_id = @me;
              UPDATE team_members SET role = 'owner' WHERE team_id = @teamId AND user_id = @target;`);
  });
  return { ...(await getTeamDetail(user.userId, teamId)), members: await listMembers(user.userId, teamId) };
}

export async function leaveTeam(user, teamId) {
  const taskIds = await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    // 관리자는 넘긴 뒤에만 탈퇴할 수 있다 (D-019)
    if (roles.get(user.userId) === 'owner') {
      throw forbidden();
    }
    const removed = await removeFromAssignees(transaction, teamId, user.userId, user.nickname);
    await new sql.Request(transaction).input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, user.userId)
      .query('DELETE FROM team_members WHERE team_id = @teamId AND user_id = @userId');
    return removed;
  });
  afterMemberLeft(teamId, user.userId, 'left', taskIds, user.userId);
  await notifyUnreadChanged(user.userId);
  return { isLeft: true };
}

export async function dissolveTeam(user, teamId, name) {
  const memberIds = await withTransaction(async (transaction) => {
    const roles = await lockMembers(transaction, teamId, user.userId);
    if (roles.get(user.userId) !== 'owner') {
      throw forbidden();
    }
    const team = await new sql.Request(transaction).input('teamId', sql.BigInt, teamId)
      .query('SELECT name FROM teams WITH (UPDLOCK) WHERE id = @teamId');
    if (team.recordset[0].name !== name) {
      throw new AppError(400, 'TEAM_NAME_MISMATCH', '팀 이름이 맞지 않습니다.');
    }
    // 작업과 이어진 알림을 먼저 지우고 팀을 지운다 (나머지는 ON DELETE CASCADE, D-075)
    const notified = await new sql.Request(transaction).input('teamId', sql.BigInt, teamId)
      .query(`DELETE FROM notifications OUTPUT deleted.user_id WHERE team_id = @teamId
                OR task_id IN (SELECT id FROM tasks WHERE team_id = @teamId);
              DELETE FROM teams WHERE id = @teamId;`);
    return { members: [...roles.keys()], notified: notified.recordset.map((row) => Number(row.user_id)) };
  });
  // 방에서 빼기 전에 모든 팀원에게 알린다 (api.md 6.8)
  memberIds.members.forEach((memberId) => emitToUser(memberId, 'teams:changed', { teamId, reason: 'dissolved' }));
  closeTeamRoom(teamId);
  for (const id of new Set(memberIds.notified)) {
    await notifyUnreadChanged(id);
  }
  return { isDeleted: true };
}
