// Express 앱과 공통 처리 (api.md 1)
import express from 'express';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { usersRouter } from './routes/users.js';
import { emailVerificationsRouter } from './routes/emailVerifications.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // 보안 응답 헤더 (security.md 11 의 27번). CORS 는 열지 않는다 (Vite 프록시로 같은 출처)
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/email-verifications', emailVerificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
