import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { privatePlayerViewSchema } from '../../src/protocol/views';
import { mockPlayback } from './audio-helpers';
test.use({ actionTimeout: 8000 });

test('mixed RDI1/RDI2 browsers verify every required cross-set journey and replay to a persisted winner', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() => browser.newContext()),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const names = [
    'Deirdre verifier',
    'Dimli verifier',
    'Eve verifier',
    'Gog verifier',
  ];
  const characters = [
    'character_rdi_deirdre_the_priestess',
    'character_rdi_dimli_the_dwarf',
    'character_rdi_eve_the_illusionist',
    'character_rdi_gog_the_half_ogre',
  ];
  const errors: string[] = [];
  for (const page of pages) {
    await mockPlayback(page);
    await page.addInitScript(
      `window.__rdiMessages=[];const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',e=>{window.__rdiMessages.push(JSON.parse(e.data));});}};`,
    );
    page.on('pageerror', (e) => errors.push(e.message));
  }
  const host = pages[0]!;
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill(names[0]!);
    await host
      .getByRole('button', { name: 'Create room', exact: true })
      .click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    await host.getByLabel('Your character').selectOption(characters[0]!);
    for (let seat = 1; seat < 4; seat++) {
      const page = pages[seat]!;
      await page.goto(invite);
      await page.getByLabel('Your name').fill(names[seat]!);
      await page
        .getByRole('button', { name: 'Join room', exact: true })
        .click();
      await expect(page.getByRole('status')).toHaveText('Synced');
      await page.getByLabel('Your character').selectOption(characters[seat]!);
    }
    await pages[3]!.getByLabel('Language').selectOption('zh-TW');
    await expect(pages[3]!.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(
      host.getByLabel('Your character').locator('option'),
    ).toHaveCount(8);
    await host.getByLabel('Drink setup').selectOption('BAR');
    await expect
      .poll(async () =>
        host.evaluate(
          'window.__rdiMessages.filter(m=>m.type==="PUBLIC_STATE").at(-1).view.players.map(p=>p.characterId)',
        ),
      )
      .toEqual(characters);
    await host
      .getByRole('button', { name: 'Start match', exact: true })
      .click();
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host.request.get(`/api/rooms/${roomId}`)).json(),
      ).view;
    const privateView = async (seat: number) =>
      privatePlayerViewSchema.parse(
        await pages[seat]!.evaluate(
          `window.__rdiMessages.filter(m=>m.type==='PRIVATE_STATE').at(-1).view`,
        ),
      );
    const voiceCount = async (seat: number) =>
      (await pages[seat]!.evaluate(
        `window.__audioCalls.filter(p=>p.endsWith('sometimes-response.mp3')).length`,
      )) as number;
    for (let seat = 0; seat < 4; seat++) {
      await expect(pages[seat]!.locator('.hand-card')).toHaveCount(7);
      const privateState = await privateView(seat);
      expect(
        privateState.hand.every((c) =>
          c.definitionId.startsWith(
            [
              'carddef_rdi1_deirdre_',
              'carddef_rdi2_dimli_',
              'carddef_rdi2_eve_',
              'carddef_rdi2_gog_',
            ][seat]!,
          ),
        ),
      ).toBe(true);
      expect(
        (await view()).players[seat]!.characterDeckCount +
          privateState.hand.length,
      ).toBe(40);
      for (const other of pages.filter((p) => p !== pages[seat])) {
        const messages = (await other.evaluate(
          'JSON.stringify(window.__rdiMessages)',
        )) as string;
        for (const card of privateState.hand)
          expect(messages).not.toContain(JSON.stringify(card.id));
      }
    }
    const sync = async () => {
      for (const page of pages)
        await page.evaluate(
          `window.__roomSocket.send(JSON.stringify({type:'PING',nonce:'verification-sync'}))`,
        );
      const version = (await view()).version;
      for (let seat = 0; seat < 4; seat++)
        await expect
          .poll(async () => (await privateView(seat)).legalPlayVersion)
          .toBe(version);
    };
    const stage = async (scenario: string) => {
      const response = await host.request.post(
        `/__test/rooms/${roomId}/stage`,
        { data: { scenario } },
      );
      expect(response.status(), await response.text()).toBe(200);
      await sync();
    };
    const play = async (
      seat: number,
      mechanic: string,
      targetSeat?: number,
    ) => {
      const page = pages[seat]!;
      const own = await privateView(seat);
      const card = own.hand.find((c) =>
        c.definitionId.endsWith(`_${mechanic}`),
      )!;
      expect(card).toBeDefined();
      expect(own.legalPlays.some((p) => p.cardId === card.id)).toBe(true);
      const article = page.locator(`[data-card-id="${card.id}"]`);
      await expect(article).toHaveAttribute('data-playable', 'true');
      const before = (await view()).version;
      await article
        .locator('.card-controls button:not(.touch-details)')
        .click();
      if (own.legalPlays.find((p) => p.cardId === card.id)!.requiresTarget) {
        await page
          .getByRole('dialog')
          .getByRole('button', { name: names[targetSeat ?? 0]!, exact: true })
          .click();
      }
      await expect
        .poll(async () => (await view()).version)
        .toBeGreaterThan(before);
      await sync();
    };
    const passUntil = async (
      stop: (v: Awaited<ReturnType<typeof view>>) => boolean,
    ) => {
      for (let i = 0; i < 40; i++) {
        const current = await view();
        if (stop(current)) return;
        const owner =
          current.responseWindow?.priorityPlayerId ??
          current.phaseEnd?.priorityPlayerId ??
          current.gambling?.priorityPlayerId;
        const seat = current.players.find((p) => p.id === owner)!.seat;
        const page = pages[seat]!;
        const label = current.responseWindow
          ? /^(Pass response|跳過回應)$/
          : current.phaseEnd
            ? /^(Pass Anytime|跳過隨時牌)$/
            : /^(Pass gambling|跳過賭博行動)$/;
        await page.getByRole('button', { name: label }).click();
        await expect
          .poll(async () => (await view()).version)
          .toBeGreaterThan(current.version);
        await sync();
      }
      throw new Error('Browser scenario exceeded pass limit');
    };
    const settled = () => passUntil((v) => !v.responseWindow && !v.phaseEnd);
    const replay = async () => {
      const response = await host.request.get(`/__test/rooms/${roomId}/replay`);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        identical: true,
        commands: expect.any(Number),
      });
    };

    const choose = async (seat: number, label: RegExp) => {
      const dialog = pages[seat]!.getByRole('dialog');
      await dialog.getByRole('checkbox', { name: label }).check();
      const before = (await view()).version;
      await dialog
        .getByRole('button', { name: /^(Confirm choice|確認選擇)$/ })
        .click();
      await expect
        .poll(async () => (await view()).version)
        .toBeGreaterThan(before);
      await sync();
    };
    const take = async (seat = 0) => {
      await pages[seat]!.getByRole('button', {
        name: /^(Take a Drink|喝飲料)$/,
      }).click();
      await sync();
    };

    await stage('nested');
    const voices = await voiceCount(2);
    await play(0, 'damage_two', 2);
    const first = (await privateView(2)).responsePrompt!;
    expect(first.hasLegalSometimes).toBe(true);
    expect(first.deadlineAt).toBe(first.openedAt + 30000);
    await expect.poll(() => voiceCount(2)).toBe(voices + 1);
    await expect(pages[2]!.getByRole('timer')).toContainText('30');
    await pages[2]!.reload();
    await expect(pages[2]!.getByRole('status')).toHaveText('Synced');
    await sync();
    expect((await privateView(2)).responsePrompt).toEqual(first);
    await pages[2]!
      .getByRole('heading', { name: /Eve verifier/ })
      .first()
      .click();
    expect(await voiceCount(2)).toBe(0);
    await play(2, 'ignore_card_all_stats');
    const fresh = (await view()).timedPrompt!;
    expect(fresh.promptId).not.toBe(first.promptId);
    expect(fresh.deadlineAt).toBe(fresh.openedAt + 30000);
    await play(3, 'negate_sometimes_counter');
    await play(1, 'negate_sometimes_counter');
    await settled();
    expect((await view()).players[2]!.fortitude).toBe(20);
    await replay();

    await stage('anytime');
    const silentVoices = await voiceCount(3);
    await play(0, 'damage_two', 3);
    const silent = (await privateView(3)).responsePrompt!;
    expect(silent.hasLegalSometimes).toBe(false);
    expect(silent.deadlineAt).toBe(silent.openedAt + 30000);
    await expect(pages[3]!.getByRole('timer')).toContainText('30');
    expect(await voiceCount(3)).toBe(silentVoices);
    await play(3, 'tip_wench', 0);
    await settled();
    expect(await voiceCount(3)).toBe(silentVoices);
    expect((await view()).players[3]!.fortitude).toBe(18);
    await replay();

    await stage('grace');
    await host
      .getByRole('button', { name: 'Skip action', exact: true })
      .click();
    await sync();
    const grace = (await privateView(3)).responsePrompt!;
    expect(grace.kind).toBe('PHASE_END_ANYTIME');
    expect(grace.hasLegalSometimes).toBe(false);
    expect(grace.deadlineAt).toBe(grace.openedAt + 15000);
    await expect(pages[3]!.getByRole('timer')).toContainText('15');
    await play(3, 'gain_two_fortitude');
    await settled();
    expect((await view()).players[3]!.fortitude).toBe(20);
    await replay();

    await stage('gambling');
    await play(0, 'gambling_start_or_control');
    await settled();
    expect((await view()).gambling!.pot).toBe(4);
    await play(1, 'gambling_winning_hand');
    await settled();
    expect((await view()).gambling!.allowedControlCategories).toEqual([
      'CHEATING',
    ]);
    await play(2, 'cheat_take_control');
    await settled();
    expect((await view()).gambling!.allowedControlCategories).toEqual([
      'GAMBLING',
      'CHEATING',
    ]);
    await passUntil(
      (asyncView) =>
        asyncView.responseWindow?.priorityPlayerId ===
          asyncView.players[1]!.id && !!asyncView.timedPrompt,
    );
    await play(1, 'restart_gambling_round');
    await settled();
    expect((await view()).gambling).toMatchObject({
      pot: 8,
      controlPlayerId: (await view()).players[1]!.id,
      priorityPlayerId: (await view()).players[2]!.id,
    });
    await replay();

    await stage('redirect');
    await play(0, 'damage_two', 2);
    await play(2, 'redirect_fortitude_loss', 3);
    await passUntil(
      (v) =>
        v.responseWindow?.priorityPlayerId === v.players[3]!.id &&
        v.players[3]!.fortitude === 18,
    );
    await play(3, 'hit_back_two_after_loss');
    await settled();
    expect((await view()).players.map((p) => p.fortitude)).toEqual([
      18, 20, 20, 18,
    ]);
    await replay();

    await stage('modifier');
    await take();
    await play(1, 'add_two_alcohol_to_drink');
    await settled();
    expect((await view()).players[0]!.alcoholContent).toBe(4);
    await replay();
    await stage('mead');
    await take();
    await choose(0, /^Drink it all$/);
    await settled();
    expect((await view()).players[0]!.alcoholContent).toBe(3);
    await replay();
    await stage('contest');
    await take();
    await settled();
    expect((await view()).players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
    await replay();
    await stage('challenge');
    await take();
    await choose(0, /^Accept the challenge$/);
    await settled();
    expect((await view()).players.map((p) => p.gold)).toEqual([13, 9, 9, 9]);
    expect((await view()).players[0]!.alcoholContent).toBe(2);
    await replay();

    await stage('nested');
    await play(0, 'damage_two', 2);
    const timed = (await view()).timedPrompt!;
    expect(
      (await host.request.post(`/__test/rooms/${roomId}/shorten`)).status(),
    ).toBe(200);
    await expect
      .poll(async () => (await view()).timedPrompt?.promptId, { timeout: 5000 })
      .not.toBe(timed.promptId);
    await sync();
    await settled();
    await replay();

    await stage('winner');
    await play(3, 'damage_all_others_one');
    await settled();
    const final = await view();
    expect(final.lifecycle).toBe('FINISHED');
    expect(final.winners).toEqual([final.players[3]!.id]);
    await expect(host.locator('.winner-banner')).toContainText(
      'Gog verifier wins!',
    );
    await replay();
    const persisted = await host.request.get(`/__test/rooms/${roomId}/result`);
    expect(persisted.status()).toBe(200);
    expect(await persisted.json()).toMatchObject({
      winners: final.winners,
      stateVersion: final.version,
    });
    await pages[3]!.reload();
    await expect(pages[3]!.getByRole('status')).toHaveText('已同步');
    await expect(pages[3]!.locator('.winner-banner')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
