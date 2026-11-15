// 전화번호 인증번호 문자 발송·확인 (api.md 6.2 POST /api/phone-verifications, D-168). 규칙은 이메일 인증과 같다 (D-035)
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getPool, withTransaction, sql } from '../config/db.js';
import { sendSms } from '../config/sms.js';
import { AppError, notFound } from '../utils/appError.js';

const CODE_HASH_ROUNDS = 10;
const MAX_FAIL_COUNT = 5;
// 같은 번호로 24시간 동안 보낼 수 있는 문자 수 (건당 요금, D-168)
const DAILY_SEND_LIMIT = 5;

// 용도별 문자 문구. change_phone 은 로그인한 회원만 (routes/phoneVerifications.js 에서 확인)
const PURPOSE_LABELS = {
  signup: '회원가입',
  change_phone: '전화번호 변경',
};

export function isSupportedPhonePurpose(purpose) {
  return Object.hasOwn(PURPOSE_LABELS, purpose);
}

// 단문(SMS, 90바이트 이하)
export function buildVerificationSms(label, code) {
  return `[TODO] ${label} 인증번호 [${code}]. 5분 안에 입력해 주세요.`;
}

const duplicated = () => new AppError(409, 'PHONE_DUPLICATED', '이미 가입된 전화번호입니다.');

export async function sendPhoneVerification({ phone, purpose }) {
  const pool = await getPool();
  // 두 용도 모두 이미 가입된 번호(전화번호 변경은 내 번호 포함)면 보내지 않는다
  const used = await pool.request().input('phone', sql.NVarChar(11), phone)
    .query('SELECT TOP 1 id FROM users WHERE phone = @phone');
  if (used.recordset.length > 0) {
    throw duplicated();
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);

  const saved = await withTransaction(async (transaction) => {
    // 하루 지난 기록(모든 번호)을 지운다 (D-122)
    await new sql.Request(transaction).query(
      'DELETE FROM phone_verifications WHERE create_date < DATEADD(DAY, -1, SYSUTCDATETIME())',
    );
    // 같은 번호의 기록을 잠그고 1분 안 재발송, 24시간 발송 횟수를 본다 (동시 요청도 한 번만 통과)
    const sent = await new sql.Request(transaction)
      .input('phone', sql.NVarChar(11), phone)
      .input('purpose', sql.NVarChar(20), purpose)
      .query(`SELECT
                COUNT(*) AS daily_count,
                SUM(CASE WHEN purpose = @purpose AND create_date > DATEADD(MINUTE, -1, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS recent_count
              FROM phone_verifications WITH (UPDLOCK, HOLDLOCK)
              WHERE phone = @phone AND create_date > DATEADD(DAY, -1, SYSUTCDATETIME())`);
    const { daily_count: dailyCount, recent_count: recentCount } = sent.recordset[0];
    if (recentCount > 0) {
      throw new AppError(429, 'VERIFICATION_RESEND_TOO_SOON', '1분 뒤에 다시 발송할 수 있습니다.');
    }
    if (dailyCount >= DAILY_SEND_LIMIT) {
      throw new AppError(429, 'PHONE_DAILY_LIMIT', '오늘은 이 번호로 더 보낼 수 없습니다. 내일 다시 시도해 주세요.');
    }
    // 재발송하면 이전 번호는 무효. 보낸 횟수를 세려고 행은 남기고 만료만 시킨다 (database.md phone_verifications)
    const inserted = await new sql.Request(transaction)
      .input('phone', sql.NVarChar(11), phone)
      .input('purpose', sql.NVarChar(20), purpose)
      .input('codeHash', sql.NVarChar(60), codeHash)
      .query(`UPDATE phone_verifications SET expire_date = SYSUTCDATETIME()
              WHERE phone = @phone AND purpose = @purpose AND expire_date > SYSUTCDATETIME();
              INSERT INTO phone_verifications (phone, code_hash, purpose, expire_date)
              OUTPUT inserted.id, inserted.expire_date, inserted.create_date
              VALUES (@phone, @codeHash, @purpose, DATEADD(MINUTE, 5, SYSUTCDATETIME()));`);
    return inserted.recordset[0];
  });

  try {
    await sendSms({ to: phone, text: buildVerificationSms(PURPOSE_LABELS[purpose], code) });
  } catch (error) {
    // 발송에 실패하면 새 기록을 지운다 (보낸 횟수에 세지 않고 바로 다시 보낼 수 있게)
    await pool.request().input('id', sql.BigInt, saved.id)
      .query('DELETE FROM phone_verifications WHERE id = @id').catch(() => {});
    console.error('인증 문자 발송 실패:', error?.name);
    throw new AppError(500, 'SMS_SEND_FAILED', '문자를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return {
    verificationId: Number(saved.id),
    expireDate: saved.expire_date.toISOString(),
    resendAvailableDate: new Date(saved.create_date.getTime() + 60 * 1000).toISOString(),
  };
}

// 인증번호 확인 (api.md POST /api/phone-verifications/{id}/verify, 이메일 인증과 같은 처리 순서)
export async function verifyPhoneCode(id, code) {
  const pool = await getPool();
  // 비교 전에 틀린 횟수를 먼저 1 올린다 (만료 전, 5 미만, 아직 인증 전일 때만)
  const counted = await pool.request().input('id', sql.BigInt, id).input('maxFailCount', sql.Int, MAX_FAIL_COUNT)
    .query(`UPDATE phone_verifications SET fail_count = fail_count + 1
            OUTPUT inserted.code_hash, inserted.fail_count
            WHERE id = @id AND is_verified = 0 AND fail_count < @maxFailCount
              AND expire_date > SYSUTCDATETIME()`);

  if (counted.recordset.length === 0) {
    const found = await pool.request().input('id', sql.BigInt, id)
      .query('SELECT is_verified, fail_count FROM phone_verifications WHERE id = @id');
    const row = found.recordset[0];
    if (!row) {
      throw notFound();
    }
    if (row.is_verified) {
      return { isVerified: true };
    }
    if (row.fail_count >= MAX_FAIL_COUNT) {
      throw lockedError();
    }
    throw new AppError(400, 'VERIFICATION_EXPIRED', '인증번호가 만료되었습니다. 다시 발송해 주세요.');
  }

  const { code_hash: codeHash, fail_count: failCount } = counted.recordset[0];
  if (await bcrypt.compare(code, codeHash)) {
    await pool.request().input('id', sql.BigInt, id)
      .query(`UPDATE phone_verifications
              SET fail_count = fail_count - 1, is_verified = 1, verify_date = SYSUTCDATETIME()
              WHERE id = @id`);
    return { isVerified: true };
  }
  if (failCount >= MAX_FAIL_COUNT) {
    throw lockedError();
  }
  throw new AppError(400, 'VERIFICATION_CODE_MISMATCH',
    `인증번호가 틀렸습니다. (남은 횟수 ${MAX_FAIL_COUNT - failCount}회)`);
}

function lockedError() {
  return new AppError(400, 'VERIFICATION_LOCKED', '인증번호가 무효가 되었습니다. 다시 발송해 주세요.');
}

// 인증 완료 후 30분 안의 그 번호·용도 인증인지 (D-044, D-168). runner 는 pool 또는 트랜잭션
export async function checkPhoneVerified(runner, { phone, verificationId, purpose }) {
  const request = runner.request ? runner.request() : new sql.Request(runner);
  const result = await request
    .input('id', sql.BigInt, verificationId)
    .input('phone', sql.NVarChar(11), phone)
    .input('purpose', sql.NVarChar(20), purpose)
    .query(`SELECT TOP 1 id FROM phone_verifications
            WHERE id = @id AND phone = @phone AND purpose = @purpose AND is_verified = 1
              AND verify_date > DATEADD(MINUTE, -30, SYSUTCDATETIME())`);
  if (result.recordset.length === 0) {
    throw new AppError(400, 'PHONE_NOT_VERIFIED', '전화번호 인증을 완료해 주세요.');
  }
}
