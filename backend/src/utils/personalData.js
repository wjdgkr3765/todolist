// 이메일·전화번호 양방향 암호화와 찾기용 해시 (database.md 1, D-170, D-172)
// 암호화: AES-256-GCM, 값마다 새 IV(12바이트). 저장 형식 "v1.{IV}.{인증태그}.{암호문}" (각각 base64url)
// 찾기·중복 확인: HMAC-SHA256 16진수 64자. 이메일은 앞뒤 공백을 지우고 소문자로 바꾼 값을 해시한다
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function encryptText(text) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, env.dataEncryptionKey, iv, { authTagLength: AUTH_TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

// 키가 다르거나 값이 바뀌었으면 오류 (인증태그 확인)
export function decryptText(value) {
  const [version, iv, authTag, encrypted] = String(value).split('.');
  if (version !== VERSION || !iv || !authTag || encrypted === undefined) {
    throw new Error('PERSONAL_DATA_FORMAT');
  }
  const decipher = createDecipheriv(ALGORITHM, env.dataEncryptionKey, Buffer.from(iv, 'base64url'), { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function hmac(text) {
  return createHmac('sha256', env.dataHashKey).update(text, 'utf8').digest('hex');
}

export function hashEmail(email) {
  return hmac(email.trim().toLowerCase());
}

export function hashPhone(phone) {
  return hmac(phone);
}
