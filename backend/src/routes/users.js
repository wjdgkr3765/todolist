// api.md 6.2 회원가입 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import {
  isEmail, isLoginId, isNickname, isPassword, isPhone, isPositiveId, requireBodyObject,
} from '../utils/validation.js';
import { createUser, findLoginId, isLoginIdAvailable, resetPassword } from '../services/userService.js';
import { disconnectUser } from '../realtime/index.js';
import { env } from '../config/env.js';
import { requireLogin } from '../middlewares/requireLogin.js';
import { SESSION_COOKIE_NAME } from '../services/sessionService.js';
import {
  changeEmail, changeNickname, changePassword, changePhone, getMe, withdraw, withdrawalCheck,
} from '../services/profileService.js';
import { setReportCarryOver } from '../services/reportService.js';

export const usersRouter = Router();

usersRouter.get('/login-id-availability', async (req, res) => {
  const { loginId } = req.query;
  if (!isLoginId(loginId)) {
    throw invalidInput();
  }
  res.json({ data: { isAvailable: await isLoginIdAvailable(loginId) } });
});

usersRouter.post('/', async (req, res) => {
  const body = requireBodyObject(req.body);
  const { loginId, password, nickname, email, phone, verificationId } = body;
  if (!isLoginId(loginId) || !isPassword(password) || !isNickname(nickname)
    || !isEmail(email) || !isPhone(phone) || !isPositiveId(verificationId)) {
    throw invalidInput();
  }
  const data = await createUser({ loginId, password, nickname, email, phone, verificationId });
  res.json({ data });
});

usersRouter.post('/find-id', async (req, res) => {
  const { email, verificationId } = requireBodyObject(req.body);
  if (!isEmail(email) || !isPositiveId(verificationId)) {
    throw invalidInput();
  }
  res.json({ data: await findLoginId({ email, verificationId }) });
});

usersRouter.post('/reset-password', async (req, res) => {
  const { loginId, email, verificationId, password } = requireBodyObject(req.body);
  if (typeof loginId !== 'string' || loginId.length < 1 || loginId.length > 15
    || !isEmail(email) || !isPositiveId(verificationId) || !isPassword(password)) {
    throw invalidInput();
  }
  const userId = await resetPassword({ loginId, email, verificationId, password });
  // 그 회원의 로그인은 모두 무효가 되었으므로 실시간 연결도 끊는다 (D-116)
  disconnectUser(userId);
  res.json({ data: { isReset: true } });
});

// api.md 6.11 회원정보 수정/탈퇴 (로그인한 회원 자신만)
function isLengthBetween(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

usersRouter.get('/me', requireLogin, async (req, res) => {
  res.json({ data: await getMe(req.user.userId) });
});

usersRouter.post('/me/nickname', requireLogin, async (req, res) => {
  const { nickname } = requireBodyObject(req.body);
  if (!isNickname(nickname)) {
    throw invalidInput();
  }
  res.json({ data: await changeNickname(req.user.userId, nickname) });
});

usersRouter.post('/me/phone', requireLogin, async (req, res) => {
  const { phone } = requireBodyObject(req.body);
  if (!isPhone(phone)) {
    throw invalidInput();
  }
  res.json({ data: await changePhone(req.user.userId, phone) });
});

usersRouter.post('/me/email', requireLogin, async (req, res) => {
  const { email, verificationId } = requireBodyObject(req.body);
  if (!isEmail(email) || !isPositiveId(verificationId)) {
    throw invalidInput();
  }
  res.json({ data: await changeEmail(req.user.userId, email, verificationId) });
});

usersRouter.post('/me/password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = requireBodyObject(req.body);
  if (!isLengthBetween(currentPassword, 1, 15) || !isPassword(newPassword)) {
    throw invalidInput();
  }
  res.json({ data: await changePassword(req.user.userId, currentPassword, newPassword) });
});

usersRouter.get('/me/withdrawal-check', requireLogin, async (req, res) => {
  res.json({ data: await withdrawalCheck(req.user.userId) });
});

// api.md 6.12 일일보고 지난 보고 이어받기 (D-156)
usersRouter.post('/me/report-carry-over', requireLogin, async (req, res) => {
  const { isOn } = requireBodyObject(req.body);
  if (typeof isOn !== 'boolean') {
    throw invalidInput();
  }
  res.json({ data: await setReportCarryOver(req.user.userId, isOn) });
});

usersRouter.post('/me/withdraw', requireLogin, async (req, res) => {
  const { password } = requireBodyObject(req.body);
  if (!isLengthBetween(password, 1, 15)) {
    throw invalidInput();
  }
  const data = await withdraw(req.user, password);
  disconnectUser(req.user.userId);
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'strict', path: '/', secure: env.isProduction });
  res.json({ data });
});
