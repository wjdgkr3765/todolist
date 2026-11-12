// api.md 3·4: 실패 응답 { error: { code, message } } 를 만들기 위한 오류
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const invalidInput = () => new AppError(400, 'INVALID_INPUT', '입력값이 올바르지 않습니다.');
export const notFound = () => new AppError(404, 'NOT_FOUND', '대상을 찾을 수 없습니다.');
