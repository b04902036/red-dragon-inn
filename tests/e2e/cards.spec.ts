import { test, expect, type Page, type Locator } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { decodeClientRoomMessage } from '../../src/protocol/codec';
async function metadata(page: Page, id: string) {
  return roomMetadataSchema.parse(
    await (await page.request.get(`/api/rooms/${id}`)).json(),
  ).view;
}
async function act(page: Page, id: string, button: Locator) {
  const version = (await metadata(page, id)).version;
  await button.click();
  await expect
    .poll(async () => (await metadata(page, id)).version)
    .toBeGreaterThan(version);
  await expect(page.getByRole('status')).toHaveText('Synced');
}
test('whole-card selection/deselection, hover/focus, no button bubbling, mobile details and reduced motion preserve server intents', async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext(),
    host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [],
    frames: string[] = [];
  for (const page of [host, guest]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
  }
  host.on('websocket', (socket) =>
    socket.on('framesent', (frame) => frames.push(String(frame.payload))),
  );
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue(),
      id = new URL(invite).searchParams.get('room')!;
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await act(host, id, host.getByRole('button', { name: 'Start match' }));
    const shoves = host.locator('.hand-card').filter({
        has: host.getByRole('heading', {
          name: 'Sample Friendly Shove',
          exact: true,
        }),
      }),
      first = shoves.nth(0),
      second = shoves.nth(1),
      negate = host.locator('.hand-card').filter({
        has: host.getByRole('heading', {
          name: 'Sample Cancel That',
          exact: true,
        }),
      });
    await first.locator('.card-body').click();
    await second.getByRole('heading').click();
    await expect(host.locator('.selected-card')).toHaveCount(2);
    await second.locator('.card-body').click();
    await expect(second.getByRole('checkbox')).not.toBeChecked();
    await expect(host.locator('.selected-card')).toHaveCount(1);
    await first.hover();
    await expect(
      host.getByRole('region', { name: 'Card details' }),
    ).toContainText('Fortitude -2');
    const breather = host.locator('.hand-card').filter({
      has: host.getByRole('heading', {
        name: 'Sample Quiet Breather',
        exact: true,
      }),
    });
    await breather.hover();
    await expect(
      host.getByRole('region', { name: 'Card details' }).getByRole('heading'),
    ).toHaveText('Sample Quiet Breather');
    await expect(host.getByRole('button', { name: /^Read / })).toHaveCount(0);
    await second.locator('.card-body').focus();
    await host.keyboard.press('Space');
    await expect(second.getByRole('checkbox')).toBeChecked();
    await host.keyboard.press('Enter');
    await expect(second.getByRole('checkbox')).not.toBeChecked();
    await host.keyboard.press('Escape');
    await expect(
      host.getByRole('region', { name: 'Card details' }),
    ).toHaveCount(0);
    await expect(second.locator('.card-body')).toBeFocused();
    await host.setViewportSize({ width: 390, height: 844 });
    await host.emulateMedia({ reducedMotion: 'reduce' });
    await breather
      .getByRole('button', { name: 'Details: Sample Quiet Breather' })
      .click();
    await expect(
      host.getByRole('region', { name: 'Card details' }),
    ).toContainText('Fortitude +1');
    await expect(breather.getByRole('checkbox')).not.toBeChecked();
    await host.getByRole('button', { name: 'Close card details' }).click();
    await negate.locator('.card-body').click();
    await expect(negate.getByRole('checkbox')).toBeChecked();
    expect(
      await negate.evaluate(
        (element) =>
          element.ownerDocument.defaultView!.getComputedStyle(element)
            .transform,
      ),
    ).toBe('none');
    await host.screenshot({ path: '.tools/step16-mobile.png', fullPage: true });
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.emulateMedia({ reducedMotion: 'no-preference' });
    const selected = await host
      .locator('.selected-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-card-id')),
      );
    expect(selected).toHaveLength(2);
    await act(
      host,
      id,
      breather.getByRole('button', { name: 'Play Sample Quiet Breather' }),
    );
    await expect(host.locator('.selected-card')).toHaveCount(2);
    for (let index = 0; index < 8; index++) {
      const state = await metadata(host, id);
      if (!state.responseWindow) break;
      const page =
        state.players.find(
          (player) => player.id === state.responseWindow!.priorityPlayerId,
        )!.displayName === 'Host'
          ? host
          : guest;
      await act(page, id, page.getByRole('button', { name: 'Pass response' }));
    }
    await act(
      host,
      id,
      host.getByRole('button', { name: 'Discard and draw', exact: true }),
    );
    const discard = frames
      .map(decodeClientRoomMessage)
      .find(
        (message) =>
          message.type === 'COMMAND' && message.command.type === 'DISCARD',
      );
    const submitted =
      discard?.type === 'COMMAND' && discard.command.type === 'DISCARD'
        ? discard.command.cardIds
        : [];
    // Selection order follows clicks; DOM order follows the shuffled hand. Verify the exact physical IDs.
    expect([...submitted].sort()).toEqual([...selected].sort());
    await expect(host.locator('.selected-card')).toHaveCount(0);
    await expect(
      host.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible();
    await host.locator('.hand-card').first().hover();
    await host.screenshot({
      path: '.tools/step16-desktop.png',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
