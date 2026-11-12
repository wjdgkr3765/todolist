// 캘린더·히스토리 (api.md 6.9, 6.10, D-014, D-015, D-022, D-106, D-111, D-113)
import { getPool, sql } from '../config/db.js';
import { bindSpace, spaceCondition, toPeriod } from './spaceService.js';
import { HISTORY_SQL } from './taskCore.js';

const HISTORY_PAGE_SIZE = 20;

async function loadAssigneeMap(pool, taskIds) {
  const map = new Map(taskIds.map((id) => [id, []]));
  if (taskIds.length === 0) {
    return map;
  }
  const request = pool.request();
  taskIds.forEach((id, index) => request.input(`t${index}`, sql.BigInt, id));
  const result = await request.query(`SELECT a.task_id, a.user_id, u.nickname FROM task_assignees a JOIN users u ON u.id = a.user_id
    WHERE a.task_id IN (${taskIds.map((_, index) => `@t${index}`).join(', ')}) ORDER BY a.id`);
  result.recordset.forEach((row) => map.get(Number(row.task_id)).push({ userId: Number(row.user_id), nickname: row.nickname }));
  return map;
}

// 보이는 기간과 겹치는 작업 (기간 미정 제외). 시작일 → 긴 기간 → 작업 id 순
export async function listCalendarTasks(space, from, to) {
  const pool = await getPool();
  const result = await bindSpace(pool.request(), space)
    .input('from', sql.VarChar(10), from).input('to', sql.VarChar(10), to)
    .query(`SELECT id, title, content, start_date, end_date, start_time, end_time, status, is_period_undecided,
              CASE WHEN ${HISTORY_SQL} THEN 1 ELSE 0 END AS is_history
            FROM tasks
            WHERE ${spaceCondition(space)} AND is_period_undecided = 0
              AND start_date <= CAST(@to AS DATE) AND end_date >= CAST(@from AS DATE)
            ORDER BY start_date, DATEDIFF(DAY, start_date, end_date) DESC, id`);
  const assignees = await loadAssigneeMap(pool, result.recordset.map((row) => Number(row.id)));
  return result.recordset.map((row) => {
    const { isPeriodUndecided, ...period } = toPeriod(row);
    return {
      taskId: Number(row.id), ...period, status: row.status,
      assignees: assignees.get(Number(row.id)), isHistory: Boolean(row.is_history),
    };
  });
}

// 히스토리 작업: 완료 시각이 최근인 것이 위, 같으면 id 큰 것이 위. 한 페이지 20개
export async function listHistory(space, page) {
  const pool = await getPool();
  const result = await bindSpace(pool.request(), space)
    .input('offset', sql.Int, (page - 1) * HISTORY_PAGE_SIZE).input('size', sql.Int, HISTORY_PAGE_SIZE)
    .query(`SELECT COUNT(*) AS total FROM tasks WHERE ${spaceCondition(space)} AND ${HISTORY_SQL};
            SELECT id, title, content, start_date, end_date, start_time, end_time, is_period_undecided, done_date
            FROM tasks WHERE ${spaceCondition(space)} AND ${HISTORY_SQL}
            ORDER BY done_date DESC, id DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;`);
  const rows = result.recordsets[1];
  const assignees = await loadAssigneeMap(pool, rows.map((row) => Number(row.id)));
  return {
    tasks: rows.map((row) => ({
      taskId: Number(row.id), ...toPeriod(row), doneDate: row.done_date.toISOString(), assignees: assignees.get(Number(row.id)),
    })),
    totalCount: result.recordsets[0][0].total,
    page,
    pageSize: HISTORY_PAGE_SIZE,
  };
}
