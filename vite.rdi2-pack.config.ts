import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/rdi2-pack.ts',
    outDir: '.tools/rdi2-pack',
    emptyOutDir: false,
    minify: false,
  },
});
