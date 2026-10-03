import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/content-import.ts',
    outDir: '.tools/content-import',
    emptyOutDir: false,
    minify: false,
  },
});
