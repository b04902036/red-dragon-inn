import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { privatePlayerViewSchema } from '../../src/protocol/views';
import { passPhaseEnd } from './timing-helpers';

test('local development players choose replacement cards and a Drink, with bilingual controls and reconnect', async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  for (const page of [host, guest])
    await page.addInitScript(
      `window.__messages=[];const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>window.__messages.push(JSON.parse(e.data)));}};`,
    );
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host
      .getByRole('button', { name: 'Create room', exact: true })
      .click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Guest');
    await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await host
      .getByRole('button', { name: 'Start match', exact: true })
      .click();
    await expect(host.locator('.hand-card')).toHaveCount(7);
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host.request.get(`/api/rooms/${roomId}`)).json(),
      ).view;
    const own = async () =>
      privatePlayerViewSchema.parse(
        await host.evaluate(
          `window.__messages.filter(m=>m.type==='PRIVATE_STATE').at(-1).view`,
        ),
      );
    await expect(
      guest.getByRole('region', { name: 'Development: choose cards' }),
    ).toHaveCount(0);
    const first = (await own()).hand[0]!;
    await host.locator(`[data-card-id="${first.id}"] .card-body`).focus();
    await host.keyboard.press('Space');
    const picker = host.getByRole('region', {
      name: 'Development: choose cards',
    });
    const select = picker.getByLabel('Replacement card 1');
    const desired = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(desired!);
    await picker
      .getByRole('button', { name: 'Discard and take chosen cards' })
      .click();
    await expect
      .poll(async () => (await own()).hand.at(-1)?.definitionId)
      .toBe(desired);
    await expect(host.locator('.hand-card')).toHaveCount(7);
    await passPhaseEnd([host, guest], roomId);
    await host
      .getByRole('button', { name: 'Skip action', exact: true })
      .click();
    await passPhaseEnd([host, guest], roomId);
    expect((await view()).phase).toBe('ORDER_DRINK');
    await host.setViewportSize({ width: 390, height: 844 });
    await host.getByLabel('Language').selectOption('zh-TW');
    const chinese = host.getByRole('region', { name: '開發模式：指定牌' });
    const chosenDrink = (await own()).devChoices!.innCards[0]!;
    await chinese
      .getByLabel('指定酒牌或酒事件')
      .selectOption(chosenDrink.definitionId);
    await chinese
      .getByLabel('指定酒的收件玩家')
      .selectOption({ label: 'Guest' });
    await chinese.getByRole('button', { name: '買指定的酒' }).click();
    await expect
      .poll(async () => (await view()).players[1]!.drinkPileCount)
      .toBe(2);
    await expect
      .poll(
        async () =>
          (await own()).devChoices!.innCards.find(
            (choice) => choice.definitionId === chosenDrink.definitionId,
          )?.count ?? 0,
      )
      .toBe(chosenDrink.count - 1);
    await host.reload();
    await expect(host.getByRole('status')).toHaveText('已同步');
    expect((await own()).devChoices).toBeDefined();
    await passPhaseEnd([host, guest], roomId);
    expect((await view()).phase).toBe('DRINK');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
