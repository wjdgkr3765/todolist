// backend/.env 를 읽는다 (값은 출력하지 않는다)
process.loadEnvFile(new URL('../.env', import.meta.url));
