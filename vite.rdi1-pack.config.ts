import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/rdi1-pack.ts',
    outDir: '.tools/rdi1-pack',
    emptyOutDir: false,
    minify: false,
  },
});
