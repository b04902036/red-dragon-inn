import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/rdi2-source.ts',
    outDir: '.tools/rdi2-source',
    emptyOutDir: false,
    minify: false,
  },
});
