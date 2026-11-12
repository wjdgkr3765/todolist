import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 개발 서버 5173. /api 와 /socket.io(WebSocket) 를 백엔드 3000 으로 넘긴다 (spec.md 4)
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
