// 팀 초대·초대 목록·초대 취소 (api.md 6.7, D-008, D-009, D-092, D-093, D-120, D-121, D-122)
import { getPool, isUniqueViolation, sql } from '../config/db.js';
import { sendMail } from '../config/mail.js';
import { AppError, notFound } from '../utils/appError.js';
import { buildTeamInviteMail } from '../utils/mailTemplate.js';
import { getMyTeam } from './teamService.js';
import { notifyUnreadChanged } from './notificationService.js';

const invitationDuplicated = () => new AppError(409, 'INVITATION_DUPLICATED', '이미 초대한 회원입니다.');

export async function inviteMember(user, teamId, email) {
  const team = await getMyTeam(user.userId, teamId);
  const pool = await getPool();
  const found = await pool.request().input('email', sql.NVarChar(100), email)
    .query('SELECT id FROM users WHERE email = @email');
  if (!found.recordset[0]) {
    throw new AppError(404, 'USER_NOT_FOUND', '가입된 회원이 아닙니다.');
  }
  const targetUserId = Number(found.recordset[0].id);
  const state = await pool.request().input('teamId', sql.BigInt, teamId).input('userId', sql.BigInt, targetUserId)
    .query(`DELETE FROM team_invite_declines WHERE create_date <= DATEADD(HOUR, -24, SYSUTCDATETIME());
            SELECT
              CASE WHEN EXISTS (SELECT 1 FROM team_members WHERE team_id = @teamId AND user_id = @userId) THEN 1 ELSE 0 END AS is_member,
              CASE WHEN EXISTS (SELECT 1 FROM notifications WHERE team_id = @teamId AND user_id = @userId AND notification_type = 'team_invite') THEN 1 ELSE 0 END AS is_invited,
              CASE WHEN EXISTS (SELECT 1 FROM team_invite_declines WHERE team_id = @teamId AND user_id = @userId) THEN 1 ELSE 0 END AS is_declined`);
  const row = state.recordset[0];
  if (row.is_member) {
    throw new AppError(409, 'ALREADY_TEAM_MEMBER', '이미 팀원인 회원입니다.');
  }
  if (row.is_invited) {
    throw invitationDuplicated();
  }
  if (row.is_declined) {
    throw new AppError(429, 'INVITATION_RECENTLY_DECLINED', '초대를 거절한 회원입니다. 거절한 때부터 24시간 뒤에 다시 초대할 수 있습니다.');
  }
  try {
    await pool.request()
      .input('sender', sql.NVarChar(8), user.nickname).input('userId', sql.BigInt, targetUserId)
      .input('senderId', sql.BigInt, user.userId).input('teamId', sql.BigInt, teamId)
      .query(`INSERT INTO notifications (notification_type, sender_nickname, user_id, sender_user_id, team_id)
              VALUES ('team_invite', @sender, @userId, @senderId, @teamId)`);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw invitationDuplicated();
    }
    throw error;
  }
  await notifyUnreadChanged(targetUserId);
  // 메일을 못 보내도 초대는 유효하다 (수락·거절은 사이트 알림에서)
  let isMailSent = true;
  try {
    await sendMail({ to: email, ...buildTeamInviteMail(user.nickname, team.name) });
  } catch (error) {
    console.error('초대 안내 메일 발송 실패:', error.code ?? error.name);
    isMailSent = false;
  }
  return { isMailSent };
}

export async function listInvitations(userId, teamId) {
  const team = await getMyTeam(userId, teamId);
  const pool = await getPool();
  const result = await pool.request().input('teamId', sql.BigInt, teamId)
    .query(`SELECT n.id, u.nickname, u.email, n.sender_nickname, n.sender_user_id, n.create_date
            FROM notifications n JOIN users u ON u.id = n.user_id
            WHERE n.team_id = @teamId AND n.notification_type = 'team_invite'
            ORDER BY n.create_date DESC, n.id DESC`);
  const isManager = team.myRole !== 'member';
  return result.recordset.map((row) => ({
    notificationId: Number(row.id),
    nickname: row.nickname,
    email: row.email,
    senderNickname: row.sender_nickname,
    canCancel: isManager || Number(row.sender_user_id) === userId,
    createDate: row.create_date.toISOString(),
  }));
}

export async function cancelInvitation(userId, teamId, notificationId) {
  const team = await getMyTeam(userId, teamId);
  const pool = await getPool();
  const found = await pool.request().input('id', sql.BigInt, notificationId).input('teamId', sql.BigInt, teamId)
    .query(`SELECT user_id, sender_user_id FROM notifications
            WHERE id = @id AND team_id = @teamId AND notification_type = 'team_invite'`);
  const invite = found.recordset[0];
  if (!invite) {
    throw notFound();
  }
  if (team.myRole === 'member' && Number(invite.sender_user_id) !== userId) {
    throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.');
  }
  const deleted = await pool.request().input('id', sql.BigInt, notificationId).query('DELETE FROM notifications WHERE id = @id');
  if (deleted.rowsAffected[0] === 0) {
    throw notFound();
  }
  await notifyUnreadChanged(Number(invite.user_id));
  return listInvitations(userId, teamId);
}
