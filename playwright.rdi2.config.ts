import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/rdi2-content.spec.ts', '**/rdi2-full-verification.spec.ts'],
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run db:migrate && npm run content:compile:rdi2 && npm run content:publish:rdi2 && node scripts/rdi2-e2e-config.mjs && node node_modules/vite/bin/vite.js build --config vite.rdi2-e2e.config.ts && node scripts/fixture-preview.mjs --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
