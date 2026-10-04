import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: '.tools/rdi1-e2e-dist' },
  plugins: [
    react(),
    cloudflare({ configPath: '.tools/rdi1-e2e-wrangler.json' }),
  ],
});
