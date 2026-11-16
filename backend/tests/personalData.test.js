// 이메일·전화번호 암호화·찾기용 해시 (utils/personalData.js, D-172)
import { describe, expect, test } from 'vitest';
import { decryptText, encryptText, hashEmail, hashPhone } from '../src/utils/personalData.js';

describe('암호화·복호화', () => {
  test.each([['a@b.co'], ['user.name+tag@example.com'], ['01012345678'], [`${'a'.repeat(88)}@example.com`]])('%s → 원문으로 돌아온다', (text) => {
    expect(decryptText(encryptText(text))).toBe(text);
  });
  test('같은 값도 매번 다른 암호문, 형식 v1.IV.태그.암호문', () => {
    const first = encryptText('user@example.com');
    const second = encryptText('user@example.com');
    expect(first).not.toBe(second);
    expect(first).toMatch(/^v1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/);
  });
  test('경계: 최대 길이 원문의 암호문이 컬럼 길이 안에 든다 (이메일 100자 → 200, 전화번호 11자 → 80)', () => {
    expect(encryptText(`${'a'.repeat(88)}@example.com`).length).toBeLessThanOrEqual(200);
    expect(encryptText('01012345678').length).toBeLessThanOrEqual(80);
  });
  test.each([
    // 마지막 글자는 남는 비트만 담을 수 있어 첫 글자를 바꾼다
    ['암호문 한 글자 바꿈', (value) => { const parts = value.split('.'); parts[3] = parts[3].replace(/^./, (c) => (c === 'A' ? 'B' : 'A')); return parts.join('.'); }],
    ['태그 바꿈', (value) => { const parts = value.split('.'); parts[2] = parts[2].replace(/^./, (c) => (c === 'A' ? 'B' : 'A')); return parts.join('.'); }],
    ['버전 다름', (value) => value.replace(/^v1/, 'v2')],
    ['형식 아님', () => 'user@example.com'],
  ])('%s → 오류', (_, change) => {
    expect(() => decryptText(change(encryptText('user@example.com')))).toThrow();
  });
});

describe('찾기용 해시', () => {
  test('이메일은 대소문자·앞뒤 공백과 상관없이 같은 해시, 다른 이메일은 다른 해시', () => {
    expect(hashEmail(' User@Example.COM ')).toBe(hashEmail('user@example.com'));
    expect(hashEmail('user@example.com')).not.toBe(hashEmail('user2@example.com'));
    expect(hashEmail('user@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });
  test('전화번호 해시는 값이 같을 때만 같다', () => {
    expect(hashPhone('01012345678')).toBe(hashPhone('01012345678'));
    expect(hashPhone('01012345678')).not.toBe(hashPhone('01012345679'));
  });
});
