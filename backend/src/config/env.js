// 환경 변수 읽기 (security.md 1번: 비밀 정보는 backend/.env 에만 둔다. 값은 로그에 찍지 않는다)
const REQUIRED_KEYS = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'MAIL_USER', 'MAIL_PASSWORD'];

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
  };
}

export const env = readEnv();
