// api.md 6.4 할일, 6.5 작업 (칸반) API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { isPositiveId, parsePathId, requireBodyObject } from '../utils/validation.js';
import { readTodoInput } from '../utils/todoInput.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { resolveSpace } from '../services/spaceService.js';
import { createTodo, deleteTodo, listTodos, startTodo, updateTodo } from '../services/todoService.js';
import { deleteTask, getTaskLogs, listSpaceTasks, moveTask, updateTask } from '../services/taskService.js';

const STATUSES = ['waiting', 'progress', 'done'];

// /api 아래에 붙으므로 경로마다 로그인 확인을 붙인다 (없는 경로는 404 그대로)
export const workRouter = Router();

function teamIdOf(req) {
  return req.params.teamId === undefined ? null : parsePathId(req.params.teamId);
}

// 개인 공간: /api/personal/..., 팀 공간: /api/teams/{teamId}/...
for (const prefix of ['/personal', '/teams/:teamId']) {
  workRouter.get(`${prefix}/todos`, requireLogin, async (req, res) => {
    const space = await resolveSpace(req.user.userId, teamIdOf(req));
    res.json({ data: { todos: await listTodos(space) } });
  });
  workRouter.post(`${prefix}/todos`, requireLogin, async (req, res) => {
    const teamId = teamIdOf(req);
    const input = readTodoInput(requireBodyObject(req.body));
    const space = await resolveSpace(req.user.userId, teamId);
    res.json({ data: await createTodo(space, input, req.user.userId) });
  });
  workRouter.get(`${prefix}/tasks`, requireLogin, async (req, res) => {
    const space = await resolveSpace(req.user.userId, teamIdOf(req));
    res.json({ data: { tasks: await listSpaceTasks(space) } });
  });
}

workRouter.post('/todos/:id/update', requireLogin, async (req, res) => {
  const todoId = parsePathId(req.params.id);
  const input = readTodoInput(requireBodyObject(req.body));
  res.json({ data: await updateTodo(req.user.userId, todoId, input) });
});

workRouter.post('/todos/:id/delete', requireLogin, async (req, res) => {
  res.json({ data: await deleteTodo(req.user.userId, parsePathId(req.params.id)) });
});

workRouter.post('/todos/:id/start', requireLogin, async (req, res) => {
  res.json({ data: await startTodo(req.user, parsePathId(req.params.id)) });
});

workRouter.get('/tasks/:id/logs', requireLogin, async (req, res) => {
  res.json({ data: { logs: await getTaskLogs(req.user.userId, parsePathId(req.params.id)) } });
});

workRouter.post('/tasks/:id/update', requireLogin, async (req, res) => {
  const taskId = parsePathId(req.params.id);
  const body = requireBodyObject(req.body);
  const input = readTodoInput(body);
  const { status, assigneeUserIds } = body;
  if (!STATUSES.includes(status) || !Array.isArray(assigneeUserIds) || !assigneeUserIds.every(isPositiveId)
    || new Set(assigneeUserIds).size !== assigneeUserIds.length) {
    throw invalidInput();
  }
  const { task } = await updateTask(req.user, taskId, input, status, assigneeUserIds);
  res.json({ data: task });
});

workRouter.post('/tasks/:id/move', requireLogin, async (req, res) => {
  const taskId = parsePathId(req.params.id);
  const { status, index } = requireBodyObject(req.body);
  if (!STATUSES.includes(status) || !Number.isSafeInteger(index) || index < 0) {
    throw invalidInput();
  }
  res.json({ data: { tasks: await moveTask(req.user, taskId, status, index) } });
});

workRouter.post('/tasks/:id/delete', requireLogin, async (req, res) => {
  res.json({ data: await deleteTask(req.user.userId, parsePathId(req.params.id)) });
});
