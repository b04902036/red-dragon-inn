import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'scripts/replay-inspector.ts',
    outDir: '.tools/replay-inspector',
    emptyOutDir: false,
    minify: false,
  },
});
