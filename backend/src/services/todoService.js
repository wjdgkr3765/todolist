// 할일 (api.md 6.4, D-056, D-057, D-059, D-064) 과 작업 시작
import { getPool, withTransaction, sql } from '../config/db.js';
import { notFound } from '../utils/appError.js';
import { emitToTeam } from '../realtime/index.js';
import {
  PERIOD_VALUES_SQL, bindPeriod, bindSpace, checkRowSpace, spaceCondition, toPeriod,
} from './spaceService.js';
import { getTask, lockSpaceTasks, writeTaskLog } from './taskCore.js';

const TODO_COLUMNS = 'id, title, content, start_date, end_date, start_time, end_time, is_period_undecided, user_id, team_id, create_date';

function toTodo(row) {
  return { todoId: Number(row.id), ...toPeriod(row), createDate: row.create_date.toISOString() };
}

function emitTodos(space, todoId, action, actorUserId) {
  if (space.teamId !== null) {
    emitToTeam(space.teamId, 'team:todos-changed', { teamId: space.teamId, todoId, action, actorUserId });
  }
}

export async function listTodos(space) {
  const pool = await getPool();
  const result = await bindSpace(pool.request(), space)
    .query(`SELECT ${TODO_COLUMNS} FROM todos WHERE ${spaceCondition(space)} ORDER BY create_date DESC, id DESC`);
  return result.recordset.map(toTodo);
}

export async function createTodo(space, input, actorUserId) {
  const pool = await getPool();
  const request = bindPeriod(pool.request(), input)
    .input('userId', sql.BigInt, space.userId)
    .input('teamId', sql.BigInt, space.teamId);
  const result = await request.query(`INSERT INTO todos (title, content, start_date, end_date, start_time, end_time, user_id, team_id, is_period_undecided)
    OUTPUT ${TODO_COLUMNS.split(', ').map((column) => `inserted.${column}`).join(', ')}
    VALUES (${PERIOD_VALUES_SQL}, @userId, @teamId, @isUndecided)`);
  const todo = toTodo(result.recordset[0]);
  emitTodos(space, todo.todoId, 'create', actorUserId);
  return todo;
}

async function findTodo(runner, todoId, { isLocked = false } = {}) {
  const request = runner.request ? runner.request() : new sql.Request(runner);
  const result = await request.input('id', sql.BigInt, todoId)
    .query(`SELECT ${TODO_COLUMNS} FROM todos ${isLocked ? 'WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE id = @id`);
  return result.recordset[0] ?? null;
}

export async function updateTodo(userId, todoId, input) {
  const pool = await getPool();
  const space = await checkRowSpace(userId, await findTodo(pool, todoId));
  const result = await bindPeriod(pool.request(), input).input('id', sql.BigInt, todoId)
    .query(`UPDATE todos SET title = @title, content = @content, start_date = CAST(@startDate AS DATE), end_date = CAST(@endDate AS DATE),
              start_time = CAST(@startTime AS TIME(0)), end_time = CAST(@endTime AS TIME(0)),
              is_period_undecided = @isUndecided, update_date = SYSUTCDATETIME()
            OUTPUT ${TODO_COLUMNS.split(', ').map((column) => `inserted.${column}`).join(', ')}
            WHERE id = @id`);
  if (!result.recordset[0]) {
    throw notFound();
  }
  emitTodos(space, todoId, 'update', userId);
  return toTodo(result.recordset[0]);
}

export async function deleteTodo(userId, todoId) {
  const pool = await getPool();
  const space = await checkRowSpace(userId, await findTodo(pool, todoId));
  const result = await pool.request().input('id', sql.BigInt, todoId).query('DELETE FROM todos WHERE id = @id');
  if (result.rowsAffected[0] === 0) {
    throw notFound();
  }
  emitTodos(space, todoId, 'delete', userId);
  return { isDeleted: true };
}

// 작업 시작 (D-018, D-059, D-064): 할일을 지우고 대기 맨 위에 같은 내용의 작업을 만든다. "작업 생성" 기록
export async function startTodo(user, todoId) {
  const pool = await getPool();
  const space = await checkRowSpace(user.userId, await findTodo(pool, todoId));
  const taskId = await withTransaction(async (transaction) => {
    await lockSpaceTasks(transaction, space);
    const todo = await findTodo(transaction, todoId, { isLocked: true });
    if (!todo) {
      throw notFound();
    }
    const input = toPeriod(todo);
    await bindSpace(new sql.Request(transaction), space)
      .query(`UPDATE tasks SET sort_order = sort_order + 1 WHERE ${spaceCondition(space)} AND status = 'waiting'`);
    const inserted = await bindPeriod(new sql.Request(transaction), input)
      .input('userId', sql.BigInt, space.userId).input('teamId', sql.BigInt, space.teamId)
      .query(`INSERT INTO tasks (title, content, start_date, end_date, start_time, end_time, status, sort_order, user_id, team_id, is_period_undecided)
              OUTPUT inserted.id
              VALUES (${PERIOD_VALUES_SQL}, 'waiting', 0, @userId, @teamId, @isUndecided)`);
    const newTaskId = Number(inserted.recordset[0].id);
    await writeTaskLog(transaction, {
      taskId: newTaskId, logType: 'create', nickname: user.nickname, snapshot: { ...input, status: 'waiting' }, assigneeNicknames: [],
    });
    await new sql.Request(transaction).input('id', sql.BigInt, todoId).query('DELETE FROM todos WHERE id = @id');
    return newTaskId;
  });
  if (space.teamId !== null) {
    emitTodos(space, todoId, 'start', user.userId);
    emitToTeam(space.teamId, 'team:tasks-changed', { teamId: space.teamId, taskIds: [taskId], action: 'create', actorUserId: user.userId });
  }
  return getTask(pool, taskId);
}
