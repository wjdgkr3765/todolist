// api.md 6.13 알람 API (D-177~D-180)
import { Router } from 'express';
import { parsePathId } from '../utils/validation.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import {
  checkAlarms, createAlarm, deleteAlarm, listAlarms, toggleAlarm, updateAlarm,
} from '../services/alarmService.js';

export const alarmsRouter = Router();
alarmsRouter.use(requireLogin);

alarmsRouter.get('/', async (req, res) => {
  res.json({ data: await listAlarms(req.user.userId) });
});

alarmsRouter.post('/', async (req, res) => {
  res.json({ data: await createAlarm(req.user.userId, req.body) });
});

alarmsRouter.post('/check', async (req, res) => {
  res.json({ data: await checkAlarms(req.user.userId) });
});

alarmsRouter.post('/:id/update', async (req, res) => {
  res.json({ data: await updateAlarm(req.user.userId, parsePathId(req.params.id), req.body) });
});

alarmsRouter.post('/:id/toggle', async (req, res) => {
  res.json({ data: await toggleAlarm(req.user.userId, parsePathId(req.params.id), req.body) });
});

alarmsRouter.post('/:id/delete', async (req, res) => {
  res.json({ data: await deleteAlarm(req.user.userId, parsePathId(req.params.id)) });
});
