// 화면 입력 규칙 (overview.md 8.1): 동등 분할 + 경계값
import { describe, expect, test } from 'vitest';
import {
  formatSeconds, isEmail, isLoginId, isNickname, isPassword, isPhone, isVerificationCode,
} from '../src/utils/validation.js';

describe('입력 규칙', () => {
  test.each([['abc12', false], ['abc123', true], ['abcdefghijk1234', true], ['abcdefghijk12345', false], ['abcdef', false], ['123456', false]])(
    '아이디 %s → %s', (value, expected) => expect(isLoginId(value)).toBe(expected),
  );
  test.each([['abc12!x', false], ['abc123!x', true], ['abcdefghij123!@', true], ['abcdefghij123!@#', false], ['abc12345', false], ['abc 123!x', false]])(
    '비밀번호 %s → %s', (value, expected) => expect(isPassword(value)).toBe(expected),
  );
  test.each([['', false], ['a', true], ['홍길동abc12', true], ['홍길동abc123', false], ['홍_1', false], ['ㄱ', false]])(
    '닉네임 %s → %s', (value, expected) => expect(isNickname(value)).toBe(expected),
  );
  test.each([['user@example.com', true], ['user@example', false], [`${'a'.repeat(88)}@example.com`, true], [`${'a'.repeat(89)}@example.com`, false]])(
    '이메일 %s → %s', (value, expected) => expect(isEmail(value)).toBe(expected),
  );
  test.each([['0101234567', false], ['01012345678', true], ['010123456789', false], ['0101234567a', false]])(
    '전화번호 %s → %s', (value, expected) => expect(isPhone(value)).toBe(expected),
  );
  test.each([['12345', false], ['123456', true], ['1234567', false]])(
    '인증번호 %s → %s', (value, expected) => expect(isVerificationCode(value)).toBe(expected),
  );
});

describe('남은 시간 표시', () => {
  test.each([[300, '5:00'], [299, '4:59'], [60, '1:00'], [59, '0:59'], [1, '0:01'], [0, '0:00'], [-3, '0:00']])(
    '%s초 → %s', (seconds, text) => expect(formatSeconds(seconds)).toBe(text),
  );
});
