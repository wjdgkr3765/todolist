// 작업 (칸반) 수정·드래그·삭제·수정 내역 (api.md 6.5, D-013, D-023, D-062, D-065~D-070, D-099, D-113, D-127, D-128)
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError, invalidInput } from '../utils/appError.js';
import { emitToTeam } from '../realtime/index.js';
import { bindPeriod, checkRowSpace, toPeriod } from './spaceService.js';
import {
  currentAssignees, findTaskRow, getTask, isHistoryRow, listTasks, lockSpaceTasks, placeInStatus, writeTaskLog,
} from './taskCore.js';
import { notifyUnreadChanged } from './notificationService.js';

const PERIOD_KEYS = ['startDate', 'endDate', 'startTime', 'endTime', 'isPeriodUndecided'];

function taskInHistory() {
  return new AppError(409, 'TASK_IN_HISTORY', '히스토리로 옮겨진 작업입니다.');
}

function emitTasks(space, taskIds, action, actorUserId) {
  if (space.teamId !== null) {
    emitToTeam(space.teamId, 'team:tasks-changed', { teamId: space.teamId, taskIds, action, actorUserId });
  }
}

// 작업을 읽고 공간 권한을 확인한 뒤, 그 공간을 잠그고 다시 읽는다 (트랜잭션 안)
async function lockTaskForChange(transaction, userId, taskId) {
  const first = await findTaskRow(transaction, taskId);
  const space = await checkRowSpace(userId, first, transaction);
  await lockSpaceTasks(transaction, space);
  const row = await findTaskRow(transaction, taskId, { isLocked: true });
  await checkRowSpace(userId, row, transaction);
  if (isHistoryRow(row)) {
    throw taskInHistory();
  }
  return { space, row };
}

// 상태가 바뀔 때: 옮겨 간 공간 맨 위(D-069) 또는 index 자리, 떠난 공간 다시 매김, 완료 시각 (D-015, D-066)
async function changeStatus(transaction, space, row, status, index) {
  await new sql.Request(transaction).input('id', sql.BigInt, row.id).input('status', sql.NVarChar(10), status)
    .query(`UPDATE tasks SET status = @status, update_date = SYSUTCDATETIME(),
              done_date = CASE WHEN @status = 'done' THEN SYSUTCDATETIME() ELSE NULL END
            WHERE id = @id`);
  await placeInStatus(transaction, space, status, Number(row.id), index);
  await placeInStatus(transaction, space, row.status, null);
}

async function deleteDueSoon(transaction, taskId, userIds = null) {
  const request = new sql.Request(transaction).input('taskId', sql.BigInt, taskId);
  let filter = '';
  if (userIds) {
    if (userIds.length === 0) {
      return [];
    }
    userIds.forEach((id, index) => request.input(`u${index}`, sql.BigInt, id));
    filter = ` AND user_id IN (${userIds.map((_, index) => `@u${index}`).join(', ')})`;
  }
  const result = await request.query(`DELETE FROM notifications OUTPUT deleted.user_id
    WHERE task_id = @taskId AND notification_type = 'due_soon'${filter}`);
  return result.recordset.map((r) => Number(r.user_id));
}

async function snapshotOf(transaction, taskId) {
  const task = await getTask(transaction, taskId);
  return { task, nicknames: task.assignees.map((a) => a.nickname) };
}

export async function listSpaceTasks(space) {
  return listTasks(await getPool(), space);
}

export async function getTaskLogs(userId, taskId) {
  const pool = await getPool();
  await checkRowSpace(userId, await findTaskRow(pool, taskId));
  const logs = await pool.request().input('taskId', sql.BigInt, taskId)
    .query(`SELECT id, log_type, before_status, nickname, title, content, start_date, end_date, start_time, end_time, status,
              is_period_undecided, is_content_changed, is_assignee_changed, create_date
            FROM task_logs WHERE task_id = @taskId ORDER BY create_date DESC, id DESC`);
  const names = await pool.request().input('taskId', sql.BigInt, taskId)
    .query(`SELECT la.task_log_id, la.nickname FROM task_log_assignees la JOIN task_logs l ON l.id = la.task_log_id
            WHERE l.task_id = @taskId ORDER BY la.id`);
  const byLog = new Map();
  names.recordset.forEach((row) => {
    const key = Number(row.task_log_id);
    byLog.set(key, [...(byLog.get(key) ?? []), row.nickname]);
  });
  return logs.recordset.map((row) => ({
    logId: Number(row.id),
    logType: row.log_type,
    isContentChanged: Boolean(row.is_content_changed),
    isAssigneeChanged: Boolean(row.is_assignee_changed),
    beforeStatus: row.before_status,
    nickname: row.nickname,
    ...toPeriod(row),
    status: row.status,
    assigneeNicknames: byLog.get(Number(row.id)) ?? [],
    createDate: row.create_date.toISOString(),
  }));
}

// 작업자 확인: 개인 공간이면 빈 배열만, 팀 공간이면 그 팀의 지금 팀원만 (아니면 400)
async function checkAssignees(transaction, space, assigneeUserIds) {
  if (space.teamId === null) {
    if (assigneeUserIds.length > 0) {
      throw invalidInput();
    }
    return;
  }
  if (assigneeUserIds.length === 0) {
    return;
  }
  const request = new sql.Request(transaction).input('teamId', sql.BigInt, space.teamId);
  assigneeUserIds.forEach((id, index) => request.input(`u${index}`, sql.BigInt, id));
  const result = await request.query(`SELECT COUNT(*) AS n FROM team_members
    WHERE team_id = @teamId AND user_id IN (${assigneeUserIds.map((_, index) => `@u${index}`).join(', ')})`);
  if (result.recordset[0].n !== assigneeUserIds.length) {
    throw invalidInput();
  }
}

export async function updateTask(user, taskId, input, status, assigneeUserIds) {
  const notifiedUsers = new Set();
  const outcome = await withTransaction(async (transaction) => {
    const { space, row } = await lockTaskForChange(transaction, user.userId, taskId);
    await checkAssignees(transaction, space, assigneeUserIds);
    const before = toPeriod(row);
    const isContentChanged = ['title', 'content', ...PERIOD_KEYS].some((key) => before[key] !== input[key]);
    const isPeriodChanged = PERIOD_KEYS.some((key) => before[key] !== input[key]);
    const beforeAssignees = (await currentAssignees(transaction, taskId)).map((a) => a.userId);
    const isAssigneeChanged = beforeAssignees.length !== assigneeUserIds.length
      || beforeAssignees.some((id) => !assigneeUserIds.includes(id));
    const isStatusChanged = row.status !== status;
    if (!isContentChanged && !isAssigneeChanged && !isStatusChanged) {
      return { space, isChanged: false };
    }
    if (isContentChanged) {
      await bindPeriod(new sql.Request(transaction), input).input('id', sql.BigInt, taskId)
        .query(`UPDATE tasks SET title = @title, content = @content, start_date = CAST(@startDate AS DATE), end_date = CAST(@endDate AS DATE),
                  start_time = CAST(@startTime AS TIME(0)), end_time = CAST(@endTime AS TIME(0)),
                  is_period_undecided = @isUndecided, update_date = SYSUTCDATETIME()
                WHERE id = @id`);
    }
    if (isAssigneeChanged) {
      await new sql.Request(transaction).input('id', sql.BigInt, taskId)
        .query('DELETE FROM task_assignees WHERE task_id = @id; UPDATE tasks SET update_date = SYSUTCDATETIME() WHERE id = @id;');
      for (const assigneeId of assigneeUserIds) {
        await new sql.Request(transaction).input('taskId', sql.BigInt, taskId).input('userId', sql.BigInt, assigneeId)
          .query('INSERT INTO task_assignees (task_id, user_id) VALUES (@taskId, @userId)');
      }
      // 새로 들어간 작업자 중 나 아닌 회원에게 작업자 지정 알림 (D-127)
      for (const assigneeId of assigneeUserIds.filter((id) => !beforeAssignees.includes(id) && id !== user.userId)) {
        await new sql.Request(transaction)
          .input('sender', sql.NVarChar(8), user.nickname).input('userId', sql.BigInt, assigneeId)
          .input('senderId', sql.BigInt, user.userId).input('teamId', sql.BigInt, space.teamId).input('taskId', sql.BigInt, taskId)
          .query(`INSERT INTO notifications (notification_type, sender_nickname, user_id, sender_user_id, team_id, task_id)
                  VALUES ('task_assigned', @sender, @userId, @senderId, @teamId, @taskId)`);
        notifiedUsers.add(assigneeId);
      }
      const removed = beforeAssignees.filter((id) => !assigneeUserIds.includes(id));
      (await deleteDueSoon(transaction, taskId, removed)).forEach((id) => notifiedUsers.add(id));
    }
    if (isStatusChanged) {
      await changeStatus(transaction, space, row, status, 0);
    }
    // 완료로 바뀌거나 기간이 바뀌면 그 작업의 마감 임박 알림을 지운다 (D-128)
    if ((isStatusChanged && status === 'done') || isPeriodChanged) {
      (await deleteDueSoon(transaction, taskId)).forEach((id) => notifiedUsers.add(id));
    }
    const { task, nicknames } = await snapshotOf(transaction, taskId);
    await writeTaskLog(transaction, {
      taskId, logType: 'change', nickname: user.nickname, snapshot: task, assigneeNicknames: nicknames,
      beforeStatus: isStatusChanged ? row.status : null, isContentChanged, isAssigneeChanged,
    });
    return { space, isChanged: true };
  });
  for (const id of notifiedUsers) {
    await notifyUnreadChanged(id);
  }
  if (outcome.isChanged) {
    emitTasks(outcome.space, [taskId], 'update', user.userId);
  }
  return { task: await getTask(await getPool(), taskId), isChanged: outcome.isChanged };
}

export async function moveTask(user, taskId, status, index) {
  const notifiedUsers = [];
  const space = await withTransaction(async (transaction) => {
    const { space: taskSpace, row } = await lockTaskForChange(transaction, user.userId, taskId);
    if (row.status === status) {
      // 같은 공간 안 순서 변경: 수정 내역·수정 시각을 남기지 않는다 (D-013)
      await placeInStatus(transaction, taskSpace, status, taskId, index);
      return taskSpace;
    }
    await changeStatus(transaction, taskSpace, row, status, index);
    if (status === 'done') {
      notifiedUsers.push(...await deleteDueSoon(transaction, taskId));
    }
    const { task, nicknames } = await snapshotOf(transaction, taskId);
    await writeTaskLog(transaction, {
      taskId, logType: 'change', nickname: user.nickname, snapshot: task, assigneeNicknames: nicknames, beforeStatus: row.status,
    });
    return taskSpace;
  });
  for (const id of new Set(notifiedUsers)) {
    await notifyUnreadChanged(id);
  }
  emitTasks(space, [taskId], 'move', user.userId);
  return listTasks(await getPool(), space);
}

export async function deleteTask(userId, taskId) {
  const { space, notifiedUsers } = await withTransaction(async (transaction) => {
    const { space: taskSpace, row } = await lockTaskForChange(transaction, userId, taskId);
    // 작업과 이어진 알림을 먼저 지운다 (database.md notifications)
    const removed = await new sql.Request(transaction).input('id', sql.BigInt, taskId)
      .query('DELETE FROM notifications OUTPUT deleted.user_id WHERE task_id = @id');
    await new sql.Request(transaction).input('id', sql.BigInt, taskId).query('DELETE FROM tasks WHERE id = @id');
    await placeInStatus(transaction, taskSpace, row.status, null);
    return { space: taskSpace, notifiedUsers: removed.recordset.map((r) => Number(r.user_id)) };
  });
  for (const id of new Set(notifiedUsers)) {
    await notifyUnreadChanged(id);
  }
  emitTasks(space, [taskId], 'delete', userId);
  return { isDeleted: true };
}
