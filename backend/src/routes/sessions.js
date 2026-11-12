// api.md 6.3 로그인 API
import { Router } from 'express';
import { env } from '../config/env.js';
import { invalidInput } from '../utils/appError.js';
import { requireBodyObject } from '../utils/validation.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, login, logout } from '../services/sessionService.js';

export const sessionsRouter = Router();

// 로그인 쿠키 (api.md 6.3 로그인 쿠키): httpOnly, SameSite=Strict, Path=/, 24시간, 운영이면 Secure
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'strict', path: '/', secure: env.isProduction };

function isLengthBetween(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

sessionsRouter.post('/', async (req, res) => {
  const { loginId, password } = requireBodyObject(req.body);
  if (!isLengthBetween(loginId, 1, 15) || !isLengthBetween(password, 1, 15)) {
    throw invalidInput();
  }
  const { token, user } = await login({ loginId, password });
  res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE_MS });
  res.json({ data: user });
});

sessionsRouter.post('/logout', async (req, res) => {
  await logout(req.cookies?.[SESSION_COOKIE_NAME]);
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ data: { isLoggedOut: true } });
});

sessionsRouter.get('/me', requireLogin, (req, res) => {
  res.json({ data: req.user });
});
