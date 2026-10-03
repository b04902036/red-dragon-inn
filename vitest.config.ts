import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('./migrations');
const sampleSeed = await readD1Migrations('./seeds');

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      exclude: ['tests/**', 'scripts/**', '**/*.d.ts'],
      include: [
        'src/engine/**/*.ts',
        'src/content/**/*.ts',
        'src/protocol/**/*.ts',
        'src/shared/ids.ts',
        'src/shared/version.ts',
        'worker/**/*.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        perFile: true,
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
    projects: [
      {
        test: {
          name: 'contracts',
          environment: 'node',
          include: [
            'tests/engine/**/*.test.ts',
            'tests/protocol/**/*.test.ts',
            'tests/content/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['tests/client/**/*.test.tsx'],
          setupFiles: ['tests/client/setup.ts'],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: migrations,
                TEST_SAMPLE_SEED: sampleSeed,
              },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
        },
      },
    ],
  },
});
