import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('Drink chain report waits for responses, passes out at equality, redistributes Gold, and advances to a survivor', async ({
  page,
}) => {
  await page.goto(pathToFileURL(resolve('.tools/engine-demo/trace.html')).href);
  const report = page.locator('#drinks-trace');
  const rows = report.locator('tbody tr');
  await expect(
    report.getByRole('heading', { name: 'Drink chain and elimination' }),
  ).toBeVisible();
  await expect(report).toContainText(
    'Drink replay and snapshot resume: passed. Physical card conservation: 34.',
  );
  await expect(rows).toHaveCount(6);
  for (let i = 0; i < 5; i += 1) {
    await expect(rows.nth(i).locator('td').nth(2)).toHaveText('18');
    await expect(rows.nth(i).locator('td').nth(3)).toHaveText('20');
    await expect(rows.nth(i).locator('td').nth(4)).toHaveText('Playing');
  }
  await expect(rows.nth(1).locator('td').nth(1)).toContainText('→');
  await expect(rows.last().locator('td').nth(2)).toHaveText('20');
  await expect(rows.last().locator('td').nth(3)).toHaveText('20');
  await expect(rows.last().locator('td').nth(4)).toHaveText('Eliminated');
  await expect(rows.last().locator('td').nth(5)).toHaveText('0 / 11 / 11 / 11');
  await expect(rows.last().locator('td').nth(6)).toHaveText('DISCARD_DRAW');
  await expect(rows.last().locator('td').nth(7)).toContainText(
    'Sample player 2',
  );
  await rows
    .nth(1)
    .getByText('Inspect public Drink view', { exact: true })
    .click();
  const view = JSON.parse(
    (await rows.nth(1).locator('pre').textContent())!,
  ) as {
    resolutionStack: { sourceCards: unknown[] }[];
    players: Record<string, unknown>[];
  };
  expect(view.resolutionStack[0]!.sourceCards).toHaveLength(3);
  for (const player of view.players) {
    expect(player).not.toHaveProperty('hand');
    expect(player).not.toHaveProperty('drinkPile');
  }
});
test('sample match report visibly finishes with exactly one surviving winner', async ({
  page,
}) => {
  await page.goto(pathToFileURL(resolve('.tools/engine-demo/trace.html')).href);
  const report = page.locator('#complete-match');
  await expect(report).toContainText(
    'Complete sample match: FINISHED. Replay: passed. Winner:',
  );
  await expect(page.locator('#sample-winner')).toContainText('Sample player');
  const final = report.locator('tbody tr').last();
  await expect(final.locator('td').nth(2)).toHaveText('FINISHED');
  await expect(final.locator('td').nth(4)).toHaveText('1');
  await final.getByText('Inspect public match view', { exact: true }).click();
  const view = JSON.parse((await final.locator('pre').textContent())!) as {
    winners: string[];
    players: { id: string; eliminated: boolean; displayName: string }[];
  };
  expect(view.winners).toHaveLength(1);
  const survivors = view.players.filter((player) => !player.eliminated);
  expect(survivors).toHaveLength(1);
  expect(view.winners).toEqual([survivors[0]!.id]);
  await expect(page.locator('#sample-winner')).toHaveText(
    survivors[0]!.displayName,
  );
});
