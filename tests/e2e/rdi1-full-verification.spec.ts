import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { privatePlayerViewSchema } from '../../src/protocol/views';
import { mockPlayback } from './audio-helpers';
test.use({ actionTimeout: 8000 });

test('four production RDI1 browsers verify nested counters, timers, gambling, Drinks, retaliation, reconnect and replay to a winner', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() => browser.newContext()),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const names = [
    'Deirdre verifier',
    'Fiona verifier',
    'Gerki verifier',
    'Zot verifier',
  ];
  const characters = [
    'character_rdi_deirdre_the_priestess',
    'character_rdi_fiona_the_volatile',
    'character_rdi_gerki_the_sneak',
    'character_rdi_zot_the_wizard_and_pooky',
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
            `carddef_rdi1_${['deirdre', 'fiona', 'gerki', 'zot'][seat]}_`,
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

    await stage('nested');
    const voices = await voiceCount(0);
    await play(1, 'damage_two', 0);
    expect((await privateView(0)).responsePrompt?.hasLegalSometimes).toBe(true);
    await expect.poll(() => voiceCount(0)).toBe(voices + 1);
    await expect(pages[0]!.getByRole('timer')).toContainText('30');
    const first = (await privateView(0)).responsePrompt!;
    await pages[0]!.reload();
    await expect(pages[0]!.getByRole('status')).toHaveText('Synced');
    expect((await privateView(0)).responsePrompt).toEqual(first);
    await pages[0]!
      .getByRole('heading', { name: /Deirdre/ })
      .first()
      .click();
    expect(await voiceCount(0)).toBe(0);
    await play(0, 'ignore_action_sometimes_fort_loss');
    await passUntil(
      (v) => v.responseWindow?.priorityPlayerId === v.players[2]!.id,
    );
    await play(2, 'negate_sometimes_counter');
    await play(3, 'negate_sometimes_counter');
    await settled();
    expect((await view()).players[0]!.fortitude).toBe(20);
    await replay();

    await stage('grace');
    await host
      .getByRole('button', { name: 'Skip action', exact: true })
      .click();
    await sync();
    expect((await privateView(0)).responsePrompt).toMatchObject({
      kind: 'PHASE_END_ANYTIME',
      hasLegalSometimes: false,
    });
    await expect(host.getByRole('timer')).toContainText('15');
    const graceVoices = await voiceCount(0);
    await play(0, 'gain_two_fortitude');
    await settled();
    expect(await voiceCount(0)).toBe(graceVoices);
    expect((await view()).players[0]!.fortitude).toBe(22);
    await replay();

    await stage('gambling');
    await play(0, 'gambling_start_or_control');
    await settled();
    expect((await view()).gambling!.pot).toBe(4);
    await passUntil(
      (v) =>
        !v.responseWindow && v.gambling?.priorityPlayerId === v.players[2]!.id,
    );
    await play(2, 'cheat_take_control');
    await settled();
    expect((await view()).gambling!.controlPlayerId).toBe(
      (await view()).players[2]!.id,
    );
    await play(3, 'gambling_winning_hand');
    await settled();
    expect((await view()).gambling!.allowedControlCategories).toEqual([
      'CHEATING',
    ]);
    await passUntil(
      (v) =>
        !v.responseWindow && v.gambling?.priorityPlayerId === v.players[2]!.id,
    );
    await play(2, 'cheat_control_and_eject', 1);
    await settled();
    expect((await view()).gambling!.leftPlayerIds).toContain(
      (await view()).players[1]!.id,
    );
    await passUntil((v) => !v.gambling && !v.responseWindow && !v.phaseEnd);
    await replay();

    await stage('modifier');
    await pages[1]!
      .getByRole('button', { name: 'Take a Drink', exact: true })
      .click();
    await sync();
    await play(0, 'add_two_alcohol_to_drink');
    await play(2, 'negate_drink_change_card');
    await settled();
    expect((await view()).players[1]!.alcoholContent).toBe(2);
    await replay();

    await stage('pass');
    await host
      .getByRole('button', { name: 'Take a Drink', exact: true })
      .click();
    await sync();
    await play(0, 'pass_own_drink', 1);
    await play(1, 'split_own_drink', 2);
    await settled();
    expect((await view()).players.map((p) => p.alcoholContent)).toEqual([
      0, 1, 1, 0,
    ]);
    await replay();

    await stage('extra');
    await host
      .getByRole('button', { name: 'Take a Drink', exact: true })
      .click();
    await sync();
    await play(1, 'force_extra_drink_on_reveal');
    await settled();
    expect((await view()).players[0]!.alcoholContent).toBe(3);
    await replay();

    await stage('retaliate');
    await play(0, 'damage_two', 1);
    expect((await view()).players[1]!.fortitude).toBe(18);
    await play(1, 'hit_back_two_after_loss');
    await settled();
    expect((await view()).players[0]!.fortitude).toBe(18);
    await replay();

    // Shortened alarm + injected clock prove the real server timeout, preserving 30s rule data and replay.
    await stage('nested');
    await play(1, 'damage_two', 0);
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
      'Zot verifier wins!',
    );
    await replay();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
