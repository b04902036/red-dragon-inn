import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    ssr: 'scripts/localization.ts',
    outDir: '.tools/localization',
    emptyOutDir: false,
    minify: false,
  },
});
