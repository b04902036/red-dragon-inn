import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/engine-demo.ts',
    outDir: '.tools/engine-demo',
    emptyOutDir: false,
    minify: false,
  },
});
