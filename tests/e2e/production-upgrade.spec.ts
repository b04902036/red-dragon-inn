import { test, expect, type Page, type Locator } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { presentationSchema } from '../../src/protocol/presentation';
import { mockPlayback, playbackCount } from './audio-helpers';
async function view(page: Page, id: string) {
  return roomMetadataSchema.parse(
    await (await page.request.get(`/api/rooms/${id}`)).json(),
  ).view;
}
async function command(page: Page, id: string, button: Locator) {
  const version = (await view(page, id)).version;
  await button.click();
  await expect
    .poll(async () => (await view(page, id)).version)
    .toBeGreaterThan(version);
}
async function resolveResponses(host: Page, guest: Page, id: string) {
  for (let limit = 0; limit < 16; limit++) {
    const before = await view(host, id);
    if (!before.responseWindow) return;
    const hostPriority =
      before.players.find(
        (player) => player.id === before.responseWindow!.priorityPlayerId,
      )!.displayName === 'Host';
    const counts = await Promise.all([
      playbackCount(host, 'chime'),
      playbackCount(guest, 'chime'),
    ]);
    const page = hostPriority ? host : guest;
    await command(
      page,
      id,
      page.getByRole('button', {
        name:
          hostPriority || (await guest.getByLabel('語言').count())
            ? '跳過回應'
            : 'Pass response',
      }),
    );
    const after = await view(host, id);
    for (const [index, client] of [host, guest].entries()) {
      const localPrompt =
        after.attention &&
        after.attention.key !== before.attention?.key &&
        after.players.find((player) => player.id === after.attention!.playerId)!
          .displayName === (index === 0 ? 'Host' : 'Guest');
      await expect
        .poll(() => playbackCount(client, 'chime'))
        .toBe(counts[index]! + (localPrompt ? 1 : 0));
    }
  }
  throw new Error('Response audit did not finish');
}
test('mixed-locale gambling priorities chime once; Chinese card details scroll, support touch and preserve shared state', async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({ locale: 'zh-TW' }),
    browser.newContext({ locale: 'en-US' }),
  ]);
  const [host, guest] = (await Promise.all(
    contexts.map((context) => context.newPage()),
  )) as [Page, Page];
  const errors: string[] = [];
  try {
    for (const page of [host, guest]) {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await mockPlayback(page);
    }
    // Original fixture presentation only: exercise overflow without importing proprietary rules.
    await host.route('**/presentation?locale=zh-TW', async (route) => {
      const response = await route.fetch();
      const presentation = presentationSchema.parse(await response.json());
      const card = presentation.cards.find(
        (card) => card.id === 'carddef_sample_shove',
      )!;
      card.rulesText +=
        '\n' + '測試用長篇規則文字，檢查完整預覽與捲動。'.repeat(200);
      await route.fulfill({ response, json: presentation });
    });
    await host.goto('/');
    expect(await playbackCount(host, 'music')).toBe(0);
    await host.getByText('聲音', { exact: true }).click();
    await host.getByRole('button', { name: '啟用聲音' }).click();
    await host.getByText('聲音', { exact: true }).click();
    await host.getByLabel('你的名字').fill('Host');
    await host.getByRole('button', { name: '建立房間' }).click();
    await expect(host.getByRole('status')).toHaveText('已同步');
    const invite = await host.getByLabel('邀請連結').inputValue(),
      id = new URL(invite).searchParams.get('room')!;
    await guest.goto(invite);
    expect(await playbackCount(guest, 'music')).toBe(0);
    await guest.getByText('Sound', { exact: true }).click();
    await guest.getByRole('button', { name: 'Enable sound' }).click();
    await guest.getByText('Sound', { exact: true }).click();
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await command(host, id, host.getByRole('button', { name: '開始遊戲' }));
    await expect.poll(() => playbackCount(host, 'chime')).toBe(1);
    expect(await playbackCount(guest, 'chime')).toBe(0);
    for (const term of ['耐力值', '酒精值', '金幣', '賭博', '作弊'])
      await expect(host.getByText(term, { exact: true }).first()).toBeVisible();
    await expect(host.getByText(/^暢飲區：/).first()).toBeVisible();
    const shove = host
      .locator('.hand-card')
      .filter({
        has: host.getByRole('heading', { name: '示範友善推擠', exact: true }),
      })
      .first();
    await shove.locator('.card-body').click();
    await expect(shove.getByRole('checkbox')).toBeChecked();
    await shove.locator('.card-body').click();
    await expect(shove.getByRole('checkbox')).not.toBeChecked();
    await shove.hover();
    const preview = host.getByRole('region', { name: '卡牌詳情' });
    await expect(preview).toContainText('耐力值 -2');
    await preview.hover();
    await host.waitForTimeout(150);
    await expect(preview).toBeVisible();
    await host.mouse.wheel(0, 10000);
    await expect
      .poll(() => preview.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await preview.focus();
    await host.keyboard.press('Home');
    await expect
      .poll(() => preview.evaluate((element) => element.scrollTop))
      .toBe(0);
    await host.keyboard.press('End');
    await expect
      .poll(() => preview.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await host.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);
    await host.setViewportSize({ width: 390, height: 844 });
    await shove.getByRole('button', { name: '詳情：示範友善推擠' }).click();
    await expect(preview).toContainText('測試用長篇規則文字');
    await expect(shove.getByRole('checkbox')).not.toBeChecked();
    await host.getByRole('button', { name: '關閉卡牌詳情' }).click();
    await host.setViewportSize({ width: 1440, height: 1000 });
    await command(
      host,
      id,
      host.getByRole('button', { name: '棄牌抽牌', exact: true }),
    );
    await command(
      host,
      id,
      host.getByRole('button', { name: '打出示範提高賭注' }),
    );
    await resolveResponses(host, guest, id);
    const gambling = await view(host, id);
    expect(gambling.attention!.kind).toBe('GAMBLING');
    expect(
      gambling.players.find(
        (player) => player.id === gambling.attention!.playerId,
      )!.displayName,
    ).toBe('Guest');
    await expect(
      guest.getByRole('button', { name: 'Pass gambling' }),
    ).toBeEnabled();
    await expect(host.getByRole('heading', { name: '賭博回合' })).toBeVisible();
    const stable = await playbackCount(guest, 'chime'),
      remote = await playbackCount(host, 'chime');
    const frames: string[] = [];
    let reconnects = 0;
    guest.on('websocket', (socket) => {
      reconnects++;
      socket.on('framesent', (frame) => frames.push(String(frame.payload)));
    });
    await guest.evaluate(
      'window.__roomSocket.close(1000,"Gambling reconnect audit")',
    );
    await expect.poll(() => reconnects).toBe(1);
    await expect(guest.getByRole('status')).toHaveText('Synced');
    expect(await playbackCount(guest, 'chime')).toBe(stable);
    const frameCount = frames.length;
    await guest.getByLabel('Language').selectOption('zh-TW');
    await expect(
      guest.getByRole('heading', { name: '賭博回合' }),
    ).toBeVisible();
    expect(await playbackCount(guest, 'chime')).toBe(stable);
    expect(await view(guest, id)).toEqual(gambling);
    expect(frames).toHaveLength(frameCount);
    expect(await view(host, id)).toEqual(gambling);
    await command(
      guest,
      id,
      guest.getByRole('button', { name: '以示範作弊奪權取得主導權' }),
    );
    await expect.poll(() => playbackCount(host, 'chime')).toBe(remote + 1);
    expect(await playbackCount(guest, 'chime')).toBe(stable);
    await resolveResponses(host, guest, id);
    expect((await view(host, id)).attention!.kind).toBe('GAMBLING');
    expect(await playbackCount(host, 'music')).toBe(1);
    expect(await playbackCount(guest, 'music')).toBe(1);
    await command(host, id, host.getByRole('button', { name: '跳過賭博行動' }));
    await expect(host.getByRole('heading', { name: '賭博回合' })).toHaveCount(
      0,
    );
    expect(errors).toEqual([]);
    await host.screenshot({ path: '.tools/step17-zh-TW.png', fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
  }
});
