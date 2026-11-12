// api.md 6.1 GET /api/health: 서버와 DB 접속 상태 확인
import { Router } from 'express';
import { getPool } from '../config/db.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS ok');
  res.json({ data: { db: 'ok' } });
});
