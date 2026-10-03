import { expect, test } from '@playwright/test';

test('production preview serves security headers and no debug or private import data', async ({
  page,
  request,
}) => {
  const response = await page.goto('/');
  expect(response!.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  expect(response!.headers()['x-content-type-options']).toBe('nosniff');
  await expect(
    page.getByRole('heading', { name: 'Red Dragon Inn' }),
  ).toBeVisible();
  for (const path of ['/api/debug', '/api/admin', '/api/replay']) {
    const missing = await request.get(path);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).not.toMatch(/deckOrder|resumeToken|tokenHash/);
  }
  const privateFile = await request.get(
    '/content-private/imports/original-verification.json',
  );
  expect(await privateFile.text()).not.toContain(
    'content_import_local_verification',
  );
});
