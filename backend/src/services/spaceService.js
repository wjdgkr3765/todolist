// 공간 권한 (api.md 6.4 할일 공통): 개인 공간은 소유자만, 팀 공간은 그 팀의 팀원만. 아니면 404
import { sql } from '../config/db.js';
import { notFound } from '../utils/appError.js';
import { getMyTeam } from './teamService.js';
import { toDateText, toTimeText } from '../utils/koreaDate.js';

// space: { userId } (개인) 또는 { teamId } (팀)
export async function resolveSpace(userId, teamId = null) {
  if (teamId === null) {
    return { userId, teamId: null };
  }
  await getMyTeam(userId, teamId);
  return { userId: null, teamId };
}

// DB 행(user_id, team_id)의 공간에 접근할 수 있는지 확인하고 공간을 돌려준다
export async function checkRowSpace(userId, row, runner = null) {
  if (!row) {
    throw notFound();
  }
  if (row.user_id !== null && row.user_id !== undefined) {
    if (Number(row.user_id) !== userId) {
      throw notFound();
    }
    return { userId, teamId: null };
  }
  await getMyTeam(userId, Number(row.team_id), runner);
  return { userId: null, teamId: Number(row.team_id) };
}

// SQL 조건: 그 공간 (@spaceUserId / @spaceTeamId 를 넣어야 한다)
export function spaceCondition(space, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return space.teamId === null ? `${prefix}user_id = @spaceUserId` : `${prefix}team_id = @spaceTeamId`;
}

export function bindSpace(request, space) {
  return space.teamId === null
    ? request.input('spaceUserId', sql.BigInt, space.userId)
    : request.input('spaceTeamId', sql.BigInt, space.teamId);
}

// 기간 값 넣기: DATE·TIME 은 문자열로 넘기고 SQL 에서 CAST 한다 (시간대 변환 방지)
export function bindPeriod(request, input) {
  return request
    .input('title', sql.NVarChar(50), input.title)
    .input('content', sql.NVarChar(2000), input.content)
    .input('startDate', sql.VarChar(10), input.startDate)
    .input('endDate', sql.VarChar(10), input.endDate)
    .input('startTime', sql.VarChar(5), input.startTime)
    .input('endTime', sql.VarChar(5), input.endTime)
    .input('isUndecided', sql.Bit, input.isPeriodUndecided);
}

export const PERIOD_VALUES_SQL = `@title, @content, CAST(@startDate AS DATE), CAST(@endDate AS DATE),
  CAST(@startTime AS TIME(0)), CAST(@endTime AS TIME(0))`;

export function toPeriod(row) {
  return {
    title: row.title,
    content: row.content,
    startDate: toDateText(row.start_date),
    endDate: toDateText(row.end_date),
    startTime: toTimeText(row.start_time),
    endTime: toTimeText(row.end_time),
    isPeriodUndecided: Boolean(row.is_period_undecided),
  };
}
