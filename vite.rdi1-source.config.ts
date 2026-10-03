import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/rdi1-source.ts',
    outDir: '.tools/rdi1-source',
    emptyOutDir: false,
    minify: false,
  },
});
