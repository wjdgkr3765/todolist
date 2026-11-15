// api.md 6.2 전화번호 인증번호 API (D-168)
import { Router } from 'express';
import { invalidInput } from '../utils/appError.js';
import { isPhone, isVerificationCode, parsePathId, requireBodyObject } from '../utils/validation.js';
import { isSupportedPhonePurpose, sendPhoneVerification, verifyPhoneCode } from '../services/phoneVerificationService.js';
import { SESSION_COOKIE_NAME, findSessionUser } from '../services/sessionService.js';
import { unauthorized } from '../middlewares/requireLogin.js';

export const phoneVerificationsRouter = Router();

phoneVerificationsRouter.post('/', async (req, res) => {
  const { phone, purpose } = requireBodyObject(req.body);
  if (!isPhone(phone) || !isSupportedPhonePurpose(purpose)) {
    throw invalidInput();
  }
  // 전화번호 변경은 로그인한 회원만 (requireLogin 과 같은 확인)
  if (purpose === 'change_phone' && !(await findSessionUser(req.cookies?.[SESSION_COOKIE_NAME]))) {
    throw unauthorized();
  }
  res.json({ data: await sendPhoneVerification({ phone, purpose }) });
});

phoneVerificationsRouter.post('/:id/verify', async (req, res) => {
  const id = parsePathId(req.params.id);
  const { code } = requireBodyObject(req.body);
  if (!isVerificationCode(code)) {
    throw invalidInput();
  }
  res.json({ data: await verifyPhoneCode(id, code) });
});
