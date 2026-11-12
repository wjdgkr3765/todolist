// api.md 6.6 팀 생성/관리 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { isEmail, isPositiveId, parsePathId, readTeamName, requireBodyObject } from '../utils/validation.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { createTeam, listMembers, listTeams, moveTeam } from '../services/teamService.js';
import {
  dissolveTeam, getTeamDetail, leaveTeam, removeMember, renameTeam, setMemberRole, transferOwner,
} from '../services/teamManageService.js';
import { cancelInvitation, inviteMember, listInvitations } from '../services/invitationService.js';

export const teamsRouter = Router();
teamsRouter.use(requireLogin);

teamsRouter.get('/', async (req, res) => {
  res.json({ data: { teams: await listTeams(req.user.userId) } });
});

teamsRouter.post('/', async (req, res) => {
  const name = readTeamName(requireBodyObject(req.body).name);
  res.json({ data: await createTeam(req.user.userId, name) });
});

teamsRouter.post('/:id/move', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const { index } = requireBodyObject(req.body);
  if (!Number.isSafeInteger(index) || index < 0) {
    throw invalidInput();
  }
  res.json({ data: { teams: await moveTeam(req.user.userId, teamId, index) } });
});

teamsRouter.get('/:id/members', async (req, res) => {
  res.json({ data: { members: await listMembers(req.user.userId, parsePathId(req.params.id)) } });
});

teamsRouter.get('/:id', async (req, res) => {
  res.json({ data: await getTeamDetail(req.user.userId, parsePathId(req.params.id)) });
});

teamsRouter.post('/:id/update', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const name = readTeamName(requireBodyObject(req.body).name);
  res.json({ data: await renameTeam(req.user, teamId, name) });
});

teamsRouter.post('/:id/members/:userId/remove', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const targetUserId = parsePathId(req.params.userId);
  res.json({ data: { members: await removeMember(req.user, teamId, targetUserId) } });
});

teamsRouter.post('/:id/members/:userId/role', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const targetUserId = parsePathId(req.params.userId);
  const { role } = requireBodyObject(req.body);
  if (role !== 'manager' && role !== 'member') {
    throw invalidInput();
  }
  res.json({ data: { members: await setMemberRole(req.user, teamId, targetUserId, role) } });
});

teamsRouter.post('/:id/owner', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const { userId } = requireBodyObject(req.body);
  if (!isPositiveId(userId)) {
    throw invalidInput();
  }
  res.json({ data: await transferOwner(req.user, teamId, userId) });
});

teamsRouter.post('/:id/leave', async (req, res) => {
  res.json({ data: await leaveTeam(req.user, parsePathId(req.params.id)) });
});

teamsRouter.post('/:id/delete', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const name = readTeamName(requireBodyObject(req.body).name);
  res.json({ data: await dissolveTeam(req.user, teamId, name) });
});

// api.md 6.7 팀 초대
teamsRouter.post('/:id/invitations', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const { email } = requireBodyObject(req.body);
  const trimmed = typeof email === 'string' ? email.trim() : email;
  if (!isEmail(trimmed)) {
    throw invalidInput();
  }
  res.json({ data: await inviteMember(req.user, teamId, trimmed) });
});

teamsRouter.get('/:id/invitations', async (req, res) => {
  res.json({ data: { invitations: await listInvitations(req.user.userId, parsePathId(req.params.id)) } });
});

teamsRouter.post('/:id/invitations/:notificationId/cancel', async (req, res) => {
  const teamId = parsePathId(req.params.id);
  const notificationId = parsePathId(req.params.notificationId);
  res.json({ data: { invitations: await cancelInvitation(req.user.userId, teamId, notificationId) } });
});
