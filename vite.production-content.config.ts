import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/production-content.ts',
    outDir: '.tools/production-content',
    emptyOutDir: false,
    minify: false,
  },
});
