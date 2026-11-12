// 로그인 확인 (api.md 6.3): 쿠키가 없거나 토큰이 없거나 만료면 401 UNAUTHORIZED
import { AppError } from '../utils/appError.js';
import { SESSION_COOKIE_NAME, findSessionUser } from '../services/sessionService.js';

export function unauthorized() {
  return new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
}

// 로그인한 회원이면 req.user 에 { userId, loginId, nickname, email } 을 넣는다
export async function requireLogin(req, res, next) {
  const user = await findSessionUser(req.cookies?.[SESSION_COOKIE_NAME]);
  if (!user) {
    throw unauthorized();
  }
  req.user = user;
  next();
}
