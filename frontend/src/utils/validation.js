// 화면 입력 검사 (overview.md 8.1). 서버(backend/src/utils/validation.js)와 같은 규칙이다
export const LOGIN_ID_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,15}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!-/:-@[-`{-~])[!-~]{8,15}$/;
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{1,8}$/;
export const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export const EMAIL_MAX_LENGTH = 100;
export const PHONE_PATTERN = /^\d{11}$/;
export const VERIFICATION_CODE_PATTERN = /^\d{6}$/;

export const isLoginId = (value) => LOGIN_ID_PATTERN.test(value);
export const isPassword = (value) => PASSWORD_PATTERN.test(value);
export const isNickname = (value) => NICKNAME_PATTERN.test(value);
export const isEmail = (value) => value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
export const isPhone = (value) => PHONE_PATTERN.test(value);
export const isVerificationCode = (value) => VERIFICATION_CODE_PATTERN.test(value);

// 초를 "4:59" 형식으로
export function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
