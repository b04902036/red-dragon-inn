import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const traceUrl = pathToFileURL(resolve('.tools/engine-demo/trace.html')).href;
test('engine trace shows redraw, ordered drinks, all phases, and the next active seat', async ({
  page,
}) => {
  await page.goto(traceUrl);
  await expect(
    page.getByRole('heading', { name: 'Deterministic engine turn trace' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Replay check: passed. Card conservation: 34 / 34 at every accepted command.',
    ),
  ).toBeVisible();
  await expect(page.locator('#turn-trace tbody tr')).toHaveCount(73);
  const turnRows = page.locator('#turn-trace tbody tr');
  const initial = turnRows.first();
  await expect(initial.locator('td').nth(3)).toHaveText('DISCARD_DRAW');
  await expect(initial.locator('td').nth(5)).toHaveText('3 / 3 / 3 / 3');
  await expect(initial.locator('td').nth(6)).toHaveText('1 / 1 / 1 / 1');
  await expect(initial.locator('td').nth(7)).toHaveText('2');
  const phases = [
    'ACTION',
    'ORDER_DRINK',
    'DRINK',
    'ELIMINATION_CHECK',
    'NEXT_TURN',
    'DISCARD_DRAW',
  ];
  for (let i = 0; i < phases.length; i += 1)
    await expect(
      turnRows
        .nth(i + 1)
        .locator('td')
        .nth(3),
    ).toHaveText(phases[i]!);
  await expect(turnRows.nth(1).locator('td').nth(8)).toContainText(
    'CARDS_DISCARDED, CARDS_DRAWN',
  );
  await expect(turnRows.nth(3).locator('td').nth(7)).toHaveText('1');
  await expect(turnRows.nth(6).locator('td').nth(4)).toHaveText(
    'Sample player 2',
  );
  await expect(page.locator('#turn-trace tbody')).toContainText(
    'DECK_SHUFFLED',
  );
  await expect(page.locator('#turn-trace tbody')).toContainText(
    'DRINK_REVEALED',
  );
  await expect(page.locator('#turn-trace tbody')).toContainText(
    'DRINK_DISCARDED',
  );
});
test('public inspection omits hidden state and pending effects cannot be skipped', async ({
  page,
}) => {
  await page.goto(traceUrl);
  const row = page.locator('#turn-trace tbody tr').nth(1);
  await row.getByText('Inspect public view', { exact: true }).click();
  await expect(row.locator('pre')).toBeVisible();
  await expect(row.locator('pre')).toContainText('"handCount": 3');
  const view = await row.locator('pre').textContent();
  expect(view).not.toContain('card_');
  expect(view).not.toContain('rng');
  expect(view).not.toContain('acceptedCommands');
  const pending = page.locator('#pending-action');
  await expect(pending).toContainText('Sample Friendly Shove');
  await expect(pending).toContainText('Phase stays ACTION');
  await expect(pending).toContainText('target Fortitude stays 20');
  await expect(pending).toContainText('RESOLUTION_PENDING');
  await pending
    .getByText('Inspect revealed action and public view', { exact: true })
    .click();
  await expect(pending.locator('pre')).toContainText('"kind": "CARD"');
});
test('nested response report shows priority, child cancellation, and final visible stat changes', async ({
  page,
}) => {
  await page.goto(traceUrl);
  const trace = page.locator('#timing-trace');
  await expect(
    trace.getByRole('heading', { name: 'Three-level response chain' }),
  ).toBeVisible();
  await expect(trace).toContainText(
    'Nested replay and snapshot resume: passed.',
  );
  const rows = trace.locator('tbody tr');
  await expect(rows).toHaveCount(13);
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('1');
  await expect(rows.nth(2).locator('td').nth(1)).toHaveText('2');
  await expect(rows.nth(4).locator('td').nth(1)).toHaveText('3');
  await expect(rows.nth(4).locator('td').nth(3)).toHaveText('Sample player 3');
  for (let index = 0; index < 12; index += 1)
    await expect(rows.nth(index).locator('td').nth(4)).toHaveText('20');
  await expect(rows.nth(8).locator('td').nth(1)).toHaveText('1');
  await expect(rows.nth(8)).toContainText('SOURCE_NEGATED');
  await expect(page.locator('#unwind-order')).toHaveText(
    'Negate → Ignore (canceled) → Shove',
  );
  await expect(rows.last().locator('td').nth(1)).toHaveText('0');
  await expect(rows.last().locator('td').nth(3)).toHaveText('None');
  await expect(rows.last().locator('td').nth(4)).toHaveText('18');
  await expect(rows.last().locator('td').nth(5)).toHaveText('ORDER_DRINK');
  await expect(page.locator('#timing-outcomes')).toContainText(
    'With Ignore alone, player 2 stays at Fortitude 20.',
  );
  await rows
    .nth(2)
    .getByText('Inspect public timing view', { exact: true })
    .click();
  await expect(rows.nth(2).locator('pre')).toContainText(
    '"priorityPlayerId": "player_1"',
  );
  const publicView = JSON.parse(
    (await rows.nth(2).locator('pre').textContent())!,
  ) as {
    players: Record<string, unknown>[];
    resolutionStack: Record<string, unknown>[];
  };
  for (const player of publicView.players) {
    expect(player).not.toHaveProperty('hand');
    expect(player).not.toHaveProperty('characterDeck');
    expect(player).not.toHaveProperty('drinkPile');
  }
  for (const frame of publicView.resolutionStack)
    expect(frame).not.toHaveProperty('effects');
});
