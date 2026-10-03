import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { decodeServerMessage } from '../../src/protocol/codec';
import { passPhaseEnd } from './timing-helpers';
test('server-private playable badges follow phases, keyboard selection, reconnect and reduced motion in separate browser contexts', async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const received = [[], []] as ReturnType<typeof decodeServerMessage>[][];
  for (const [index, page] of [host, guest].entries())
    page.on('websocket', (socket) =>
      socket.on('framereceived', (frame) =>
        received[index]!.push(decodeServerMessage(String(frame.payload))),
      ),
    );
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue(),
      id = new URL(invite).searchParams.get('room')!;
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host.request.get(`/api/rooms/${id}`)).json(),
      ).view;
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await host.getByRole('button', { name: 'Start match' }).click();
    const shoves = host.locator('.hand-card').filter({
      has: host.getByRole('heading', {
        name: 'Sample Friendly Shove',
        exact: true,
      }),
    });
    const breather = host.locator('.hand-card').filter({
      has: host.getByRole('heading', {
        name: 'Sample Quiet Breather',
        exact: true,
      }),
    });
    await expect(shoves.first()).toHaveAttribute('data-playable', 'false');
    await expect(breather).toHaveAttribute('data-playable', 'true');
    await expect(breather.getByText('▶ Playable')).toBeVisible();
    await host.emulateMedia({ reducedMotion: 'reduce' });
    await breather.locator('.card-body').focus();
    await host.keyboard.press('Space');
    await expect(breather).toHaveClass(/selected-card/);
    await expect(breather).toHaveClass(/playable-card/);
    await expect(breather.getByRole('checkbox')).toHaveAttribute(
      'aria-description',
      'Playable',
    );
    expect(
      await breather.evaluate(
        (e) => e.ownerDocument.defaultView!.getComputedStyle(e).transform,
      ),
    ).toBe('none');
    expect(
      await breather.evaluate(
        (e) => e.ownerDocument.defaultView!.getComputedStyle(e).borderStyle,
      ),
    ).toBe('dashed');
    await host.keyboard.press('Space');
    await expect(breather.getByRole('checkbox')).not.toBeChecked();
    await host
      .getByRole('button', { name: 'Discard and draw', exact: true })
      .click();
    await passPhaseEnd([host, guest], id);
    await expect(shoves.first()).toHaveAttribute('data-playable', 'true');
    await expect(shoves.first().getByText('▶ Playable')).toBeVisible();
    await expect(
      guest
        .locator('.hand-card')
        .filter({
          has: guest.getByRole('heading', {
            name: 'Sample Friendly Shove',
            exact: true,
          }),
        })
        .first(),
    ).toHaveAttribute('data-playable', 'false');
    const ownIds = await host
      .locator('[data-card-id]')
      .evaluateAll((cards) =>
        cards.map((c) => c.getAttribute('data-card-id')!),
      );
    const guestIds = await guest
      .locator('[data-card-id]')
      .evaluateAll((cards) =>
        cards.map((c) => c.getAttribute('data-card-id')!),
      );
    for (const [index, foreign] of [
      [0, guestIds],
      [1, ownIds],
    ] as const) {
      const privateFrames = received[index]!.filter(
        (m) => m.type === 'PRIVATE_STATE',
      );
      for (const id of foreign)
        expect(JSON.stringify(privateFrames)).not.toContain(JSON.stringify(id));
      expect(
        JSON.stringify(
          received[index]!.filter((m) => m.type === 'PUBLIC_STATE'),
        ),
      ).not.toMatch(/legalPlays|legalPlayVersion|legalTargetPlayerIds/);
    }
    const playableIds = await host
      .locator('[data-playable="true"]')
      .evaluateAll((cards) => cards.map((c) => c.getAttribute('data-card-id')));
    await host.reload();
    await expect(host.getByRole('status')).toHaveText('Synced');
    await expect
      .poll(async () =>
        host
          .locator('[data-playable="true"]')
          .evaluateAll((cards) =>
            cards.map((c) => c.getAttribute('data-card-id')),
          ),
      )
      .toEqual(playableIds);
    await host.screenshot({
      path: '.tools/step20-playable-action.png',
      fullPage: true,
    });
    await host
      .getByRole('button', { name: 'Skip action', exact: true })
      .click();
    await expect(shoves.first()).toHaveAttribute('data-playable', 'false');
    await expect(host.locator('[data-playable="true"]')).toHaveCount(1);
    await expect(guest.locator('[data-playable="true"]')).toHaveCount(0);
    await passPhaseEnd([host, guest], id);
    expect((await view()).phase).toBe('ORDER_DRINK');
    await expect(shoves.first()).toHaveAttribute('data-playable', 'false');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
