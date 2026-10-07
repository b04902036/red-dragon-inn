import { expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../../src/engine/reaction-legality';
import { rdi2Pack, combinedPack } from '../fixtures/rdi2-content';
import {
  match,
  selectedMatch,
  definitionCard,
  keep,
  activate,
  play,
  until,
  settle,
  send,
} from '../fixtures/rdi2-match';
import { intent, mutable } from '../fixtures/core-match';
const owns = (
  s: ReturnType<typeof match>,
  character: string,
  mechanic: string,
) => definitionCard(s, `carddef_rdi2_${character}_${mechanic}`);
const legal = (s: ReturnType<typeof settle>, seat: number, id: string) =>
  projectPrivatePlayer(s, s.players[seat]!.id).legalPlays.some(
    (p) => p.cardId === id,
  );
it('an actual RDI1 winner-replacement card blocks the compiled Dimli restart, and an actual departure removes his opportunity', () => {
  const base = selectedMatch(combinedPack, [
    'rdi1-gerki',
    'rdi2-dimli',
    'rdi2-eve',
    'rdi2-gog',
  ]);
  const replacement = definitionCard(
      base,
      'carddef_rdi1_gerki_steal_winners_pot',
    ),
    restart = owns(base, 'dimli', 'restart_gambling_round'),
    start = owns(base, 'eve', 'gambling_start_or_control'),
    tip = owns(base, 'gog', 'tip_wench');
  keep(base, [replacement, restart, start, tip]);
  activate(base, start);
  const round = settle(play(base, start).state);
  const pending = until(round, (s) => legal(s, 0, replacement));
  const replaced = until(
    play(pending, replacement).state,
    (s) =>
      s.gambling?.restartBlocked === true &&
      s.resolutionStack.at(-1)?.task?.kind === 'SETTLEMENT',
  );
  expect(
    legalResponsesForPlayer(
      replaced,
      replaced.players[1]!.id,
      reactionContext(replaced, replaced.resolutionStack.at(-1)!),
    ).some((p) => p.cardId === restart),
  ).toBe(false);
  const leaving = until(
    round,
    (s) =>
      !s.responseWindow && s.gambling?.priorityPlayerId === s.players[1]!.id,
  );
  const left = send(leaving, 1, 'GAMBLING_LEAVE').state;
  expect(left.gambling!.leftPlayerIds).toContain(left.players[1]!.id);
  expect(legal(left, 1, restart)).toBe(false);
  expect(
    applyCommand(left, intent(left, 'PLAY_CARD', { cardId: restart }), {
      actorId: left.players[1]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', events: [] });
});
it.each(['INN', 'THEFT', 'ANTE'] as const)(
  'Eve’s compiled Illusionary Coin prevents %s loss, preserving the recipient and participation semantics',
  (kind) => {
    const state = match(rdi2Pack),
      coin = owns(state, 'eve', 'illusionary_payment');
    const source =
      kind === 'INN'
        ? owns(state, 'dimli', 'tip_wench')
        : kind === 'THEFT'
          ? owns(state, 'fleck', 'take_two_gold')
          : owns(state, 'dimli', 'gambling_start_or_control');
    keep(state, [coin, source]);
    activate(state, source);
    const pending = until(
      play(state, source, state.players[1]!.id).state,
      (s) => legal(s, 1, coin),
    );
    const final = settle(play(pending, coin).state);
    expect(final.players[1]!.gold).toBe(10);
    if (kind === 'ANTE') {
      expect(final.gambling).toMatchObject({
        pot: 3,
        participants: state.players.map((p) => p.id),
      });
      expect(
        final.gambling!.contributions.find(
          (p) => p.playerId === state.players[1]!.id,
        )!.amount,
      ).toBe(0);
    } else
      expect(
        final.players
          .filter((p) => p.id !== state.players[1]!.id)
          .map((p) => p.gold),
      ).toEqual([10, 10, 10]);
  },
);
it.each([3, 4])(
  'compiled Eve Share Pain routes %i loss to both players, preserves origin and locks Eve’s mitigation',
  (amount) => {
    const state = match(rdi2Pack),
      share = owns(state, 'eve', 'share_pain'),
      ignore = owns(state, 'eve', 'ignore_card_all_stats'),
      hit = owns(
        state,
        'gog',
        amount === 3 ? 'damage_three_pay_inn_one' : 'damage_four',
      ),
      attackerIgnore = owns(state, 'gog', 'ignore_card_all_stats');
    keep(state, [share, ignore, hit, attackerIgnore]);
    activate(state, hit);
    const pending = until(play(state, hit, state.players[1]!.id).state, (s) =>
      legal(s, 1, share),
    );
    expect(pending.resolutionStack[0]!.origin).toEqual({
      playerId: state.players[3]!.id,
      cardId: hit,
    });
    const played = play(pending, share).state;
    const routed =
      amount === 4
        ? until(played, (s) => s.resolutionStack.length === 1)
        : played;
    if (amount === 4) {
      const parent = routed.resolutionStack[0]!;
      expect(parent.origin).toEqual({
        playerId: state.players[3]!.id,
        cardId: hit,
      });
      expect(
        legalResponsesForPlayer(
          routed,
          state.players[1]!.id,
          reactionContext(routed, parent),
        ).some((p) => p.cardId === ignore),
      ).toBe(false);
    }
    const final = settle(routed);
    expect(final.players[1]!.fortitude).toBe(20 - Math.ceil(amount / 2));
    expect(final.players[3]!.fortitude).toBe(20 - Math.ceil(amount / 2));
    if (amount === 3) expect(final.players[3]!.gold).toBe(9);
  },
);
it('compiled redirect from an RDI1 attack preserves the original player for Gog’s post-loss retaliation', () => {
  const state = selectedMatch(combinedPack, [
    'rdi1-deirdre',
    'rdi2-dimli',
    'rdi2-eve',
    'rdi2-gog',
  ]);
  const hit = definitionCard(state, 'carddef_rdi1_deirdre_damage_two'),
    redirect = owns(state, 'eve', 'redirect_fortitude_loss'),
    retaliate = owns(state, 'gog', 'hit_back_two_after_loss');
  keep(state, [hit, redirect, retaliate]);
  const pending = until(play(state, hit, state.players[2]!.id).state, (s) =>
    legal(s, 2, redirect),
  );
  const moved = until(
    play(pending, redirect, state.players[3]!.id).state,
    (s) => legal(s, 3, retaliate),
  );
  expect(moved.players[2]!.fortitude).toBe(20);
  expect(moved.players[3]!.fortitude).toBe(18);
  expect(moved.resolutionStack.at(-1)!.task).toMatchObject({
    kind: 'POST_LOSS',
    originalPlayer: state.players[0]!.id,
    originalCard: hit,
  });
  const final = settle(play(moved, retaliate).state);
  expect(final.players[0]!.fortitude).toBe(18);
  expect(final.players[2]!.fortitude).toBe(20);
});
it('compiled Eve redirect uses the two-player Ignore fallback without requiring an impossible target', () => {
  const state = selectedMatch(combinedPack, ['rdi1-deirdre', 'rdi2-eve']);
  const hit = definitionCard(state, 'carddef_rdi1_deirdre_damage_two'),
    redirect = owns(state, 'eve', 'redirect_fortitude_loss');
  keep(state, [hit, redirect]);
  const pending = until(play(state, hit, state.players[1]!.id).state, (s) =>
    legal(s, 1, redirect),
  );
  expect(
    projectPrivatePlayer(pending, state.players[1]!.id).legalPlays.find(
      (p) => p.cardId === redirect,
    )!.requiresTarget,
  ).toBe(false);
  expect(
    settle(play(pending, redirect).state).players.map((p) => p.fortitude),
  ).toEqual([20, 20]);
});
it('Dimli’s restart retains the pot, departures, new ante and controller order; leaving or a blocking winner replacement prohibits it', () => {
  const base = match(rdi2Pack),
    restart = owns(base, 'dimli', 'restart_gambling_round'),
    start = owns(base, 'eve', 'gambling_start_or_control');
  keep(base, [start, restart]);
  activate(base, start);
  let round = settle(play(base, start).state);
  round = until(
    round,
    (s) =>
      !s.responseWindow && s.gambling?.priorityPlayerId === s.players[2]!.id,
  );
  round = send(round, 2, 'GAMBLING_LEAVE').state;
  const pending = until(round, (s) => legal(s, 0, restart));
  const blocked = mutable(pending);
  blocked.gambling!.restartBlocked = true;
  expect(legal(blocked, 0, restart)).toBe(false);
  expect(
    applyCommand(
      blocked,
      intent(blocked, 'PLAY_RESPONSE', {
        cardId: restart,
        responseWindowId: blocked.responseWindow!.id,
      }),
      { actorId: blocked.players[0]!.id },
    ),
  ).toMatchObject({ status: 'REJECTED', events: [] });
  const gone = mutable(pending);
  gone.gambling!.participants = gone.gambling!.participants.filter(
    (id) => id !== gone.players[0]!.id,
  );
  gone.gambling!.leftPlayerIds.push(gone.players[0]!.id);
  gone.gambling!.excludedPlayerIds.push(gone.players[0]!.id);
  expect(legal(gone, 0, restart)).toBe(false);
  const final = settle(play(pending, restart).state);
  expect(final.gambling).toMatchObject({
    pot: 7,
    controlPlayerId: base.players[0]!.id,
    priorityPlayerId: base.players[1]!.id,
    participants: base.players.map((p) => p.id),
    leftPlayerIds: [base.players[2]!.id],
  });
  expect(final.players.map((p) => p.gold)).toEqual([8, 8, 9, 8]);
});
it('Fleck’s actual refill waiver prevents only his normal fee, while the remaining players pay', () => {
  const state = match(rdi2Pack),
    waiver = owns(
      state,
      'fleck',
      'order_two_extra_drinks_free_or_waive_refill',
    );
  keep(state, [waiver]);
  state.phase = 'ORDER_DRINK';
  const discard = state.innDrinkDeck.cardIds.splice(1);
  state.innDrinkDiscard = discard;
  for (const id of discard)
    state.cards[id]!.location = {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    };
  const ordered = send(state, 0, 'ORDER_DRINK', {
    targetPlayerId: state.players[1]!.id,
  }).state;
  // Single-Inn refill occurs on the next draw; both draws use the real order command.
  const next = mutable(settle(ordered));
  next.phase = 'ORDER_DRINK';
  const pending = until(
    send(next, 0, 'ORDER_DRINK', { targetPlayerId: next.players[1]!.id }).state,
    (s) => legal(s, 2, waiver),
  );
  const final = settle(play(pending, waiver).state);
  expect(final.players.map((p) => p.gold)).toEqual([9, 9, 10, 9]);
});
it.each(['FORTITUDE', 'ALCOHOL', 'GOLD'] as const)(
  'Eve’s two identical broad Ignore copies protect direct %s effects with the errata trigger',
  (stat) => {
    expect(
      rdi2Pack.deckCards.find(
        (r) => r.cardId === 'carddef_rdi2_eve_ignore_card_all_stats',
      )!.quantity,
    ).toBe(2);
    const state = match(rdi2Pack),
      ignore = owns(state, 'eve', 'ignore_card_all_stats');
    const hit =
      stat === 'FORTITUDE'
        ? owns(state, 'gog', 'damage_two')
        : stat === 'ALCOHOL'
          ? owns(state, 'fleck', 'rowdy_song')
          : owns(state, 'dimli', 'tip_wench');
    keep(state, [ignore, hit]);
    activate(state, hit);
    const pending = until(play(state, hit, state.players[1]!.id).state, (s) =>
      legal(s, 1, ignore),
    );
    const final = settle(play(pending, ignore).state);
    expect(final.players[1]).toMatchObject({
      fortitude: 20,
      alcoholContent: 0,
      gold: 10,
    });
  },
);
it('Fleck’s sad song collects Gold from sober opponents and his rowdy song applies Fortitude, Alcohol then Inn payment in event order', () => {
  for (const mechanic of [
    'all_lose_one_alcohol_collect_one_each_other',
    'rowdy_song',
  ]) {
    const state = match(rdi2Pack),
      source = owns(state, 'fleck', mechanic);
    keep(state, [source]);
    activate(state, source);
    const result = play(state, source);
    const final = settle(result.state);
    if (mechanic === 'all_lose_one_alcohol_collect_one_each_other') {
      expect(final.players.map((p) => p.alcoholContent)).toEqual([0, 0, 0, 0]);
      expect(final.players.map((p) => p.gold)).toEqual([9, 9, 13, 9]);
    } else {
      expect(final.players.map((p) => p.fortitude)).toEqual([19, 19, 20, 19]);
      expect(final.players.map((p) => p.alcoholContent)).toEqual([1, 1, 1, 1]);
      expect(final.players[2]!.gold).toBe(9);
      const stats = result.events.filter((e) =>
        ['FORTITUDE_CHANGED', 'ALCOHOL_CHANGED', 'GOLD_CHANGED'].includes(
          e.type,
        ),
      );
      expect(stats.map((e) => e.type)).toEqual([
        'FORTITUDE_CHANGED',
        'FORTITUDE_CHANGED',
        'FORTITUDE_CHANGED',
        'ALCOHOL_CHANGED',
        'ALCOHOL_CHANGED',
        'ALCOHOL_CHANGED',
        'ALCOHOL_CHANGED',
        'GOLD_CHANGED',
      ]);
    }
  }
});
it.each(['SOMETIMES', 'ANYTIME', 'BOTH', 'NEITHER'] as const)(
  'compiled timing matrix %s uses response deadlines and the exact voice predicate',
  (mode) => {
    const state = match(rdi2Pack),
      hit = owns(state, 'dimli', 'damage_two'),
      sometimes = owns(state, 'gog', 'ignore_card_fortitude'),
      anytime = owns(state, 'gog', 'tip_wench');
    keep(state, [
      hit,
      ...(mode === 'SOMETIMES' || mode === 'BOTH' ? [sometimes] : []),
      ...(mode === 'ANYTIME' || mode === 'BOTH' ? [anytime] : []),
    ]);
    const result = play(state, hit, state.players[3]!.id).state;
    if (mode === 'NEITHER') {
      expect(result.responseWindow).toBeNull();
      expect(result.players[3]!.fortitude).toBe(18);
    } else {
      const prompt = projectPrivatePlayer(
        result,
        state.players[3]!.id,
      ).responsePrompt!;
      expect(prompt.deadlineAt).toBe(prompt.openedAt + 30000);
      expect(prompt.hasLegalSometimes).toBe(mode !== 'ANYTIME');
    }
  },
);
