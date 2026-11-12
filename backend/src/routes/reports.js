// api.md 6.12 일일보고 API (/api 아래, 경로마다 로그인 확인)
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { parsePathId, requireBodyObject } from '../utils/validation.js';
import { isRealDate } from '../utils/todoInput.js';
import { readReportSaveInput, readSectionQuery, readTemplateInput } from '../utils/reportInput.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import {
  getFreshReport, getReport, getReportTemplate, getSectionContent, getTodayReport, listReportStatus,
  saveTodayReport, updateReportTemplate,
} from '../services/reportService.js';

export const reportsRouter = Router();

const teamIdOf = (req) => parsePathId(req.params.teamId);

reportsRouter.get('/teams/:teamId/reports', requireLogin, async (req, res) => {
  const teamId = teamIdOf(req);
  const { date } = req.query;
  if (!isRealDate(date)) {
    throw invalidInput();
  }
  res.json({ data: await listReportStatus(req.user.userId, teamId, date) });
});

reportsRouter.get('/teams/:teamId/reports/today', requireLogin, async (req, res) => {
  res.json({ data: await getTodayReport(req.user.userId, teamIdOf(req)) });
});

reportsRouter.get('/teams/:teamId/reports/today/fresh', requireLogin, async (req, res) => {
  res.json({ data: await getFreshReport(req.user.userId, teamIdOf(req)) });
});

reportsRouter.get('/teams/:teamId/reports/section-content', requireLogin, async (req, res) => {
  const teamId = teamIdOf(req);
  const section = readSectionQuery(req.query);
  res.json({ data: await getSectionContent(req.user.userId, teamId, section) });
});

reportsRouter.post('/teams/:teamId/reports/today/save', requireLogin, async (req, res) => {
  const teamId = teamIdOf(req);
  const input = readReportSaveInput(requireBodyObject(req.body));
  res.json({ data: await saveTodayReport(req.user.userId, teamId, input) });
});

reportsRouter.get('/teams/:teamId/reports/:reportId', requireLogin, async (req, res) => {
  const teamId = teamIdOf(req);
  const reportId = parsePathId(req.params.reportId);
  res.json({ data: await getReport(req.user.userId, teamId, reportId) });
});

reportsRouter.get('/teams/:teamId/report-template', requireLogin, async (req, res) => {
  res.json({ data: await getReportTemplate(req.user.userId, teamIdOf(req)) });
});

reportsRouter.post('/teams/:teamId/report-template/update', requireLogin, async (req, res) => {
  const teamId = teamIdOf(req);
  const input = readTemplateInput(requireBodyObject(req.body));
  res.json({ data: await updateReportTemplate(req.user.userId, teamId, input) });
});
