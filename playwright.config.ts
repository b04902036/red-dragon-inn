import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/rdi1-content.spec.ts', '**/rdi1-full-verification.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: [
        '**/replay-inspector.spec.ts',
        '**/localization.spec.ts',
        '**/rdi1-content.spec.ts',
        '**/rdi1-full-verification.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-replay',
      dependencies: ['chromium'],
      testMatch: ['**/replay-inspector.spec.ts', '**/localization.spec.ts'],
      // These CLI probes open the same local D1 file in independent Miniflare runtimes.
      // Serialize the probes; all browser assertions and other journeys remain parallel.
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    env: { CLOUDFLARE_ENV: 'fixture' },
    command:
      'npm run db:migrate && npm run db:seed && npm run build && node scripts/fixture-preview.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
