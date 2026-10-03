import { expect, test } from '@playwright/test';

test('production app loads and can check backend health again', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Red Dragon Inn');
  await expect(
    page.getByRole('heading', { name: 'Red Dragon Inn', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Backend is healthy');
  await expect(page.getByText('Service: red-dragon-inn')).toBeVisible();

  const response = page.waitForResponse((result) =>
    result.url().endsWith('/api/health'),
  );
  await page.getByRole('button', { name: 'Check again' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Backend is healthy');
});

test('unknown API navigation returns JSON 404 instead of the SPA', async ({
  page,
}) => {
  const response = await page.goto('/api/missing');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['content-type']).toContain('application/json');
  expect(await response?.json()).toEqual({
    ok: false,
    error: { code: 'NOT_FOUND' },
  });
  await expect(
    page.getByRole('heading', { name: 'Red Dragon Inn' }),
  ).toHaveCount(0);
});

test('non-API navigation receives the application shell', async ({ page }) => {
  await page.goto('/welcome');
  await expect(
    page.getByRole('heading', { name: 'Red Dragon Inn', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Backend is healthy');
});

test('unavailable backend shows a retry and recovers', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText(
    'Backend is unavailable',
  );
  await page.unroute('**/api/health');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toHaveText('Backend is healthy');
});
