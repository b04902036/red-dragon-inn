import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { passPhaseEnd } from './timing-helpers';
test('owner prompts remain untimed until explicit pass; guest countdowns reset, expire and synchronize', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue();
    const id = new URL(invite).searchParams.get('room')!;
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await host.getByRole('button', { name: 'Start match' }).click();
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host.request.get(`/api/rooms/${id}`)).json(),
      ).view;
    await host
      .getByRole('button', { name: 'Discard and draw', exact: true })
      .click();
    await expect(host.getByRole('note')).toHaveText(/no time limit/);
    await expect(host.getByRole('timer')).toHaveCount(0);
    const grace = (await view()).timedPrompt!;
    expect(grace.deadlineAt).toBeNull();
    await expect(host.locator('[data-playable="true"]')).toHaveCount(1);
    await expect(guest.locator('[data-playable="true"]')).toHaveCount(0);
    await expect
      .poll(() => Date.now() - grace.openedAt, { timeout: 8000 })
      .toBeGreaterThan(6000);
    expect((await view()).timedPrompt).toEqual(grace);
    await host
      .getByRole('button', { name: 'Play Sample Quiet Breather' })
      .click();
    await expect(host.getByRole('note')).toHaveText(/no time limit/);
    const response = (await view()).timedPrompt!;
    expect(response.promptId).not.toBe(grace.promptId);
    expect(response.deadlineAt).toBeNull();
    await expect(guest.getByRole('note')).toHaveAttribute(
      'data-prompt-id',
      response.promptId,
    );
    await expect
      .poll(() => Date.now() - response.openedAt, { timeout: 14000 })
      .toBeGreaterThan(11000);
    expect((await view()).timedPrompt).toEqual(response);
    await host
      .getByRole('button', { name: 'Pass response', exact: true })
      .click();
    await expect(
      guest.getByRole('button', { name: 'Pass response', exact: true }),
    ).toBeEnabled({ timeout: 12000 });
    const next = (await view()).timedPrompt!;
    expect(next.promptId).not.toBe(response.promptId);
    await expect(host.locator('[data-playable="true"]')).toHaveCount(0);
    await expect(guest.locator('[data-playable="true"]').first()).toBeVisible();
    await expect(host.getByRole('timer')).toHaveAttribute(
      'data-prompt-id',
      next.promptId,
    );
    await expect(guest.getByRole('timer')).toHaveText(
      /Response: (9|10)s remaining/,
    );
    await guest
      .getByRole('button', { name: 'Pass response', exact: true })
      .click();
    await expect(guest.getByRole('timer')).toHaveText(
      /Phase-end Anytime: [45]s remaining/,
    );
    await expect(
      host.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible({ timeout: 7000 });
    await expect(
      guest.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible();
    await expect(host.getByRole('timer')).toHaveCount(0);
    await host
      .getByRole('button', { name: 'Play Sample Friendly Shove' })
      .first()
      .click();
    await host
      .getByRole('dialog')
      .getByRole('button', { name: 'Guest', exact: true })
      .click();
    await host
      .getByRole('button', { name: 'Pass response', exact: true })
      .click();
    const parent = (await view()).timedPrompt!;
    const ignore = guest.locator('.hand-card').filter({
      has: guest.getByRole('heading', {
        name: 'Sample Brush It Off',
        exact: true,
      }),
    });
    await expect(ignore).toHaveAttribute('data-playable', 'true');
    await expect(host.locator('[data-playable="true"]')).toHaveCount(0);
    await expect(guest.getByRole('timer')).toHaveText(
      /Response: [0-8]s remaining/,
    );
    await guest
      .getByRole('button', { name: 'Respond with Sample Brush It Off' })
      .click();
    const child = (await view()).timedPrompt!;
    await expect(ignore).toHaveCount(0);
    await expect(
      guest.locator('.hand-card').filter({
        has: guest.getByRole('heading', {
          name: 'Sample Cancel That',
          exact: true,
        }),
      }),
    ).toHaveAttribute('data-playable', 'true');
    expect(child.promptId).not.toBe(parent.promptId);
    expect(parent.deadlineAt).not.toBeNull();
    expect(child.deadlineAt).toBeGreaterThan(parent.deadlineAt!);
    await expect(guest.getByRole('timer')).toHaveText(
      /Response: (9|10)s remaining/,
    );
    await expect(host.getByRole('timer')).toHaveAttribute(
      'data-prompt-id',
      child.promptId,
    );
    for (let limit = 0; limit < 16; limit++) {
      const current = await view();
      if (!current.responseWindow) break;
      const player = current.players.find(
        (p) => p.id === current.responseWindow!.priorityPlayerId,
      )!;
      await (player.seat === 0 ? host : guest)
        .getByRole('button', { name: 'Pass response', exact: true })
        .click();
      await expect
        .poll(async () => (await view()).version)
        .toBeGreaterThan(current.version);
    }
    await passPhaseEnd([host, guest], id);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
