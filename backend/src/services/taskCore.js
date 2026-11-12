// 작업 공통 처리: 조회, 공간 잠금, 순서 매기기, 수정 내역 저장 (api.md 6.5)
import { sql } from '../config/db.js';
import { bindSpace, spaceCondition, toPeriod } from './spaceService.js';

// 히스토리 작업: 완료 + 완료 시각부터 7일 지남 (D-015, D-113)
export const HISTORY_SQL = "(status = 'done' AND done_date <= DATEADD(DAY, -7, SYSUTCDATETIME()))";
const TASK_COLUMNS = `id, title, content, start_date, end_date, start_time, end_time, status, sort_order,
  user_id, team_id, is_period_undecided, done_date, update_date, create_date`;
const STATUS_ORDER = "CASE status WHEN 'waiting' THEN 0 WHEN 'progress' THEN 1 ELSE 2 END";

const requestOf = (runner) => (runner.request ? runner.request() : new sql.Request(runner));

export function isHistoryRow(row, now = Date.now()) {
  return row.status === 'done' && row.done_date && now - row.done_date.getTime() >= 7 * 24 * 60 * 60 * 1000;
}

function toTask(row, assignees) {
  return {
    taskId: Number(row.id),
    ...toPeriod(row),
    status: row.status,
    sortOrder: row.sort_order,
    assignees,
    doneDate: row.done_date ? row.done_date.toISOString() : null,
    updateDate: row.update_date ? row.update_date.toISOString() : null,
    createDate: row.create_date.toISOString(),
  };
}

async function loadAssignees(runner, taskIds) {
  const map = new Map(taskIds.map((id) => [id, []]));
  if (taskIds.length === 0) {
    return map;
  }
  const request = requestOf(runner);
  taskIds.forEach((id, index) => request.input(`t${index}`, sql.BigInt, id));
  const result = await request.query(`SELECT a.task_id, a.user_id, u.nickname FROM task_assignees a JOIN users u ON u.id = a.user_id
    WHERE a.task_id IN (${taskIds.map((_, index) => `@t${index}`).join(', ')}) ORDER BY a.id`);
  result.recordset.forEach((row) => {
    map.get(Number(row.task_id)).push({ userId: Number(row.user_id), nickname: row.nickname });
  });
  return map;
}

export async function findTaskRow(runner, taskId, { isLocked = false } = {}) {
  const result = await requestOf(runner).input('id', sql.BigInt, taskId)
    .query(`SELECT ${TASK_COLUMNS} FROM tasks ${isLocked ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = @id`);
  return result.recordset[0] ?? null;
}

export async function getTask(runner, taskId) {
  const row = await findTaskRow(runner, taskId);
  const assignees = await loadAssignees(runner, [Number(row.id)]);
  return toTask(row, assignees.get(Number(row.id)));
}

// 공간의 작업 목록 (히스토리 제외). 대기 → 진행 → 완료, 같은 상태 안은 sortOrder 순
export async function listTasks(runner, space) {
  const result = await bindSpace(requestOf(runner), space)
    .query(`SELECT ${TASK_COLUMNS} FROM tasks WHERE ${spaceCondition(space)} AND NOT ${HISTORY_SQL}
            ORDER BY ${STATUS_ORDER}, sort_order, id`);
  const assignees = await loadAssignees(runner, result.recordset.map((row) => Number(row.id)));
  return result.recordset.map((row) => toTask(row, assignees.get(Number(row.id))));
}

// 공간의 작업 범위를 잠근다 (순서를 바꾸는 처리 전에, 트랜잭션 안에서)
export async function lockSpaceTasks(transaction, space) {
  await bindSpace(new sql.Request(transaction), space)
    .query(`SELECT id FROM tasks WITH (UPDLOCK, HOLDLOCK) WHERE ${spaceCondition(space)}`);
}

// 그 공간·상태에서 taskId 를 index 자리에 놓고 0 부터 빈틈없이 다시 매긴다 (히스토리 제외). taskId 가 null 이면 다시 매기기만
export async function placeInStatus(transaction, space, status, taskId, index = 0) {
  const result = await bindSpace(new sql.Request(transaction), space).input('status', sql.NVarChar(10), status)
    .query(`SELECT id FROM tasks WHERE ${spaceCondition(space)} AND status = @status AND NOT ${HISTORY_SQL}
            ORDER BY sort_order, id`);
  const ids = result.recordset.map((row) => Number(row.id)).filter((id) => id !== taskId);
  if (taskId !== null) {
    ids.splice(Math.min(index, ids.length), 0, taskId);
  }
  for (const [order, id] of ids.entries()) {
    await new sql.Request(transaction).input('id', sql.BigInt, id).input('order', sql.Int, order)
      .query('UPDATE tasks SET sort_order = @order WHERE id = @id AND sort_order <> @order');
  }
}

export async function currentAssignees(runner, taskId) {
  return (await loadAssignees(runner, [taskId])).get(taskId);
}

// 수정 내역 한 줄 + 그 시점 작업자 닉네임 (D-065, D-099)
export async function writeTaskLog(transaction, {
  taskId, logType, nickname, snapshot, assigneeNicknames,
  beforeStatus = null, isContentChanged = false, isAssigneeChanged = false,
}) {
  const inserted = await new sql.Request(transaction)
    .input('logType', sql.NVarChar(10), logType)
    .input('beforeStatus', sql.NVarChar(10), beforeStatus)
    .input('nickname', sql.NVarChar(8), nickname)
    .input('title', sql.NVarChar(50), snapshot.title)
    .input('content', sql.NVarChar(2000), snapshot.content)
    .input('startDate', sql.VarChar(10), snapshot.startDate)
    .input('endDate', sql.VarChar(10), snapshot.endDate)
    .input('startTime', sql.VarChar(5), snapshot.startTime)
    .input('endTime', sql.VarChar(5), snapshot.endTime)
    .input('status', sql.NVarChar(10), snapshot.status)
    .input('taskId', sql.BigInt, taskId)
    .input('isUndecided', sql.Bit, snapshot.isPeriodUndecided)
    .input('isContentChanged', sql.Bit, isContentChanged)
    .input('isAssigneeChanged', sql.Bit, isAssigneeChanged)
    .query(`INSERT INTO task_logs (log_type, before_status, nickname, title, content, start_date, end_date, start_time, end_time,
              status, task_id, is_period_undecided, is_content_changed, is_assignee_changed)
            OUTPUT inserted.id
            VALUES (@logType, @beforeStatus, @nickname, @title, @content, CAST(@startDate AS DATE), CAST(@endDate AS DATE),
              CAST(@startTime AS TIME(0)), CAST(@endTime AS TIME(0)), @status, @taskId, @isUndecided, @isContentChanged, @isAssigneeChanged)`);
  const logId = Number(inserted.recordset[0].id);
  for (const assigneeNickname of assigneeNicknames) {
    await new sql.Request(transaction).input('nickname', sql.NVarChar(8), assigneeNickname).input('logId', sql.BigInt, logId)
      .query('INSERT INTO task_log_assignees (nickname, task_log_id) VALUES (@nickname, @logId)');
  }
}
