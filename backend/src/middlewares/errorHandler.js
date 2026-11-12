// 공통 오류 응답 (api.md 1·3, security.md 9번): 스택·SQL·경로는 응답에 담지 않는다
import { AppError } from '../utils/appError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '대상을 찾을 수 없습니다.' } });
}

// Express 는 매개변수가 4개인 함수를 오류 처리로 인식한다
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  // JSON 본문 형식 오류, 본문 크기 초과 → 400 INVALID_INPUT
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: '입력값이 올바르지 않습니다.' } });
    return;
  }
  console.error('처리되지 않은 서버 오류:', error?.name, error?.code ?? '', error?.number ?? '');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했습니다.' } });
}
