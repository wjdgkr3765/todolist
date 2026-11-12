// 회원정보 수정/탈퇴 (api.md 6.11, D-021, D-041, D-129~D-131, D-160)
import { getPool, withTransaction, isUniqueViolation, sql } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { closeTeamRoom, emitToTeam, emitToUser } from '../realtime/index.js';
import { checkPasswordWithLimit } from './sessionService.js';
import { removeFromAssignees } from './teamManageService.js';

const PASSWORD_HASH_ROUNDS = 10;
const currentPasswordMismatch = () => new AppError(400, 'CURRENT_PASSWORD_MISMATCH', '현재 비밀번호가 맞지 않습니다.');

function toMe(row) {
  return { loginId: row.login_id, nickname: row.nickname, email: row.email, phone: row.phone, createDate: row.create_date.toISOString() };
}

export async function getMe(userId, runner = null) {
  const request = runner ? new sql.Request(runner) : (await getPool()).request();
  const result = await request.input('id', sql.BigInt, userId)
    .query('SELECT login_id, nickname, email, phone, create_date FROM users WHERE id = @id');
  return toMe(result.recordset[0]);
}

export async function changeNickname(userId, nickname) {
  const pool = await getPool();
  await pool.request().input('id', sql.BigInt, userId).input('nickname', sql.NVarChar(8), nickname)
    .query('UPDATE users SET nickname = @nickname WHERE id = @id');
  return getMe(userId);
}

export async function changePhone(userId, phone) {
  const pool = await getPool();
  const used = await pool.request().input('id', sql.BigInt, userId).input('phone', sql.NVarChar(11), phone)
    .query('SELECT TOP 1 id FROM users WHERE phone = @phone AND id <> @id');
  const duplicated = () => new AppError(409, 'PHONE_DUPLICATED', '이미 가입된 전화번호입니다.');
  if (used.recordset.length > 0) {
    throw duplicated();
  }
  try {
    await pool.request().input('id', sql.BigInt, userId).input('phone', sql.NVarChar(11), phone)
      .query('UPDATE users SET phone = @phone WHERE id = @id AND phone <> @phone');
  } catch (error) {
    throw isUniqueViolation(error) ? duplicated() : error;
  }
  return getMe(userId);
}

export async function changeEmail(userId, email, verificationId) {
  const pool = await getPool();
  const verified = await pool.request().input('id', sql.BigInt, verificationId).input('email', sql.NVarChar(100), email)
    .query(`SELECT TOP 1 id FROM email_verifications
            WHERE id = @id AND email = @email AND purpose = 'change_email' AND is_verified = 1
              AND verify_date > DATEADD(MINUTE, -30, SYSUTCDATETIME())`);
  if (verified.recordset.length === 0) {
    throw new AppError(400, 'EMAIL_NOT_VERIFIED', '이메일 인증을 완료해 주세요.');
  }
  try {
    await withTransaction(async (transaction) => {
      await new sql.Request(transaction).input('id', sql.BigInt, userId).input('email', sql.NVarChar(100), email)
        .input('verificationId', sql.BigInt, verificationId)
        .query(`UPDATE users SET email = @email WHERE id = @id;
                DELETE FROM email_verifications WHERE id = @verificationId;`);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
    }
    throw error;
  }
  return getMe(userId);
}

// 현재 비밀번호 확인 (로그인과 같은 실패 제한, D-130). 맞으면 틀린 횟수를 0으로
async function checkCurrentPassword(pool, userId, password) {
  const found = await pool.request().input('id', sql.BigInt, userId).query('SELECT id, password_hash FROM users WHERE id = @id');
  if (!(await checkPasswordWithLimit(pool, found.recordset[0], password))) {
    throw currentPasswordMismatch();
  }
  await pool.request().input('id', sql.BigInt, userId)
    .query('UPDATE users SET login_fail_count = 0, lock_expire_date = NULL WHERE id = @id');
}

export async function changePassword(userId, currentPassword, newPassword) {
  const pool = await getPool();
  await checkCurrentPassword(pool, userId, currentPassword);
  const bcrypt = (await import('bcrypt')).default;
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
  await pool.request().input('id', sql.BigInt, userId).input('hash', sql.NVarChar(60), passwordHash)
    .query('UPDATE users SET password_hash = @hash WHERE id = @id');
  return { isChanged: true };
}

// 내가 관리자이고 다른 팀원이 있는 팀 / 나 혼자인 팀 (D-131)
async function findTeamsForWithdrawal(runner, userId) {
  const request = runner.request ? runner.request() : new sql.Request(runner);
  const result = await request.input('userId', sql.BigInt, userId)
    .query(`SELECT m.team_id, t.name, m.role, (SELECT COUNT(*) FROM team_members x WHERE x.team_id = m.team_id) AS member_count
            FROM team_members m JOIN teams t ON t.id = m.team_id
            WHERE m.user_id = @userId ORDER BY m.sort_order, m.id`);
  const toTeam = (row) => ({ teamId: Number(row.team_id), name: row.name });
  return {
    blockingTeams: result.recordset.filter((row) => row.role === 'owner' && row.member_count > 1).map(toTeam),
    soloTeams: result.recordset.filter((row) => row.member_count === 1).map(toTeam),
    otherTeams: result.recordset.filter((row) => row.member_count > 1 && row.role !== 'owner').map(toTeam),
  };
}

export async function withdrawalCheck(userId) {
  const { blockingTeams, soloTeams } = await findTeamsForWithdrawal(await getPool(), userId);
  return { blockingTeams, soloTeams };
}

// 회원 탈퇴 (api.md POST /api/users/me/withdraw 처리 순서 1~7)
export async function withdraw(user, password) {
  const pool = await getPool();
  await checkCurrentPassword(pool, user.userId, password);
  const outcome = await withTransaction(async (transaction) => {
    const run = () => new sql.Request(transaction).input('userId', sql.BigInt, user.userId);
    await run().query(`SELECT id FROM users WITH (UPDLOCK, HOLDLOCK) WHERE id = @userId;
                       SELECT id FROM team_members WITH (UPDLOCK, HOLDLOCK) WHERE user_id = @userId;`);
    const teams = await findTeamsForWithdrawal(transaction, user.userId);
    // 1. 다른 팀원이 있는 팀의 관리자면 탈퇴할 수 없다
    if (teams.blockingTeams.length > 0) {
      const error = new AppError(409, 'TEAM_OWNER_CANNOT_WITHDRAW', '관리자인 팀이 있습니다. 먼저 관리자를 넘겨 주세요.');
      error.extra = { teams: teams.blockingTeams };
      throw error;
    }
    // 2. 나 혼자인 팀은 해체한다 (작업 알림을 먼저 지운다)
    for (const team of teams.soloTeams) {
      await new sql.Request(transaction).input('teamId', sql.BigInt, team.teamId)
        .query(`DELETE FROM notifications WHERE team_id = @teamId OR task_id IN (SELECT id FROM tasks WHERE team_id = @teamId);
                DELETE FROM teams WHERE id = @teamId;`);
    }
    // 3. 남은 팀은 작업자에서 빼고 기록 (닉네임은 탈퇴하는 회원) → 팀원 행 삭제
    const changedTeams = [];
    for (const team of teams.otherTeams) {
      const taskIds = await removeFromAssignees(transaction, team.teamId, user.userId, user.nickname);
      if (taskIds.length > 0) {
        changedTeams.push({ teamId: team.teamId, taskIds });
      }
    }
    await run().query(`
      DELETE FROM team_members WHERE user_id = @userId;
      -- 4. 받은 알림 삭제, 보낸 알림은 보낸 회원만 비운다
      DELETE FROM notifications WHERE user_id = @userId;
      UPDATE notifications SET sender_user_id = NULL WHERE sender_user_id = @userId;
      -- 5. 개인 작업의 알림 → 개인 작업(수정 내역 함께) → 개인 할일
      DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE user_id = @userId);
      DELETE FROM tasks WHERE user_id = @userId;
      DELETE FROM todos WHERE user_id = @userId;
      -- 6. 일일보고: 임시저장은 지우고 제출한 보고는 남긴다 (D-160)
      DELETE FROM daily_reports WHERE user_id = @userId AND status = 'draft';
      UPDATE daily_reports SET user_id = NULL WHERE user_id = @userId;
      -- 7. 거절 기록, 로그인, 인증 기록 → 회원
      DELETE FROM task_assignees WHERE user_id = @userId;
      DELETE FROM team_invite_declines WHERE user_id = @userId;
      DELETE FROM login_tokens WHERE user_id = @userId;
      DELETE FROM email_verifications WHERE email = (SELECT email FROM users WHERE id = @userId);
      DELETE FROM users WHERE id = @userId;`);
    return { soloTeams: teams.soloTeams, changedTeams };
  });
  outcome.soloTeams.forEach((team) => {
    emitToUser(user.userId, 'teams:changed', { teamId: team.teamId, reason: 'dissolved' });
    closeTeamRoom(team.teamId);
  });
  outcome.changedTeams.forEach(({ teamId, taskIds }) => {
    emitToTeam(teamId, 'team:tasks-changed', { teamId, taskIds, action: 'assignee-removed', actorUserId: user.userId });
  });
  return { isWithdrawn: true };
}
