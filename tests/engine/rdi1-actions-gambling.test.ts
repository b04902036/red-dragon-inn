import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { rdi1Pack } from '../fixtures/rdi1-content';
import {
  rdi1Match,
  rdi1Card,
  rdi1Keep,
  rdi1Activate,
  rdi1Play,
  rdi1Settle,
  rdi1Until,
  rdi1DrinkPile,
  rdi1Send,
} from '../fixtures/rdi1-match';
import { intent, mutable } from '../fixtures/core-match';

describe('every RDI1 Action and Gambling/Cheating definition', () => {
  for (const definition of rdi1Pack.cards.filter((c) =>
    ['ACTION', 'GAMBLING', 'CHEATING'].includes(c.type),
  )) {
    it(`${definition.id}: positive/negative legality and exact effect resolution`, () => {
      const base = rdi1Match(rdi1Pack);
      const cardId = Object.values(base.cards).find(
        (c) => c.definitionId === definition.id,
      )!.id;
      const seat = base.players.findIndex((p) => p.hand.includes(cardId));
      const start = rdi1Card(base, 'gambling_start_or_control', seat);
      rdi1Keep(base, [cardId, start]);
      const negative = mutable(base);
      negative.phase = 'DISCARD_DRAW';
      negative.activePlayerId = negative.players[(seat + 1) % 4]!.id;
      expect(
        projectPrivatePlayer(
          negative,
          negative.players[seat]!.id,
        ).legalPlays.some((p) => p.cardId === cardId),
      ).toBe(false);
      expect(
        applyCommand(negative, intent(negative, 'PLAY_CARD', { cardId }), {
          actorId: negative.players[seat]!.id,
          clock: { now: () => 1000 },
        }),
      ).toMatchObject({ status: 'REJECTED', state: negative, events: [] });
      let before;
      if (
        definition.type === 'ACTION' ||
        ((definition.type === 'GAMBLING' || definition.type === 'CHEATING') &&
          definition.gambling?.canStart)
      ) {
        rdi1Activate(base, cardId);
        before = base;
      } else {
        rdi1Activate(base, start);
        before = rdi1Settle(rdi1Play(base, start).state);
        before = rdi1Until(
          before,
          (s) =>
            !s.responseWindow &&
            s.gambling?.priorityPlayerId === base.players[seat]!.id,
        );
      }
      const prepared = mutable(before);
      if (
        definition.effects.some(
          (e) => e.op === 'FORCE_DRINK' || e.op === 'FORCE_SIMULTANEOUS_DRINK',
        )
      ) {
        for (const p of prepared.players)
          rdi1DrinkPile(prepared, p.seat, [
            p.seat % 2 === 0 ? 'light_ale' : 'dark_ale',
          ]);
      }
      const choice = projectPrivatePlayer(
        prepared,
        prepared.players[seat]!.id,
      ).legalPlays.find((p) => p.cardId === cardId)!;
      expect(choice).toBeDefined();
      const target = choice.legalTargetPlayerIds[0];
      const result = rdi1Play(prepared, cardId, target);
      const finished = rdi1Settle(result.state);
      if (definition.effects.some((e) => e.op === 'START_GAMBLING'))
        expect(
          finished.resolutionStack.some((f) => f.sourceCardId === cardId),
        ).toBe(true);
      else expect(finished.players[seat]!.characterDiscard).toContain(cardId);
      const actor = prepared.players[seat]!;
      for (const effect of definition.effects) {
        if (effect.op === 'CHANGE_STAT') {
          const targets = prepared.players.filter((p) =>
            effect.target === 'SELF'
              ? p.id === actor.id
              : effect.target === 'CHOSEN_PLAYER'
                ? p.id === target
                : effect.target === 'EACH_OTHER_PLAYER'
                  ? p.id !== actor.id
                  : true,
          );
          const key =
            effect.stat === 'FORTITUDE'
              ? 'fortitude'
              : effect.stat === 'ALCOHOL'
                ? 'alcoholContent'
                : 'gold';
          for (const p of targets)
            expect(finished.players[p.seat]![key]).toBe(p[key] + effect.delta);
        }
        if (effect.op === 'COLLECT_GOLD') {
          const targets = prepared.players.filter((p) =>
            effect.target === 'CHOSEN_PLAYER'
              ? p.id === target
              : p.id !== actor.id,
          );
          for (const p of targets)
            expect(finished.players[p.seat]!.gold).toBe(p.gold - effect.amount);
          expect(finished.players[seat]!.gold).toBe(
            actor.gold + targets.length * effect.amount,
          );
        }
        if (effect.op === 'FORCE_DRINK')
          expect(
            finished.players.find((p) => p.id === target)!.alcoholContent,
          ).toBe(1);
        if (effect.op === 'FORCE_SIMULTANEOUS_DRINK')
          expect(finished.players.map((p) => p.alcoholContent)).toEqual([
            1, 1, 1, 1,
          ]);
        if (effect.op === 'START_GAMBLING') {
          expect(finished.gambling!.pot).toBe(4);
          expect(finished.gambling!.controlPlayerId).toBe(actor.id);
        }
        if (effect.op === 'TAKE_GAMBLING_CONTROL') {
          expect(finished.gambling!.controlPlayerId).toBe(actor.id);
          expect(finished.gambling!.allowedControlCategories).toEqual(
            effect.allowedNextCategories,
          );
        }
        if (effect.op === 'ANTE_ALL_ACTIVE') {
          expect(finished.gambling!.pot).toBe(
            prepared.gambling!.pot + 4 * effect.amount,
          );
          expect(finished.players.map((p) => p.gold)).toEqual(
            prepared.players.map((p) => p.gold - effect.amount),
          );
        }
        if (effect.op === 'FORCE_LEAVE_GAMBLING')
          expect(finished.gambling!.leftPlayerIds).toContain(target);
      }
    });
  }
});

it('real Strong Hand blocks Gambling control, allows Cheating and Cheating restores both categories', () => {
  const state = rdi1Match(rdi1Pack);
  const start = rdi1Card(state, 'gambling_start_or_control');
  const strong = rdi1Card(
    state,
    'gambling_winning_hand',
    state.players.findIndex((p) => p.id === state.cards[start]!.ownerId),
  );
  const seat = state.players.findIndex(
    (p) => p.id === state.cards[strong]!.ownerId,
  );
  const cheat = rdi1Card(state, 'cheat_take_control', seat);
  const gamble = rdi1Card(state, 'gambling_raise_one', seat);
  rdi1Keep(state, [start, strong, cheat, gamble]);
  rdi1Activate(state, start);
  let pending = rdi1Settle(rdi1Play(state, start).state);
  pending = rdi1Until(
    pending,
    (s) =>
      !s.responseWindow &&
      s.gambling?.priorityPlayerId === state.players[seat]!.id,
  );
  pending = rdi1Settle(rdi1Play(pending, strong).state);
  const cheater = state.cards[cheat]!.ownerId!;
  pending = rdi1Until(
    pending,
    (s) => !s.responseWindow && s.gambling?.priorityPlayerId === cheater,
  );
  const cheaterSeat = state.players.findIndex((p) => p.id === cheater);
  const view = projectPrivatePlayer(pending, cheater);
  expect(view.legalPlays.some((p) => p.cardId === cheat)).toBe(true);
  const gamblingCard = Object.values(pending.cards).find(
    (c) =>
      c.definitionId.endsWith('_gambling_raise_one') && c.ownerId === cheater,
  )!;
  const blocked = mutable(pending);
  const owner = blocked.players[cheaterSeat]!;
  if (!owner.hand.includes(gamblingCard.id)) {
    owner.characterDeck.cardIds.splice(
      owner.characterDeck.cardIds.indexOf(gamblingCard.id),
      1,
    );
    owner.hand.push(gamblingCard.id);
    blocked.cards[gamblingCard.id]!.location = {
      zone: 'HAND',
      playerId: owner.id,
    };
  }
  expect(
    projectPrivatePlayer(blocked, owner.id).legalPlays.some(
      (p) => p.cardId === gamblingCard.id,
    ),
  ).toBe(false);
  expect(
    applyCommand(
      blocked,
      intent(blocked, 'GAMBLING_PLAY', { cardId: gamblingCard.id }),
      { actorId: owner.id, clock: { now: () => 1000 } },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'CONTROL_RESTRICTED' });
  expect(
    rdi1Settle(rdi1Play(pending, cheat).state).gambling!
      .allowedControlCategories,
  ).toEqual(['GAMBLING', 'CHEATING']);
});

it('all compiled multi-use leave cards execute their Drink branch and mandatory Inn payment', () => {
  for (const definition of rdi1Pack.cards.filter((c) =>
    c.effects.some((e) => e.op === 'CONTEXT_BRANCH'),
  )) {
    const state = rdi1Match(rdi1Pack);
    const cardId = Object.values(state.cards).find(
      (c) => c.definitionId === definition.id,
    )!.id;
    const seat = state.players.findIndex((p) => p.hand.includes(cardId));
    rdi1Keep(state, [cardId]);
    state.phase = 'DRINK';
    state.activePlayerId = state.players[seat]!.id;
    rdi1DrinkPile(state, seat, ['wine']);
    const pending = rdi1Send(state, seat, 'TAKE_DRINK').state;
    const finished = rdi1Settle(rdi1Play(pending, cardId).state);
    expect(finished.players[seat]!.alcoholContent).toBe(0);
    const paid = definition.effects.some(
      (e) =>
        e.op === 'CONTEXT_BRANCH' &&
        e.branches.includes('IGNORE_DRINK_AND_PAY_INN_1'),
    );
    expect(finished.players[seat]!.gold).toBe(
      state.players[seat]!.gold - (paid ? 1 : 0),
    );
  }
});

it('each real Inn substitution also answers PAYMENT_REQUIRED without spending the payer’s Gold', () => {
  for (const definition of rdi1Pack.cards.filter(
    (c) =>
      c.type === 'SOMETIMES' &&
      c.effects[0]?.op === 'SUBSTITUTE_PAYMENT_FROM_INN',
  )) {
    const state = rdi1Match(rdi1Pack);
    const substitute = Object.values(state.cards).find(
      (c) => c.definitionId === definition.id,
    )!.id;
    const seat = state.players.findIndex((p) => p.hand.includes(substitute));
    const tip = rdi1Card(state, 'tip_wench', seat);
    rdi1Keep(state, [tip, substitute]);
    const pending = rdi1Until(
      rdi1Play(state, tip, state.players[seat]!.id).state,
      (s) =>
        projectPrivatePlayer(s, s.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === substitute,
        ),
    );
    expect(pending.resolutionStack.at(-1)!.task).toMatchObject({
      kind: 'PAYMENT',
      purpose: 'PAYMENT',
      payer: state.players[seat]!.id,
    });
    const final = rdi1Settle(rdi1Play(pending, substitute).state);
    expect(final.players[seat]!.gold).toBe(10);
    expect(final.players[seat]!.characterDiscard).toContain(substitute);
  }
});
