// 알림 목록·읽음·지우기·초대 수락/거절 (api.md 6.7, D-089, D-095, D-096, D-121, D-127, D-128, D-138)
import { getPool, withTransaction, isUniqueViolation, sql } from '../config/db.js';
import { invalidInput, notFound } from '../utils/appError.js';
import { addDays, koreaTime, koreaToday, toDateText, toTimeText } from '../utils/koreaDate.js';
import { emitToUser, joinTeamRoom } from '../realtime/index.js';
import {
  TEAM_LIMIT, addMembershipOnTop, countMyTeamsLocked, getMyTeam, teamLimitError,
} from './teamService.js';

function toNotification(row) {
  return {
    notificationId: Number(row.id),
    notificationType: row.notification_type,
    teamId: row.team_id === null ? null : Number(row.team_id),
    teamName: row.team_name,
    taskId: row.task_id === null ? null : Number(row.task_id),
    taskTitle: row.task_title,
    taskEndDate: row.notification_type === 'due_soon' ? toDateText(row.task_end_date) : null,
    taskEndTime: row.notification_type === 'due_soon' ? toTimeText(row.task_end_time) : null,
    senderNickname: row.sender_nickname,
    isRead: Boolean(row.is_read),
    createDate: row.create_date.toISOString(),
  };
}

export async function countUnread(userId, runner = null) {
  const request = runner ? new sql.Request(runner) : (await getPool()).request();
  const result = await request.input('userId', sql.BigInt, userId)
    .query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = @userId AND is_read = 0');
  return result.recordset[0].n;
}

// 그 회원의 모든 탭에 안 본 알림 개수를 알린다 (api.md 6.8 notifications:changed)
export async function notifyUnreadChanged(userId) {
  try {
    emitToUser(userId, 'notifications:changed', { unreadCount: await countUnread(userId) });
  } catch (error) {
    console.error('알림 개수 알리기 실패:', error?.name);
  }
}

// 마감 임박 알림 만들기 (D-128, D-138): 오늘(한국 시간)이 종료일 전날이거나 종료일이고, 아직 기한 지남이 아닌 대기·진행 작업
async function createDueSoonNotifications(pool, userId) {
  const today = koreaToday();
  const tomorrow = addDays(today, 1);
  const nowTime = koreaTime();
  const targets = await pool.request()
    .input('userId', sql.BigInt, userId)
    .input('today', sql.Date, today)
    .input('tomorrow', sql.Date, tomorrow)
    .input('nowTime', sql.VarChar(8), nowTime)
    .query(`SELECT t.id, t.team_id FROM tasks t
            WHERE t.status IN ('waiting', 'progress') AND t.is_period_undecided = 0
              AND (t.end_date = @tomorrow
                   OR (t.end_date = @today AND (t.end_time IS NULL OR t.end_time > CAST(@nowTime AS TIME(0)))))
              AND (t.user_id = @userId
                   OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = @userId))
              AND NOT EXISTS (SELECT 1 FROM notifications n
                              WHERE n.user_id = @userId AND n.task_id = t.id AND n.notification_type = 'due_soon')`);
  for (const task of targets.recordset) {
    try {
      await pool.request()
        .input('userId', sql.BigInt, userId).input('taskId', sql.BigInt, task.id).input('teamId', sql.BigInt, task.team_id)
        .query(`INSERT INTO notifications (notification_type, user_id, team_id, task_id)
                VALUES ('due_soon', @userId, @teamId, @taskId)`);
    } catch (error) {
      // 동시 요청으로 이미 만들어졌으면 무시한다
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
}

export async function listNotifications(userId) {
  const pool = await getPool();
  await createDueSoonNotifications(pool, userId);
  const result = await pool.request().input('userId', sql.BigInt, userId)
    .query(`SELECT n.id, n.notification_type, n.team_id, tm.name AS team_name, n.task_id, tk.title AS task_title,
                   tk.end_date AS task_end_date, tk.end_time AS task_end_time, n.sender_nickname, n.is_read, n.create_date
            FROM notifications n
              LEFT JOIN teams tm ON tm.id = n.team_id
              LEFT JOIN tasks tk ON tk.id = n.task_id
            WHERE n.user_id = @userId
            ORDER BY n.create_date DESC, n.id DESC`);
  const notifications = result.recordset.map(toNotification);
  return { notifications, unreadCount: notifications.filter((item) => !item.isRead).length };
}

export async function markAllRead(userId) {
  const pool = await getPool();
  await pool.request().input('userId', sql.BigInt, userId)
    .query('UPDATE notifications SET is_read = 1 WHERE user_id = @userId AND is_read = 0');
  await notifyUnreadChanged(userId);
  return { unreadCount: 0 };
}

async function findMyNotification(runner, userId, notificationId, { isLocked = false } = {}) {
  const request = runner.request ? runner.request() : new sql.Request(runner);
  const result = await request.input('id', sql.BigInt, notificationId).input('userId', sql.BigInt, userId)
    .query(`SELECT id, notification_type, team_id FROM notifications ${isLocked ? 'WITH (UPDLOCK, HOLDLOCK)' : ''}
            WHERE id = @id AND user_id = @userId`);
  if (!result.recordset[0]) {
    throw notFound();
  }
  return result.recordset[0];
}

// 작업자 지정·마감 임박 알림만 [X] 로 지운다. 팀 초대는 400
export async function deleteNotification(userId, notificationId) {
  const pool = await getPool();
  const found = await findMyNotification(pool, userId, notificationId);
  if (found.notification_type === 'team_invite') {
    throw invalidInput();
  }
  await pool.request().input('id', sql.BigInt, notificationId)
    .query('DELETE FROM notifications WHERE id = @id');
  await notifyUnreadChanged(userId);
  return { unreadCount: await countUnread(userId) };
}

async function findInvite(transaction, userId, notificationId) {
  const found = await findMyNotification(transaction, userId, notificationId, { isLocked: true });
  if (found.notification_type !== 'team_invite') {
    throw invalidInput();
  }
  return Number(found.team_id);
}

export async function acceptInvite(userId, notificationId) {
  const team = await withTransaction(async (transaction) => {
    const teamCount = await countMyTeamsLocked(transaction, userId);
    const teamId = await findInvite(transaction, userId, notificationId);
    const deleteInvite = () => new sql.Request(transaction).input('id', sql.BigInt, notificationId)
      .query('DELETE FROM notifications WHERE id = @id');
    // 다른 경로로 먼저 가입했으면 알림만 지운다
    const member = await new sql.Request(transaction).input('userId', sql.BigInt, userId).input('teamId', sql.BigInt, teamId)
      .query('SELECT id FROM team_members WHERE user_id = @userId AND team_id = @teamId');
    if (member.recordset.length > 0) {
      await deleteInvite();
      return getMyTeam(userId, teamId, transaction);
    }
    if (teamCount >= TEAM_LIMIT) {
      throw teamLimitError('가입된 팀이 20개라 더 가입할 수 없습니다.');
    }
    await addMembershipOnTop(transaction, { userId, teamId, role: 'member' });
    await deleteInvite();
    return getMyTeam(userId, teamId, transaction);
  });
  joinTeamRoom(userId, team.teamId);
  emitToUser(userId, 'teams:changed', { teamId: team.teamId, reason: 'joined' });
  await notifyUnreadChanged(userId);
  return team;
}

export async function declineInvite(userId, notificationId) {
  await withTransaction(async (transaction) => {
    const teamId = await findInvite(transaction, userId, notificationId);
    await new sql.Request(transaction).input('id', sql.BigInt, notificationId)
      .query('DELETE FROM notifications WHERE id = @id');
    // 24시간 지난 거절 기록을 지우고(D-122), 같은 팀·회원의 기록은 새로 남긴다 (D-121)
    await new sql.Request(transaction).input('userId', sql.BigInt, userId).input('teamId', sql.BigInt, teamId)
      .query(`DELETE FROM team_invite_declines
              WHERE create_date <= DATEADD(HOUR, -24, SYSUTCDATETIME()) OR (team_id = @teamId AND user_id = @userId);
              INSERT INTO team_invite_declines (team_id, user_id) VALUES (@teamId, @userId);`);
  });
  await notifyUnreadChanged(userId);
  return { isDeclined: true };
}
