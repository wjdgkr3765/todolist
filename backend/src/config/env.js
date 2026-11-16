// 환경 변수 읽기 (security.md 1번: 비밀 정보는 backend/.env 에만 둔다. 값은 로그에 찍지 않는다)
const REQUIRED_KEYS = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'MAIL_USER', 'MAIL_PASSWORD'];
const DATA_KEY_BYTES = 32;

// base64 로 적은 32바이트 키 (D-172). 값은 오류 문구에 넣지 않는다
function readKey(name) {
  const key = Buffer.from(process.env[name] ?? '', 'base64');
  if (key.length !== DATA_KEY_BYTES) {
    throw new Error(`backend/.env 의 ${name} 는 base64 로 적은 ${DATA_KEY_BYTES}바이트 키여야 합니다`);
  }
  return key;
}

function readEnv() {
  const missingKeys = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (!process.env.DB_INSTANCE && !process.env.DB_PORT) {
    missingKeys.push('DB_INSTANCE 또는 DB_PORT');
  }
  if (missingKeys.length > 0) {
    throw new Error(`backend/.env 에 값이 없는 환경 변수: ${missingKeys.join(', ')}`);
  }
  const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : null;
  if (dbPort !== null && !(Number.isInteger(dbPort) && dbPort >= 1 && dbPort <= 65535)) {
    throw new Error('DB_PORT 는 1~65535 사이 숫자여야 합니다');
  }
  return {
    isProduction: process.env.NODE_ENV === 'production',
    dbServer: process.env.DB_SERVER,
    dbInstance: process.env.DB_INSTANCE || null,
    dbPort,
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    mailUser: process.env.MAIL_USER,
    mailPassword: process.env.MAIL_PASSWORD,
    holidayApiKey: process.env.HOLIDAY_API_KEY || '',
    // SOLAPI 문자 발송 (D-168). 없으면 서버는 뜨고 문자 발송만 실패한다 (500 SMS_SEND_FAILED)
    solapiApiKey: process.env.SOLAPI_API_KEY || '',
    solapiApiSecret: process.env.SOLAPI_API_SECRET || '',
    solapiSender: process.env.SOLAPI_SENDER || '',
    // 이메일·전화번호 암호화 키와 찾기용 해시 키 (D-172). 없거나 32바이트가 아니면 시작하지 않는다
    dataEncryptionKey: readKey('DATA_ENCRYPTION_KEY'),
    dataHashKey: readKey('DATA_HASH_KEY'),
  };
}

export const env = readEnv();
