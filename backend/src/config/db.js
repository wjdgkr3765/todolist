// SQL Server 연결 (database.md 1, D-034). 모든 쿼리는 파라미터 바인딩으로 작성한다 (security.md 5번)
import sql from 'mssql';
import { env } from './env.js';

const config = {
  server: env.dbServer,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  // DB_PORT 를 적으면 포트 우선, 아니면 이름 있는 인스턴스로 접속 (D-034)
  ...(env.dbPort ? { port: env.dbPort } : {}),
  options: {
    ...(env.dbPort ? {} : { instanceName: env.dbInstance }),
    encrypt: true,
    // 로컬 SQL Server 의 자체 서명 인증서를 믿는다 (SSMS 의 "서버 인증서 신뢰"와 같음)
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise;
    poolPromise = null;
    await pool.close();
  }
}

// 트랜잭션 안에서 work(transaction) 를 실행하고, 오류가 나면 되돌린다
export async function withTransaction(work) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

// UNIQUE 위반 오류 번호 (2627: UNIQUE 제약, 2601: UNIQUE 인덱스)
export function isUniqueViolation(error) {
  return error?.number === 2627 || error?.number === 2601;
}

export { sql };
