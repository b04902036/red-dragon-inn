import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/rdi1-rdi2-release.ts',
    outDir: '.tools/rdi1-rdi2-release',
    emptyOutDir: false,
    minify: false,
  },
});
