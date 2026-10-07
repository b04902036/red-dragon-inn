import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { rdi2Pack } from '../fixtures/rdi2-content';
import {
  match,
  card,
  keep,
  activate,
  play,
  settle,
  until,
  drinkPile,
  innOrder,
} from '../fixtures/rdi2-match';
import { intent, mutable } from '../fixtures/core-match';

describe('every RDI2 Action and Gambling/Cheating definition', () => {
  for (const definition of rdi2Pack.cards.filter((c) =>
    ['ACTION', 'GAMBLING', 'CHEATING'].includes(c.type),
  )) {
    it(`${definition.id}: positive/negative legality and exact effect resolution`, () => {
      const base = match(rdi2Pack);
      for (const player of base.players) player.fortitude = 18;
      const cardId = Object.values(base.cards).find(
        (c) => c.definitionId === definition.id,
      )!.id;
      const seat = base.players.findIndex((p) => p.hand.includes(cardId));
      const start = card(base, 'gambling_start_or_control', seat);
      keep(base, [cardId, start]);
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
        activate(base, cardId);
        before = base;
      } else {
        activate(base, start);
        before = settle(play(base, start).state);
        before = until(
          before,
          (s) =>
            !s.responseWindow &&
            s.gambling?.priorityPlayerId === base.players[seat]!.id,
        );
      }
      const prepared = mutable(before);
      if (
        definition.effects.some(
          (e) =>
            e.op === 'FORCE_DRINK' ||
            (e.op === 'FORCE_SIMULTANEOUS_DRINK' && e.source !== 'INN'),
        )
      ) {
        for (const p of prepared.players)
          drinkPile(prepared, p.seat, [
            p.seat % 2 === 0 ? 'light_ale' : 'dark_ale',
          ]);
      }
      if (
        definition.effects.some(
          (e) => e.op === 'FORCE_SIMULTANEOUS_DRINK' && e.source === 'INN',
        )
      )
        innOrder(prepared, ['light_ale', 'dark_ale', 'wine', 'elven_wine']);
      const choice = projectPrivatePlayer(
        prepared,
        prepared.players[seat]!.id,
      ).legalPlays.find((p) => p.cardId === cardId)!;
      expect(choice).toBeDefined();
      const target = choice.legalTargetPlayerIds[0];
      const result = play(prepared, cardId, target);
      const finished = settle(result.state);
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
            expect(finished.players[p.seat]![key]).toBe(
              Math.max(0, p[key] + effect.delta),
            );
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
        if (effect.op === 'PAY_INN') {
          const payer =
            effect.target === 'SELF'
              ? actor
              : prepared.players.find((p) => p.id === target)!;
          expect(finished.players[payer.seat]!.gold).toBe(
            payer.gold - effect.amount,
          );
        }
        if (effect.op === 'FORCE_SIMULTANEOUS_DRINK')
          expect(finished.players.map((p) => p.alcoholContent)).toEqual([
            ...(effect.source === 'INN' ? [1, 1, 2, 3] : [1, 1, 1, 1]),
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
