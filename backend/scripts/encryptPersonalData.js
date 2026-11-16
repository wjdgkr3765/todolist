// 한 번 실행하는 변환 스크립트 (D-172): users·email_verifications·phone_verifications 구조를 암호화용으로 바꾸고
// 기존 이메일·전화번호를 암호화한다. 이미 바뀐 DB(users.email_hash 가 있음)에서는 아무것도 하지 않는다.
// 실행 (backend 폴더에서, .env 에 DATA_ENCRYPTION_KEY·DATA_HASH_KEY 가 있어야 함):
//   node --env-file=.env scripts/encryptPersonalData.js
import { closePool, withTransaction, getPool, sql } from '../src/config/db.js';
import { encryptText, hashEmail, hashPhone } from '../src/utils/personalData.js';

// 이메일·전화번호에 걸린 UNIQUE·CHECK 제약 이름은 DB 가 자동으로 정했으므로 시스템 표에서 찾아 지운다
const DROP_OLD_CONSTRAINTS = `
DECLARE @drop NVARCHAR(MAX) = N'';
SELECT @drop += N'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(kc.parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.type = 'UQ' AND kc.parent_object_id = OBJECT_ID('users') AND c.name IN ('email', 'phone');
SELECT @drop += N'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
FROM sys.check_constraints
WHERE parent_object_id IN (OBJECT_ID('users'), OBJECT_ID('phone_verifications')) AND definition LIKE N'%len(_phone_)%';
EXEC sp_executesql @drop;`;

// 구조 바꾸기: 열 넓히기, 해시 열 더하기 (값은 다음 단계에서 채운다)
const ALTER_COLUMNS = [
  'DROP INDEX idx_email_verifications_email ON email_verifications',
  'DROP INDEX idx_phone_verifications_phone ON phone_verifications',
  'ALTER TABLE users ALTER COLUMN email NVARCHAR(200) NOT NULL',
  'ALTER TABLE users ALTER COLUMN phone NVARCHAR(80) NOT NULL',
  'ALTER TABLE email_verifications ALTER COLUMN email NVARCHAR(200) NOT NULL',
  'ALTER TABLE phone_verifications ALTER COLUMN phone NVARCHAR(80) NOT NULL',
  'ALTER TABLE users ADD email_hash NVARCHAR(64) NULL, phone_hash NVARCHAR(64) NULL',
  'ALTER TABLE email_verifications ADD email_hash NVARCHAR(64) NULL',
  'ALTER TABLE phone_verifications ADD phone_hash NVARCHAR(64) NULL',
];

// 값을 채운 뒤 NOT NULL·UNIQUE·인덱스 (database.md 4)
const FINISH = [
  'ALTER TABLE users ALTER COLUMN email_hash NVARCHAR(64) NOT NULL',
  'ALTER TABLE users ALTER COLUMN phone_hash NVARCHAR(64) NOT NULL',
  'ALTER TABLE email_verifications ALTER COLUMN email_hash NVARCHAR(64) NOT NULL',
  'ALTER TABLE phone_verifications ALTER COLUMN phone_hash NVARCHAR(64) NOT NULL',
  'ALTER TABLE users ADD UNIQUE (email_hash)',
  'ALTER TABLE users ADD UNIQUE (phone_hash)',
  'CREATE INDEX idx_email_verifications_email_hash ON email_verifications (email_hash, purpose, create_date)',
  'CREATE INDEX idx_phone_verifications_phone_hash ON phone_verifications (phone_hash, create_date)',
];

async function main() {
  const pool = await getPool();
  const done = await pool.request().query("SELECT COL_LENGTH('users', 'email_hash') AS length");
  if (done.recordset[0].length !== null) {
    console.log('이미 바뀐 DB 입니다. 아무것도 하지 않았습니다.');
    return;
  }
  const counts = await withTransaction(async (transaction) => {
    const run = (text) => new sql.Request(transaction).query(text);
    const users = (await run('SELECT id, email, phone FROM users')).recordset;
    const emails = (await run('SELECT id, email FROM email_verifications')).recordset;
    const phones = (await run('SELECT id, phone FROM phone_verifications')).recordset;

    await run(DROP_OLD_CONSTRAINTS);
    for (const text of ALTER_COLUMNS) {
      await run(text);
    }
    for (const row of users) {
      await new sql.Request(transaction).input('id', sql.BigInt, row.id)
        .input('email', sql.NVarChar(200), encryptText(row.email)).input('emailHash', sql.NVarChar(64), hashEmail(row.email))
        .input('phone', sql.NVarChar(80), encryptText(row.phone)).input('phoneHash', sql.NVarChar(64), hashPhone(row.phone))
        .query('UPDATE users SET email = @email, email_hash = @emailHash, phone = @phone, phone_hash = @phoneHash WHERE id = @id');
    }
    for (const row of emails) {
      await new sql.Request(transaction).input('id', sql.BigInt, row.id)
        .input('email', sql.NVarChar(200), encryptText(row.email)).input('emailHash', sql.NVarChar(64), hashEmail(row.email))
        .query('UPDATE email_verifications SET email = @email, email_hash = @emailHash WHERE id = @id');
    }
    for (const row of phones) {
      await new sql.Request(transaction).input('id', sql.BigInt, row.id)
        .input('phone', sql.NVarChar(80), encryptText(row.phone)).input('phoneHash', sql.NVarChar(64), hashPhone(row.phone))
        .query('UPDATE phone_verifications SET phone = @phone, phone_hash = @phoneHash WHERE id = @id');
    }
    for (const text of FINISH) {
      await run(text);
    }
    return { users: users.length, emails: emails.length, phones: phones.length };
  });
  // 값은 찍지 않고 건수만 알린다
  console.log(`변환 끝: 회원 ${counts.users}명, 이메일 인증 기록 ${counts.emails}건, 전화번호 인증 기록 ${counts.phones}건`);
}

try {
  await main();
} catch (error) {
  console.error('변환 실패 (바뀐 것은 모두 되돌렸습니다):', error?.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
