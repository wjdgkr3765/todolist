// 입력 규칙 (overview.md 8.1): 동등 분할 + 경계값 (test.md 12, 13)
import { describe, expect, test } from 'vitest';
import {
  isEmail, isLoginId, isNickname, isPassword, isPhone, isPositiveId, isVerificationCode, parsePathId,
} from '../src/utils/validation.js';

describe('아이디: 영어와 숫자 모두 포함 6~15자', () => {
  test.each([
    ['abc12', false], ['abc123', true], ['abcdefghijk1234', true], ['abcdefghijk12345', false],
    ['abcdef', false], ['123456', false], ['abc 123', false], ['abc_123', false], ['아이디abc123', false],
    [undefined, false], [123456, false], [['abc123'], false],
  ])('%s → %s', (value, expected) => expect(isLoginId(value)).toBe(expected));
});

describe('비밀번호: 영어+숫자+특수문자 모두 포함 8~15자', () => {
  test.each([
    ['abc12!x', false], ['abc123!x', true], ['abcdefghij123!@', true], ['abcdefghij123!@#', false],
    ['abcdefgh', false], ['abc12345', false], ['abcdefg!', false], ['1234567!', false],
    ['abc 123!x', false], ['abc123!한', false], ['', false], [null, false],
  ])('%s → %s', (value, expected) => expect(isPassword(value)).toBe(expected));
});

describe('닉네임: 한글·영어·숫자 1~8자', () => {
  test.each([
    ['', false], ['a', true], ['홍길동abc12', true], ['홍길동abc123', false],
    ['홍길동_1', false], ['ㄱㄴ', false], ['hong dong', false], [8, false],
  ])('%s → %s', (value, expected) => expect(isNickname(value)).toBe(expected));
});

describe('이메일: D-026 정규식, 최대 100자', () => {
  const localPart = (length) => 'a'.repeat(length);
  test.each([
    ['user@example.com', true], ['user.name+tag@sub.example.co.kr', true],
    ['user@example', false], ['user@@example.com', false], ['user @example.com', false],
    ['user@-example.com', false], ['@example.com', false], ['', false],
    [`${localPart(88)}@example.com`, true], [`${localPart(89)}@example.com`, false],
  ])('%s → %s', (value, expected) => expect(isEmail(value)).toBe(expected));
  test('경계: 100자 통과, 101자 거부', () => {
    expect(`${localPart(88)}@example.com`.length).toBe(100);
    expect(`${localPart(89)}@example.com`.length).toBe(101);
  });
});

describe('전화번호: 숫자만 11자리', () => {
  test.each([
    ['0101234567', false], ['01012345678', true], ['010123456789', false],
    ['010-1234-5678', false], ['0101234567a', false], [1012345678, false],
  ])('%s → %s', (value, expected) => expect(isPhone(value)).toBe(expected));
});

describe('인증번호: 숫자 6자리', () => {
  test.each([['12345', false], ['123456', true], ['1234567', false], ['12345a', false], [123456, false]])(
    '%s → %s', (value, expected) => expect(isVerificationCode(value)).toBe(expected),
  );
});

describe('id: 1 이상 정수', () => {
  test.each([[0, false], [1, true], [Number.MAX_SAFE_INTEGER, true], [Number.MAX_SAFE_INTEGER + 1, false], [1.5, false], ['1', false], [-1, false]])(
    '%s → %s', (value, expected) => expect(isPositiveId(value)).toBe(expected),
  );
  test.each([['1', 1], ['9007199254740991', 9007199254740991]])('경로 %s → %s', (text, id) => expect(parsePathId(text)).toBe(id));
  test.each(['0', '-1', '01', '1.5', 'abc', '9007199254740992', '12345678901234567'])('경로 %s → 400', (text) => {
    expect(() => parsePathId(text)).toThrow();
  });
});
