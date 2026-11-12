// 이메일 인증번호 발송·확인 (api.md 6.2, D-035, D-045, D-122)
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { getPool, withTransaction, sql } from '../config/db.js';
import { sendMail } from '../config/mail.js';
import { AppError, notFound } from '../utils/appError.js';
import { buildVerificationMail } from '../utils/mailTemplate.js';

const CODE_HASH_ROUNDS = 10;
const MAX_FAIL_COUNT = 5;

// 용도별 메일 문구. change_email 은 로그인(requireLogin)이 필요해 로그인 기능을 만들 때 넣는다
const PURPOSE_LABELS = {
  signup: '회원가입',
  find_id: '아이디 찾기',
  find_password: '비밀번호 찾기',
};

export function isSupportedPurpose(purpose) {
  return Object.hasOwn(PURPOSE_LABELS, purpose);
}

// 용도에 따른 사전 확인 (api.md POST /api/email-verifications)
async function checkPurpose(pool, { email, purpose, loginId }) {
  const request = pool.request().input('email', sql.NVarChar(100), email);
  if (purpose === 'find_password') {
    const result = await request
      .input('loginId', sql.NVarChar(15), loginId)
      .query('SELECT TOP 1 id FROM users WHERE login_id = @loginId AND email = @email');
    if (result.recordset.length === 0) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', '아이디와 이메일이 일치하는 회원이 없습니다.');
    }
    return;
  }
  const result = await request.query('SELECT TOP 1 id FROM users WHERE email = @email');
  const isRegistered = result.recordset.length > 0;
  if (purpose === 'signup' && isRegistered) {
    throw new AppError(409, 'EMAIL_DUPLICATED', '이미 가입된 이메일입니다.');
  }
  if (purpose === 'find_id' && !isRegistered) {
    throw new AppError(404, 'EMAIL_NOT_REGISTERED', '가입되지 않은 이메일입니다.');
  }
}

export async function sendVerification({ email, purpose, loginId }) {
  const pool = await getPool();
  await checkPurpose(pool, { email, purpose, loginId });

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);

  const saved = await withTransaction(async (transaction) => {
    // 하루 지난 기록(모든 이메일)을 지운다 (D-122)
    await new sql.Request(transaction).query(
      'DELETE FROM email_verifications WHERE create_date < DATEADD(DAY, -1, SYSUTCDATETIME())',
    );
    // 같은 이메일·용도의 기록을 잠그고 1분 안에 보낸 기록이 있는지 본다 (동시 요청도 한 번만 통과)
    const recent = await new sql.Request(transaction)
      .input('email', sql.NVarChar(100), email)
      .input('purpose', sql.NVarChar(20), purpose)
      .query(`SELECT TOP 1 id FROM email_verifications WITH (UPDLOCK, HOLDLOCK)
              WHERE email = @email AND purpose = @purpose
                AND create_date > DATEADD(MINUTE, -1, SYSUTCDATETIME())`);
    if (recent.recordset.length > 0) {
      throw new AppError(429, 'VERIFICATION_RESEND_TOO_SOON', '1분 뒤에 다시 발송할 수 있습니다.');
    }
    // 재발송하면 이전 번호는 무효 (D-045)
    const inserted = await new sql.Request(transaction)
      .input('email', sql.NVarChar(100), email)
      .input('purpose', sql.NVarChar(20), purpose)
      .input('codeHash', sql.NVarChar(60), codeHash)
      .query(`DELETE FROM email_verifications WHERE email = @email AND purpose = @purpose;
              INSERT INTO email_verifications (email, code_hash, purpose, expire_date)
              OUTPUT inserted.id, inserted.expire_date, inserted.create_date
              VALUES (@email, @codeHash, @purpose, DATEADD(MINUTE, 5, SYSUTCDATETIME()));`);
    return inserted.recordset[0];
  });

  try {
    await sendMail({ to: email, ...buildVerificationMail(PURPOSE_LABELS[purpose], code) });
  } catch (error) {
    // 발송에 실패하면 새 기록을 지워 바로 다시 보낼 수 있게 한다
    await pool.request().input('id', sql.BigInt, saved.id)
      .query('DELETE FROM email_verifications WHERE id = @id').catch(() => {});
    console.error('인증 메일 발송 실패:', error.code ?? error.name);
    throw new AppError(500, 'MAIL_SEND_FAILED', '메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return {
    verificationId: Number(saved.id),
    expireDate: saved.expire_date.toISOString(),
    resendAvailableDate: new Date(saved.create_date.getTime() + 60 * 1000).toISOString(),
  };
}

// 인증번호 확인 (api.md POST /api/email-verifications/{id}/verify 처리 순서)
export async function verifyCode(id, code) {
  const pool = await getPool();
  // 비교 전에 틀린 횟수를 먼저 1 올린다 (만료 전, 5 미만, 아직 인증 전일 때만). 동시에 여러 번 보내도 5번을 넘지 못한다
  const counted = await pool.request().input('id', sql.BigInt, id).input('maxFailCount', sql.Int, MAX_FAIL_COUNT)
    .query(`UPDATE email_verifications SET fail_count = fail_count + 1
            OUTPUT inserted.code_hash, inserted.fail_count
            WHERE id = @id AND is_verified = 0 AND fail_count < @maxFailCount
              AND expire_date > SYSUTCDATETIME()`);

  if (counted.recordset.length === 0) {
    const found = await pool.request().input('id', sql.BigInt, id)
      .query('SELECT is_verified, fail_count, expire_date FROM email_verifications WHERE id = @id');
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
      .query(`UPDATE email_verifications
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
