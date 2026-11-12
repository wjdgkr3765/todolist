// api.md 6.2 회원가입 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import {
  isEmail, isLoginId, isNickname, isPassword, isPhone, isPositiveId, requireBodyObject,
} from '../utils/validation.js';
import { createUser, findLoginId, isLoginIdAvailable, resetPassword } from '../services/userService.js';
import { disconnectUser } from '../realtime/index.js';

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
