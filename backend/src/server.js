// HTTP 서버 시작 (포트 3000, spec.md 4). Socket.IO 는 실시간 반영 기능(api.md 6.8)을 만들 때 붙인다
import { createApp } from './app.js';

const PORT = 3000;

createApp().listen(PORT, () => {
  console.log(`백엔드 서버 시작: http://localhost:${PORT}`);
});
