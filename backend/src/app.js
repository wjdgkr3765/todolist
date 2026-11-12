// Express 앱과 공통 처리 (api.md 1)
import express from 'express';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { usersRouter } from './routes/users.js';
import { emailVerificationsRouter } from './routes/emailVerifications.js';
import { sessionsRouter } from './routes/sessions.js';
import { teamsRouter } from './routes/teams.js';
import { notificationsRouter } from './routes/notifications.js';
import { workRouter } from './routes/work.js';
import { calendarRouter } from './routes/calendar.js';
import { reportsRouter } from './routes/reports.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const LARGE_BODY_PATH = /^\/api\/teams\/[^/]+\/(reports\/today\/save|report-template\/update)$/;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // 보안 응답 헤더 (security.md 11 의 27번). CORS 는 열지 않는다 (Vite 프록시로 같은 출처)
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  // 요청 본문 100kb. 일일보고 저장·양식 저장만 512kb (api.md 6.12, D-161)
  const smallJson = express.json({ limit: '100kb' });
  const largeJson = express.json({ limit: '512kb' });
  app.use((req, res, next) => (LARGE_BODY_PATH.test(req.path) ? largeJson : smallJson)(req, res, next));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/email-verifications', emailVerificationsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/notifications', notificationsRouter);
  // 할일·작업: /api/personal/..., /api/teams/{id}/todos·tasks, /api/todos/..., /api/tasks/...
  app.use('/api', workRouter);
  app.use('/api', calendarRouter);
  app.use('/api', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
