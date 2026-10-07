import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/public-presentation.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4178',
    trace: 'retain-on-failure',
  },
  webServer: {
    env: { CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' },
    command:
      'npm run db:migrate && npm run db:seed && node scripts/presentation-e2e-config.mjs && node node_modules/vite/bin/vite.js build --config vite.presentation-e2e.config.ts && node scripts/fixture-preview.mjs --port 4178',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
