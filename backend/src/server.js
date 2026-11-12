// HTTP 서버와 Socket.IO 시작 (포트 3000, spec.md 4, api.md 6.8)
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachRealtime } from './realtime/index.js';

const PORT = 3000;

const httpServer = createServer(createApp());
attachRealtime(httpServer);
httpServer.listen(PORT, () => {
  console.log(`백엔드 서버 시작: http://localhost:${PORT}`);
});
