import './scripts/runtime-env.mjs';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    // Quick tunnels receive a different subdomain each time they start.
    allowedHosts: ['.trycloudflare.com'],
  },
});
