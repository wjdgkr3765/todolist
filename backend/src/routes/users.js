// api.md 6.2 회원가입 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import {
  isEmail, isLoginId, isNickname, isPassword, isPhone, isPositiveId, requireBodyObject,
} from '../utils/validation.js';
import { createUser, isLoginIdAvailable } from '../services/userService.js';

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
