import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('gambling report shows antes, both control categories, clockwise passes, one payout, and safe public inspection', async ({
  page,
}) => {
  await page.goto(pathToFileURL(resolve('.tools/engine-demo/trace.html')).href);
  const trace = page.locator('#gambling-trace');
  await expect(
    trace.getByRole('heading', { name: 'Gambling round' }),
  ).toBeVisible();
  await expect(trace).toContainText(
    'Gambling replay and snapshot resume: passed. Gold + pot: 40 at every accepted command.',
  );
  const rows = trace.locator('tbody tr');
  await expect(rows).toHaveCount(8);
  for (let index = 0; index < 7; index += 1) {
    await expect(rows.nth(index).locator('td').nth(1)).toHaveText('4');
    await expect(rows.nth(index).locator('td').nth(5)).toHaveText(
      '9 / 9 / 9 / 9',
    );
    await expect(rows.nth(index).locator('td').nth(7)).toHaveText('ACTION');
  }
  for (const [index, controller, priority] of [
    [0, 1, 2],
    [1, 1, 2],
    [2, 2, 3],
    [3, 2, 3],
    [4, 3, 4],
    [5, 3, 1],
    [6, 3, 2],
  ] as const) {
    await expect(rows.nth(index).locator('td').nth(2)).toHaveText(
      `Sample player ${controller}`,
    );
    await expect(rows.nth(index).locator('td').nth(3)).toHaveText(
      `Sample player ${priority}`,
    );
  }
  await expect(rows.nth(1).locator('td').nth(4)).toHaveText('Sample player 3');
  await expect(rows.nth(3).locator('td').nth(4)).toHaveText('Sample player 4');
  await expect(rows.last().locator('td').nth(1)).toHaveText('0');
  await expect(rows.last().locator('td').nth(2)).toHaveText('None');
  await expect(rows.last().locator('td').nth(5)).toHaveText('9 / 9 / 13 / 9');
  await expect(rows.last().locator('td').nth(7)).toHaveText('ORDER_DRINK');
  const events = await rows.locator('td:nth-child(9)').allTextContents();
  expect(events.join(' ').match(/GAMBLING_FINISHED/g)).toHaveLength(1);
  await rows
    .first()
    .getByText('Inspect public gambling view', { exact: true })
    .click();
  const publicDetails = rows.first().locator('details').last();
  await expect(publicDetails.locator('pre')).toBeVisible();
  const view = JSON.parse(
    (await publicDetails.locator('pre').textContent())!,
  ) as {
    activePlayerId: string;
    gambling: Record<string, unknown>;
    players: Record<string, unknown>[];
  };
  expect(view.activePlayerId).toBe('player_0');
  expect(view.gambling.contributions).toHaveLength(4);
  expect(view.gambling).not.toHaveProperty('suspended');
  for (const player of view.players) {
    expect(player).not.toHaveProperty('hand');
    expect(player).not.toHaveProperty('characterDeck');
    expect(player).not.toHaveProperty('drinkPile');
  }
});
