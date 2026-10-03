import { test, expect, type Page, type Locator } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { passPhaseEnd } from './timing-helpers';
const peers = new Map<string, Page[]>();

async function metadata(page: Page, roomId: string) {
  const response = await page.request.get(`/api/rooms/${roomId}`);
  return roomMetadataSchema.parse(await response.json()).view;
}
async function act(page: Page, roomId: string, button: Locator) {
  const version = (await metadata(page, roomId)).version;
  await button.click();
  await expect
    .poll(async () => (await metadata(page, roomId)).version)
    .toBeGreaterThan(version);
  await expect(page.getByRole('status')).toHaveText('Synced');
  if (peers.has(roomId)) await passPhaseEnd(peers.get(roomId)!, roomId);
}
async function passResponses(pages: Page[], roomId: string) {
  for (let limit = 0; limit < 24; limit++) {
    const view = await metadata(pages[0]!, roomId);
    if (!view.responseWindow) return;
    const name = view.players.find(
      (player) => player.id === view.responseWindow!.priorityPlayerId,
    )!.displayName;
    const page = pages[name === 'Host' ? 0 : 1]!;
    const pass = page.getByRole('button', { name: 'Pass response' });
    await expect(pass).toBeEnabled();
    await act(page, roomId, pass);
  }
  throw new Error('Responses did not finish');
}
test('two players use the table, reactions, Drinks, gambling, refresh and mobile turn without browser errors', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const pages = [host, guest];
  const errors: string[] = [];
  for (const page of pages) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  }
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(
      host.getByRole('heading', { name: 'Your table at the inn' }),
    ).toBeVisible();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    peers.set(roomId, pages);
    expect(invite).not.toMatch(/token|player_/);
    await host.getByLabel('Your character').selectOption('character_sample_2');
    await expect(host.getByLabel('Your character')).toHaveValue(
      'character_sample_2',
    );
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    for (const page of pages) {
      await expect(page.locator('.lobby-seats li')).toHaveCount(2);
      await expect(
        page.locator('.lobby-seats').getByText(/Connected/),
      ).toHaveCount(2);
    }
    await guest.getByLabel('Your character').selectOption('character_sample_3');
    await expect(guest.getByLabel('Your character')).toHaveValue(
      'character_sample_3',
    );
    await act(host, roomId, host.getByRole('button', { name: 'Start match' }));
    for (const page of pages)
      await expect(page.locator('[data-card-id]')).toHaveCount(7);
    const initial = await metadata(host, roomId);
    expect(initial.players.map((player) => player.characterId)).toEqual([
      'character_sample_2',
      'character_sample_3',
    ]);
    for (const player of initial.players)
      expect(player).toMatchObject({
        fortitude: 20,
        alcoholContent: 0,
        gold: 10,
        handCount: 7,
        drinkPileCount: 1,
      });
    const ids = await Promise.all(
      pages.map((page) =>
        page
          .locator('[data-card-id]')
          .evaluateAll((cards) =>
            cards.map((card) => card.getAttribute('data-card-id')),
          ),
      ),
    );
    expect(ids[0]!.filter((id) => ids[1]!.includes(id))).toEqual([]);
    await expect(host.locator('.opponents [data-card-id]')).toHaveCount(0);
    await expect(guest.locator('.opponents [data-card-id]')).toHaveCount(0);
    const shove = host
      .locator('.hand-card')
      .filter({
        has: host.getByRole('heading', {
          name: 'Sample Friendly Shove',
          exact: true,
        }),
      })
      .first();
    await shove.hover();
    await expect(
      host.getByRole('region', { name: 'Card details' }),
    ).toContainText('Fortitude');
    await shove.locator('.card-body').focus();
    await host.keyboard.press('Escape');
    await expect(
      host.getByRole('region', { name: 'Card details' }),
    ).toHaveCount(0);
    await expect(shove.locator('.card-body')).toBeFocused();
    const breather = host.locator('.hand-card').filter({
      has: host.getByRole('heading', {
        name: 'Sample Quiet Breather',
        exact: true,
      }),
    });
    await breather.getByRole('heading').click();
    await expect(breather.getByRole('checkbox')).toBeChecked();
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Discard and draw' }),
    );
    await expect(
      host.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible();
    await expect(host.locator('[data-card-id]')).toHaveCount(7);
    await host
      .getByRole('button', { name: 'Play Sample Friendly Shove' })
      .first()
      .click();
    await act(
      host,
      roomId,
      host
        .getByRole('dialog')
        .getByRole('button', { name: 'Guest', exact: true }),
    );
    await expect(
      guest.getByRole('heading', { name: 'Response window' }),
    ).toBeVisible();
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Pass response' }),
    );
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Respond with Sample Brush It Off' }),
    );
    await passResponses(pages, roomId);
    await expect(
      guest.locator('.own-player .stats').getByText('20', { exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole('heading', { name: 'Order a Drink', exact: true }),
    ).toBeVisible();
    await host
      .getByRole('button', { name: 'Order a Drink', exact: true })
      .click();
    await act(
      host,
      roomId,
      host
        .getByRole('dialog')
        .getByRole('button', { name: 'Guest', exact: true }),
    );
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Take a Drink', exact: true }),
    );
    await passResponses(pages, roomId);
    expect((await metadata(host, roomId)).innDrinkDiscardCount).toBeGreaterThan(
      0,
    );
    await expect(host.locator('.discard-pile strong')).not.toHaveText('0');
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Continue turn' }),
    );
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Continue turn' }),
    );
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Discard and draw' }),
    );
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Play Sample Raise the Stakes' }),
    );
    await passResponses(pages, roomId);
    await expect(
      host.getByRole('heading', { name: 'Gambling round' }),
    ).toBeVisible();
    await expect(host.getByText('Pot: 2 Gold')).toBeVisible();
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Pass gambling' }),
    );
    await expect(
      guest.getByRole('heading', { name: 'Gambling round' }),
    ).toHaveCount(0);
    await expect(guest.locator('.event-log')).toContainText(
      'pot has been paid',
    );
    const guestHand = await guest
      .locator('[data-card-id]')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-card-id')),
      );
    await guest.reload();
    await expect(guest.getByRole('status')).toHaveText('Synced');
    await expect(
      guest.getByRole('heading', { name: 'Order a Drink', exact: true }),
    ).toBeVisible();
    expect(
      await guest
        .locator('[data-card-id]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute('data-card-id')),
        ),
    ).toEqual(guestHand);
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest
      .getByRole('button', { name: 'Order a Drink', exact: true })
      .click();
    await act(
      guest,
      roomId,
      guest
        .getByRole('dialog')
        .getByRole('button', { name: 'Host', exact: true }),
    );
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Take a Drink', exact: true }),
    );
    await passResponses(pages, roomId);
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Continue turn' }),
    );
    await act(
      guest,
      roomId,
      guest.getByRole('button', { name: 'Continue turn' }),
    );
    await host.setViewportSize({ width: 390, height: 844 });
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Discard and draw' }),
    );
    await act(host, roomId, host.getByRole('button', { name: 'Skip action' }));
    await host
      .getByRole('button', { name: 'Order a Drink', exact: true })
      .click();
    await act(
      host,
      roomId,
      host
        .getByRole('dialog')
        .getByRole('button', { name: 'Guest', exact: true }),
    );
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Take a Drink', exact: true }),
    );
    await passResponses(pages, roomId);
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Continue turn' }),
    );
    await act(
      host,
      roomId,
      host.getByRole('button', { name: 'Continue turn' }),
    );
    await expect(
      guest.getByRole('heading', { name: 'Discard and draw', exact: true }),
    ).toBeVisible();
    expect(
      await host.locator('body').evaluate((element) => element.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await host.screenshot({ path: '.tools/step08-mobile.png', fullPage: true });
    await guest.setViewportSize({ width: 1440, height: 1000 });
    await guest.screenshot({
      path: '.tools/step08-desktop.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
