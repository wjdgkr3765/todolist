// api.md 6.6 팀 생성/관리 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { parsePathId, readTeamName, requireBodyObject } from '../utils/validation.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { createTeam, listMembers, listTeams, moveTeam } from '../services/teamService.js';

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
