import { test, expect, type Page, type Locator } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
async function persistedReplay(matchId: string) {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['.tools/replay-inspector/replay-inspector.js', '--match', matchId],
    { timeout: 30000 },
  );
  expect(stdout).toContain('Replay verified.');
  return JSON.parse(
    await readFile(`.tools/replay-inspector/${matchId}.json`, 'utf8'),
  ) as {
    entries: { events: unknown[] }[];
    replay: { state: { version: number; contentVersionId: string } };
    manifest: { setup: { content: { version: { id: string } } } };
  };
}

async function view(page: Page, id: string) {
  return roomMetadataSchema.parse(
    await (await page.request.get(`/api/rooms/${id}`)).json(),
  ).view;
}
async function action(
  page: Page,
  id: string,
  button: Locator,
  locale: 'en-US' | 'zh-TW',
) {
  const before = (await view(page, id)).version;
  await button.click();
  await expect
    .poll(async () => (await view(page, id)).version)
    .toBeGreaterThan(before);
  await expect(page.getByRole('status')).toHaveText(
    locale === 'zh-TW' ? '已同步' : 'Synced',
  );
}
test('a full Traditional Chinese turn shares unchanged protocol with an English player and language switches preserve the socket and hand', async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ locale: 'zh-TW' }),
    guestContext = await browser.newContext({ locale: 'en-US' });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on('pageerror', (error) => errors.push(error.message));
  guest.on('pageerror', (error) => errors.push(error.message));
  let sockets = 0;
  const frames: string[] = [];
  host.on('websocket', (socket) => {
    sockets++;
    socket.on('framesent', (frame) => frames.push(String(frame.payload)));
  });
  try {
    await host.goto('/');
    await expect(host.getByRole('heading', { name: '紅龍酒館' })).toBeVisible();
    await host.getByLabel('你的名字').fill('Host');
    await host.getByRole('button', { name: '建立房間' }).click();
    await expect(host.getByRole('status')).toHaveText('已同步');
    const invite = await host.getByLabel('邀請連結').inputValue(),
      id = new URL(invite).searchParams.get('room')!;
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(guest.getByRole('status')).toHaveText('Synced');
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await action(
      host,
      id,
      host.getByRole('button', { name: '開始遊戲' }),
      'zh-TW',
    );
    await expect(
      host.getByRole('heading', { name: '棄牌抽牌階段' }),
    ).toBeVisible();
    await expect(
      guest.getByRole('heading', { name: 'Discard and draw', exact: true }),
    ).toBeVisible();
    await expect(
      host.locator('.stats dt').getByText('耐力值', { exact: true }),
    ).toHaveCount(2);
    const before = await view(host, id),
      hand = await host
        .locator('[data-card-id]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute('data-card-id')),
        );
    const socketCount = sockets;
    const replayBefore = await persistedReplay(before.matchId!);
    expect(await view(guest, id)).toEqual(before);
    frames.length = 0;
    await host.getByLabel('語言').selectOption('en-US');
    await expect(
      host.getByRole('heading', { name: 'Discard and draw', exact: true }),
    ).toBeVisible();
    await expect(
      host
        .locator('.hand-row')
        .getByRole('heading', { name: 'Sample Friendly Shove' })
        .first(),
    ).toBeVisible();
    await host.getByLabel('Language').selectOption('zh-TW');
    await expect(
      host
        .locator('.hand-row')
        .getByRole('heading', { name: '示範友善推擠' })
        .first(),
    ).toBeVisible();
    expect(await view(host, id)).toEqual(before);
    expect(sockets).toBe(socketCount);
    expect(frames).toEqual([]);
    expect(await persistedReplay(before.matchId!)).toEqual(replayBefore);
    expect(
      await host
        .locator('[data-card-id]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute('data-card-id')),
        ),
    ).toEqual(hand);
    await action(
      host,
      id,
      host.getByRole('button', { name: '棄牌抽牌', exact: true }),
      'zh-TW',
    );
    await expect(
      host.getByRole('heading', { name: '出牌行動階段' }),
    ).toBeVisible();
    await action(
      host,
      id,
      host.getByRole('button', { name: '跳過出牌行動' }),
      'zh-TW',
    );
    await expect(host.getByRole('heading', { name: '請客階段' })).toBeVisible();
    await host.getByRole('button', { name: '請客', exact: true }).click();
    await action(
      host,
      id,
      host
        .getByRole('dialog')
        .getByRole('button', { name: 'Guest', exact: true }),
      'zh-TW',
    );
    await expect(host.getByRole('heading', { name: '喝酒階段' })).toBeVisible();
    await action(
      host,
      id,
      host.getByRole('button', { name: '喝酒', exact: true }),
      'zh-TW',
    );
    for (let limit = 0; limit < 24; limit++) {
      const state = await view(host, id);
      if (!state.responseWindow) break;
      const isHost =
        state.players.find(
          (player) => player.id === state.responseWindow!.priorityPlayerId,
        )!.displayName === 'Host';
      const page = isHost ? host : guest;
      await action(
        page,
        id,
        page.getByRole('button', {
          name: isHost ? '跳過回應' : 'Pass response',
        }),
        isHost ? 'zh-TW' : 'en-US',
      );
    }
    expect((await view(host, id)).responseWindow).toBeNull();
    await action(
      host,
      id,
      host.getByRole('button', { name: '繼續回合' }),
      'zh-TW',
    );
    await action(
      host,
      id,
      host.getByRole('button', { name: '繼續回合' }),
      'zh-TW',
    );
    const result = await view(host, id);
    expect(result.phase).toBe('DISCARD_DRAW');
    expect(
      result.players.find((player) => player.id === result.activePlayerId)!
        .displayName,
    ).toBe('Guest');
    expect(result.innDrinkDiscardCount).toBeGreaterThan(0);
    expect(await view(guest, id)).toEqual(result);
    const replayAfter = await persistedReplay(result.matchId!);
    expect(replayAfter.entries.length).toBeGreaterThan(
      replayBefore.entries.length,
    );
    expect(replayAfter.replay.state.version).toBe(result.version);
    expect(replayAfter.replay.state.contentVersionId).toBe(
      replayAfter.manifest.setup.content.version.id,
    );
    expect(JSON.stringify(replayAfter.entries)).not.toMatch(/zh-TW|en-US/);
    await host.reload();
    await expect(host.getByRole('status')).toHaveText('已同步');
    await expect(host.getByLabel('語言')).toHaveValue('zh-TW');
    expect(errors).toEqual([]);
    await host.screenshot({ path: '.tools/step14-zh-TW.png', fullPage: true });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
