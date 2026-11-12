// 입력 검사 (overview.md 8.1 회원 입력 규칙, security.md 4번). 화면 검사와 같은 규칙을 서버에서 다시 확인한다
import { invalidInput } from './appError.js';

// 아이디: 영어와 숫자를 둘 다 포함, 6~15자 (D-006)
export const LOGIN_ID_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,15}$/;
// 비밀번호: 영어 + 숫자 + 공백 없는 ASCII 특수문자 모두 포함, 8~15자
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!-/:-@[-`{-~])[!-~]{8,15}$/;
// 닉네임: 완성형 한글, 영어, 숫자 1~8자
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{1,8}$/;
// 이메일: D-026 정규식, 최대 100자 (D-036)
export const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export const EMAIL_MAX_LENGTH = 100;
// 전화번호: 숫자만 11자리 (D-037)
export const PHONE_PATTERN = /^\d{11}$/;
// 인증번호: 숫자 6자리 (D-035)
export const VERIFICATION_CODE_PATTERN = /^\d{6}$/;

export function isLoginId(value) {
  return typeof value === 'string' && LOGIN_ID_PATTERN.test(value);
}

export function isPassword(value) {
  return typeof value === 'string' && PASSWORD_PATTERN.test(value);
}

export function isNickname(value) {
  return typeof value === 'string' && NICKNAME_PATTERN.test(value);
}

export function isEmail(value) {
  return typeof value === 'string' && value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

export function isPhone(value) {
  return typeof value === 'string' && PHONE_PATTERN.test(value);
}

export function isVerificationCode(value) {
  return typeof value === 'string' && VERIFICATION_CODE_PATTERN.test(value);
}

// DB id(BIGINT) 로 쓸 1 이상 정수. JSON 숫자는 안전한 정수 범위까지만 받는다
export function isPositiveId(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

// 경로의 {id}: 1 이상 정수가 아니면 400 INVALID_INPUT (api.md 1)
export function parsePathId(text) {
  if (typeof text !== 'string' || !/^[1-9]\d{0,15}$/.test(text)) {
    throw invalidInput();
  }
  const id = Number(text);
  if (!Number.isSafeInteger(id)) {
    throw invalidInput();
  }
  return id;
}

// 요청 본문이 JSON 객체인지 확인한다
export function requireBodyObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidInput();
  }
  return body;
}
