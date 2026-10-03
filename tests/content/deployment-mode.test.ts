import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('allows the default production deployment guard without publishing anything', () => {
  expect(() =>
    execFileSync(process.execPath, ['scripts/require-production.mjs'], {
      env: { ...process.env, CLOUDFLARE_ENV: '' },
      stdio: 'pipe',
    }),
  ).not.toThrow();
});

it.each(['fixture', 'other'])(
  'rejects %s environment selection before the deployment chain can run',
  (environment) => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/require-production.mjs'], {
        env: { ...process.env, CLOUDFLARE_ENV: environment },
        stdio: 'pipe',
      }),
    ).toThrow('Production deployment requires the default environment');
  },
);
