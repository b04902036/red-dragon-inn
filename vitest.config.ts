import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const migrations = await readD1Migrations('./migrations');
const sampleSeed = await readD1Migrations('./seeds');

export default defineConfig({
  test: {
    // Bound CPU-heavy replay and production-content suites on high-core machines.
    maxWorkers: 4,
    coverage: {
      provider: 'istanbul',
      exclude: ['tests/**', 'scripts/**', '**/*.d.ts'],
      include: [
        'src/client/audio/audio-engine.ts',
        'src/client/audio/buffered-music.ts',
        'src/client/audio/settings.ts',
        'src/client/cards/**/*.ts',
        'src/client/cards/**/*.tsx',
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
                CONTENT_MODE: 'fixture',
                FIXTURE_CONTENT_VERSION: 'content_sample_localized_v1',
                TEST_MIGRATIONS: migrations,
                TEST_SAMPLE_SEED: sampleSeed,
              },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          exclude: [
            'tests/worker/production-content.test.ts',
            'tests/worker/rdi1-content.test.ts',
          ],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                CONTENT_MODE: 'production',
                FIXTURE_CONTENT_VERSION: '',
                TEST_MIGRATIONS: migrations,
                TEST_SAMPLE_SEED: sampleSeed,
                TEST_RDI1_PACK_JSON: readFileSync(
                  'content-private/imports/rdi1/pack.json',
                  'utf8',
                ),
              },
            },
          }),
        ],
        test: {
          name: 'production-worker',
          include: [
            'tests/worker/production-content.test.ts',
            'tests/worker/rdi1-content.test.ts',
          ],
        },
      },
    ],
  },
});
