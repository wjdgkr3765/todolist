// api.md 6.9 캘린더·공휴일, 6.10 히스토리 API (/api 아래, 경로마다 로그인 확인)
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { parsePathId } from '../utils/validation.js';
import { isRealDate } from '../utils/todoInput.js';
import { addDays } from '../utils/koreaDate.js';
import { getHolidays } from '../utils/holidayApi.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { resolveSpace } from '../services/spaceService.js';
import { listCalendarTasks, listHistory } from '../services/calendarService.js';

export const calendarRouter = Router();

const MAX_RANGE_DAYS = 62;

function teamIdOf(req) {
  return req.params.teamId === undefined ? null : parsePathId(req.params.teamId);
}

// from ≤ to, from 부터 62일 이하
function readRange(query) {
  const { from, to } = query;
  if (!isRealDate(from) || !isRealDate(to) || to < from || to > addDays(from, MAX_RANGE_DAYS)) {
    throw invalidInput();
  }
  return { from, to };
}

function readPage(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) {
    throw invalidInput();
  }
  return Number(value);
}

for (const prefix of ['/personal', '/teams/:teamId']) {
  calendarRouter.get(`${prefix}/calendar`, requireLogin, async (req, res) => {
    const teamId = teamIdOf(req);
    const { from, to } = readRange(req.query);
    const space = await resolveSpace(req.user.userId, teamId);
    res.json({ data: { tasks: await listCalendarTasks(space, from, to) } });
  });
  calendarRouter.get(`${prefix}/history`, requireLogin, async (req, res) => {
    const teamId = teamIdOf(req);
    const page = readPage(req.query.page);
    const space = await resolveSpace(req.user.userId, teamId);
    res.json({ data: await listHistory(space, page) });
  });
}

calendarRouter.get('/holidays', requireLogin, async (req, res) => {
  const { year } = req.query;
  if (typeof year !== 'string' || !/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
    throw invalidInput();
  }
  res.json({ data: await getHolidays(Number(year)) });
});
