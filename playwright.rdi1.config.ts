import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/rdi1-content.spec.ts', '**/rdi1-full-verification.spec.ts'],
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run db:migrate && npm run content:compile:rdi1 -- --version content_rdi1_mechanics_v2 && npm run content:publish:rdi1 -- --version content_rdi1_mechanics_v2 && npm run content:verify:rdi1 -- --activate content_rdi1_mechanics_v2 && node scripts/rdi1-e2e-config.mjs && vite build --config vite.rdi1-e2e.config.ts && node scripts/fixture-preview.mjs --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
