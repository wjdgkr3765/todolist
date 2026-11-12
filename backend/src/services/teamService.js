// 팀 목록·만들기·순서 (api.md 6.6, D-071, D-073, D-078, D-089, D-152)
import { getPool, withTransaction, sql } from '../config/db.js';
import { AppError, notFound } from '../utils/appError.js';
import { DEFAULT_REPORT_HEADER, DEFAULT_REPORT_SECTIONS } from '../utils/reportDefaults.js';
import { emitToUser, joinTeamRoom } from '../realtime/index.js';

export const TEAM_LIMIT = 20;

export function toTeam(row) {
  return { teamId: Number(row.team_id), name: row.name, myRole: row.role };
}

export function teamLimitError(message) {
  return new AppError(409, 'TEAM_LIMIT_EXCEEDED', message);
}

const LIST_SQL = `SELECT m.team_id, t.name, m.role
                  FROM team_members m JOIN teams t ON t.id = m.team_id
                  WHERE m.user_id = @userId
                  ORDER BY m.sort_order, m.create_date DESC, m.id DESC`;

export async function listTeams(userId, runner = null) {
  const request = runner ? new sql.Request(runner) : (await getPool()).request();
  const result = await request.input('userId', sql.BigInt, userId).query(LIST_SQL);
  return result.recordset.map(toTeam);
}

// 내가 속한 팀이면 { teamId, name, myRole }, 아니면 404 (팀 공통)
export async function getMyTeam(userId, teamId, runner = null) {
  const request = runner ? new sql.Request(runner) : (await getPool()).request();
  const result = await request.input('userId', sql.BigInt, userId).input('teamId', sql.BigInt, teamId)
    .query(`SELECT m.team_id, t.name, m.role FROM team_members m JOIN teams t ON t.id = m.team_id
            WHERE m.user_id = @userId AND m.team_id = @teamId`);
  if (!result.recordset[0]) {
    throw notFound();
  }
  return toTeam(result.recordset[0]);
}

// 팀원 목록: 관리자 → 부관리자 → 팀원, 같은 역할은 먼저 합류한 순 (D-076)
export async function listMembers(userId, teamId) {
  await getMyTeam(userId, teamId);
  const pool = await getPool();
  const result = await pool.request().input('teamId', sql.BigInt, teamId)
    .query(`SELECT m.user_id, u.nickname, u.email, m.role, m.create_date
            FROM team_members m JOIN users u ON u.id = m.user_id
            WHERE m.team_id = @teamId
            ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.create_date, m.id`);
  return result.recordset.map((row) => ({
    userId: Number(row.user_id), nickname: row.nickname, email: row.email, role: row.role, joinDate: row.create_date.toISOString(),
  }));
}

// 내 users 행을 잠그고 가입된 팀 수를 센다 (D-078). 트랜잭션 안에서 부른다
export async function countMyTeamsLocked(transaction, userId) {
  const result = await new sql.Request(transaction).input('userId', sql.BigInt, userId)
    .query(`SELECT id FROM users WITH (UPDLOCK, HOLDLOCK) WHERE id = @userId;
            SELECT COUNT(*) AS team_count FROM team_members WHERE user_id = @userId;`);
  return result.recordsets[1][0].team_count;
}

// 내 팀 목록 맨 위(0)에 새 행을 넣고 다른 행은 1씩 민다 (D-089). 트랜잭션 안에서 부른다
export async function addMembershipOnTop(transaction, { userId, teamId, role }) {
  await new sql.Request(transaction).input('userId', sql.BigInt, userId)
    .query('UPDATE team_members SET sort_order = sort_order + 1 WHERE user_id = @userId');
  await new sql.Request(transaction)
    .input('userId', sql.BigInt, userId).input('teamId', sql.BigInt, teamId).input('role', sql.NVarChar(10), role)
    .query('INSERT INTO team_members (role, sort_order, team_id, user_id) VALUES (@role, 0, @teamId, @userId)');
}

export async function createTeam(userId, name) {
  const team = await withTransaction(async (transaction) => {
    if (await countMyTeamsLocked(transaction, userId) >= TEAM_LIMIT) {
      throw teamLimitError('가입된 팀이 20개라 더 만들 수 없습니다.');
    }
    const inserted = await new sql.Request(transaction).input('name', sql.NVarChar(20), name)
      .query('INSERT INTO teams (name) OUTPUT inserted.id VALUES (@name)');
    const teamId = Number(inserted.recordset[0].id);
    await addMembershipOnTop(transaction, { userId, teamId, role: 'owner' });
    await new sql.Request(transaction)
      .input('header', sql.NVarChar(100), DEFAULT_REPORT_HEADER)
      .input('sections', sql.NVarChar(sql.MAX), JSON.stringify(DEFAULT_REPORT_SECTIONS))
      .input('teamId', sql.BigInt, teamId)
      .query('INSERT INTO report_templates (header, sections, team_id) VALUES (@header, @sections, @teamId)');
    return { teamId, name, myRole: 'owner' };
  });
  joinTeamRoom(userId, team.teamId);
  emitToUser(userId, 'teams:changed', { teamId: team.teamId, reason: 'joined' });
  return team;
}

export async function moveTeam(userId, teamId, index) {
  return withTransaction(async (transaction) => {
    await countMyTeamsLocked(transaction, userId);
    const current = await listTeams(userId, transaction);
    const moving = current.find((team) => team.teamId === teamId);
    if (!moving) {
      throw notFound();
    }
    const others = current.filter((team) => team.teamId !== teamId);
    others.splice(Math.min(index, others.length), 0, moving);
    // 0 부터 빈틈없이 다시 매긴다
    for (const [order, team] of others.entries()) {
      await new sql.Request(transaction)
        .input('userId', sql.BigInt, userId).input('teamId', sql.BigInt, team.teamId).input('order', sql.Int, order)
        .query('UPDATE team_members SET sort_order = @order WHERE user_id = @userId AND team_id = @teamId');
    }
    return others;
  });
}
