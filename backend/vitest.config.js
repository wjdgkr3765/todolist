import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    // 테스트가 같은 개발 DB 를 쓰므로 파일을 하나씩 실행한다
    fileParallelism: false,
    testTimeout: 20000,
  },
});
