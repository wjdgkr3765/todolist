// api.md 6.7 알림 API
import { Router } from 'express';
import { parsePathId } from '../utils/validation.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import {
  acceptInvite, declineInvite, deleteNotification, listNotifications, markAllRead,
} from '../services/notificationService.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireLogin);

notificationsRouter.get('/', async (req, res) => {
  res.json({ data: await listNotifications(req.user.userId) });
});

notificationsRouter.post('/read', async (req, res) => {
  res.json({ data: await markAllRead(req.user.userId) });
});

notificationsRouter.post('/:id/delete', async (req, res) => {
  res.json({ data: await deleteNotification(req.user.userId, parsePathId(req.params.id)) });
});

notificationsRouter.post('/:id/accept', async (req, res) => {
  res.json({ data: await acceptInvite(req.user.userId, parsePathId(req.params.id)) });
});

notificationsRouter.post('/:id/decline', async (req, res) => {
  res.json({ data: await declineInvite(req.user.userId, parsePathId(req.params.id)) });
});
