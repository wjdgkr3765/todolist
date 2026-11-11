// 시안용 Tiptap 묶음을 만든다 (D-162). 실행: npm run mockup:tiptap
// 결과: docs/mockups/vendor/tiptap.iife.js (window.Tiptap)
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: here('../../docs/mockups/vendor'),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: here('./mockup-tiptap-entry.js'),
      name: 'Tiptap',
      formats: ['iife'],
      fileName: () => 'tiptap.iife.js',
    },
  },
});
console.log('docs/mockups/vendor/tiptap.iife.js 를 만들었습니다.');
