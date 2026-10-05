import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { passPhaseEnd } from './timing-helpers';

test('an out-of-turn player plays Anytime during gambling and reconnect preserves pot and control', async ({
  browser,
}) => {
  const contexts = [await browser.newContext(), await browser.newContext()];
  const pages = [await contexts[0]!.newPage(), await contexts[1]!.newPage()];
  const [host, guest] = pages;
  try {
    await host!.goto('/');
    await host!.getByLabel('Your name').fill('Host');
    await host!.getByRole('button', { name: 'Create room' }).click();
    await expect(host!.getByRole('status')).toHaveText('Synced');
    const invite = await host!.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host!.request.get(`/api/rooms/${roomId}`)).json(),
      ).view;
    await guest!.goto(invite);
    await guest!.getByLabel('Your name').fill('Guest');
    await guest!.getByRole('button', { name: 'Join room' }).click();
    await expect(host!.locator('.lobby-seats li')).toHaveCount(2);
    await host!.getByRole('button', { name: 'Start match' }).click();
    await host!
      .getByRole('button', { name: 'Discard and draw', exact: true })
      .click();
    await passPhaseEnd(pages, roomId);
    await host!
      .getByRole('button', {
        name: 'Play Sample Raise the Stakes',
        exact: true,
      })
      .click();
    for (let i = 0; i < 12; i++) {
      const current = await view();
      if (!current.responseWindow) break;
      const seat = current.players.find(
        (p) => p.id === current.responseWindow!.priorityPlayerId,
      )!.seat;
      await pages[seat]!.getByRole('button', {
        name: 'Pass response',
        exact: true,
      }).click();
      await expect
        .poll(async () => (await view()).version)
        .toBeGreaterThan(current.version);
    }
    const before = await view();
    expect(before.gambling!.stage).toBe('ROUND');
    const card = guest!.locator('.hand-card').filter({
      has: guest!.getByRole('heading', {
        name: 'Sample Quiet Breather',
        exact: true,
      }),
    });
    await expect(card).toHaveAttribute('data-playable', 'true');
    await card
      .getByRole('button', { name: 'Play Sample Quiet Breather', exact: true })
      .click();
    for (let i = 0; i < 12; i++) {
      const current = await view();
      if (!current.responseWindow) break;
      const seat = current.players.find(
        (p) => p.id === current.responseWindow!.priorityPlayerId,
      )!.seat;
      await pages[seat]!.getByRole('button', {
        name: 'Pass response',
        exact: true,
      }).click();
      await expect
        .poll(async () => (await view()).version)
        .toBeGreaterThan(current.version);
    }
    const after = await view();
    expect(after.gambling).toEqual(before.gambling);
    expect(after.players[1]!.fortitude).toBe(
      Math.min(20, before.players[1]!.fortitude + 1),
    );
    await guest!.reload();
    await expect(guest!.getByRole('status')).toHaveText('Synced');
    expect((await view()).gambling).toEqual(before.gambling);
    await expect(
      guest!.getByRole('heading', {
        name: 'Sample Quiet Breather',
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
