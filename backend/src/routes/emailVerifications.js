// api.md 6.2 이메일 인증번호 API
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { isEmail, isVerificationCode, parsePathId, requireBodyObject } from '../utils/validation.js';
import { isSupportedPurpose, sendVerification, verifyCode } from '../services/emailVerificationService.js';
import { SESSION_COOKIE_NAME, findSessionUser } from '../services/sessionService.js';
import { unauthorized } from '../middlewares/requireLogin.js';

export const emailVerificationsRouter = Router();

emailVerificationsRouter.post('/', async (req, res) => {
  const { email, purpose, loginId } = requireBodyObject(req.body);
  if (!isEmail(email) || !isSupportedPurpose(purpose)) {
    throw invalidInput();
  }
  // loginId 는 find_password 일 때만 1~15자로 받는다. 다른 용도에서 보내면 400
  if (purpose === 'find_password') {
    if (typeof loginId !== 'string' || loginId.length < 1 || loginId.length > 15) {
      throw invalidInput();
    }
  } else if (loginId !== undefined) {
    throw invalidInput();
  }
  // 이메일 변경은 로그인한 회원만 (requireLogin 과 같은 확인)
  if (purpose === 'change_email' && !(await findSessionUser(req.cookies?.[SESSION_COOKIE_NAME]))) {
    throw unauthorized();
  }
  const data = await sendVerification({ email, purpose, loginId });
  res.json({ data });
});

emailVerificationsRouter.post('/:id/verify', async (req, res) => {
  const id = parsePathId(req.params.id);
  const { code } = requireBodyObject(req.body);
  if (!isVerificationCode(code)) {
    throw invalidInput();
  }
  res.json({ data: await verifyCode(id, code) });
});
