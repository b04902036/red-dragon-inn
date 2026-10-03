import { test, expect, type Page } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { mockPlayback, playbackCount } from './audio-helpers';
import { passPhaseEnd } from './timing-helpers';
test('gesture unlocks one music loop; remote response priority chimes once; resync/locale/refresh deduplicate and audio-disabled gameplay works', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [host, guest] = pages as [Page, Page];
  try {
    for (const page of pages) {
      await mockPlayback(page);
      await page.goto('/');
      expect(await playbackCount(page, 'music')).toBe(0);
      await page.getByLabel('Your name').click();
      expect(await playbackCount(page, 'music')).toBe(1);
    }
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
    await expect.poll(() => playbackCount(host, 'chime')).toBe(1);
    expect(await playbackCount(guest, 'chime')).toBe(0);
    expect(await playbackCount(host, 'music')).toBe(1);
    await host
      .getByRole('button', { name: 'Discard and draw', exact: true })
      .click();
    await passPhaseEnd(pages, id);
    await expect(
      host.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible();
    await host
      .getByRole('button', { name: 'Play Sample Friendly Shove' })
      .first()
      .click();
    await host
      .getByRole('dialog')
      .getByRole('button', { name: 'Guest', exact: true })
      .click();
    await expect(
      host.getByRole('button', { name: 'Pass response' }),
    ).toBeEnabled();
    const hostBeforePass = await playbackCount(host, 'chime');
    const guestBeforePass = await playbackCount(guest, 'chime');
    await host.getByRole('button', { name: 'Pass response' }).click();
    await expect(
      guest.getByRole('button', { name: 'Pass response' }),
    ).toBeEnabled();
    await expect
      .poll(() => playbackCount(guest, 'chime'))
      .toBe(guestBeforePass + 1);
    const before = await playbackCount(host, 'chime');
    await guest
      .getByRole('button', { name: 'Respond with Sample Brush It Off' })
      .click();
    await guest.getByRole('button', { name: 'Pass response' }).click();
    await expect(
      host.getByRole('button', { name: 'Pass response' }),
    ).toBeEnabled();
    await expect.poll(() => playbackCount(host, 'chime')).toBe(before + 1);
    expect(before).toBe(hostBeforePass);
    const stable = await playbackCount(host, 'chime');
    await host.getByLabel('Language').selectOption('zh-TW');
    await expect(host.getByRole('heading', { name: '回應時機' })).toBeVisible();
    expect(await playbackCount(host, 'chime')).toBe(stable);
    await host.getByLabel('語言').selectOption('en-US');
    await host.evaluate('window.__roomSocket.close(1000,"Reconnect check")');
    await expect(host.getByRole('status')).toHaveText('Synced');
    expect(await playbackCount(host, 'chime')).toBe(stable);
    await host.reload();
    await expect(host.getByRole('status')).toHaveText('Synced');
    await host.getByText('Sound', { exact: true }).click();
    await expect(
      host.getByRole('button', { name: 'Sound enabled' }),
    ).toBeVisible();
    expect(await playbackCount(host, 'chime')).toBe(0);
    expect(await playbackCount(host, 'music')).toBe(1);
    await host.getByLabel('Enable audio', { exact: true }).uncheck();
    await host.getByText('Sound', { exact: true }).click();
    const roomId = new URL(invite).searchParams.get('room')!;
    for (let index = 0; index < 16; index++) {
      const view = roomMetadataSchema.parse(
        await (await host.request.get('/api/rooms/' + roomId)).json(),
      ).view;
      if (!view.responseWindow) break;
      const local =
        view.players.find(
          (player) => player.id === view.responseWindow!.priorityPlayerId,
        )!.displayName === 'Host'
          ? host
          : guest;
      await local.getByRole('button', { name: 'Pass response' }).click();
      await expect(local.getByRole('status')).toHaveText('Synced');
    }
    await passPhaseEnd(pages, roomId);
    await expect(
      host.getByRole('heading', { name: 'Order a Drink', exact: true }),
    ).toBeVisible();
    expect(await playbackCount(host, 'chime')).toBe(0);
  } finally {
    for (const context of contexts) await context.close();
  }
});

test('saved disabled audio stays silent through reload and keyboard interaction until enabled', async ({
  page,
}) => {
  await mockPlayback(page);
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('rdi:audio', JSON.stringify({ enabled: false })),
  );
  await page.reload();
  await page.getByLabel('Your name').focus();
  await page.getByLabel('Your name').press('A');
  await page.getByText('Sound', { exact: true }).click();
  expect(await playbackCount(page, 'music')).toBe(0);
  await page.getByLabel('Enable audio', { exact: true }).check();
  await expect.poll(() => playbackCount(page, 'music')).toBe(1);
  await page.getByLabel('Enable audio', { exact: true }).uncheck();
  await page.reload();
  await page.getByLabel('Your name').click();
  await page.getByLabel('Your name').press('B');
  expect(await playbackCount(page, 'music')).toBe(0);
});

test('ordinary touch interaction unlocks default audio once', async ({
  browser,
}) => {
  const context = await browser.newContext({ hasTouch: true });
  try {
    const page = await context.newPage();
    await mockPlayback(page);
    await page.goto('/');
    expect(await playbackCount(page, 'music')).toBe(0);
    await page.getByLabel('Your name').tap();
    await expect.poll(() => playbackCount(page, 'music')).toBe(1);
    await page.getByText('Sound', { exact: true }).tap();
    expect(await playbackCount(page, 'music')).toBe(1);
  } finally {
    await context.close();
  }
});
