import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/dev-card-selection.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'development-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    env: { CLOUDFLARE_ENV: 'dev-fixture' },
    command:
      'npm run db:migrate && npm run db:seed && npm run build && node scripts/fixture-preview.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
