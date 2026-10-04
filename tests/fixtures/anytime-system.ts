import { expect } from 'vitest';
import { taskEvent } from '../../src/engine/workflow-state';
import { assertCoreInvariants } from '../../src/engine/invariants';
import {
  genericState,
  putCard,
  play,
  passCurrent,
  send,
} from './generic-match';
import { cardInHand } from './timing-match';

export const anytimeSystemEvents = [
  'ANTE_REQUIRED',
  'PAYMENT_REQUIRED',
  'FORTITUDE_LOSS_RESOLVED',
  'GAMBLING_CHECKPOINT',
  'GAMBLING_WIN_BEFORE_PAYOUT',
] as const;

/** Original cards and real commands; no player has a Sometimes card in hand. */
export function anytimeSystemOpportunity(
  event: (typeof anytimeSystemEvents)[number],
  withSecond = false,
) {
  const state = genericState();
  const first = putCard(
    state,
    1,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 1 }],
    { type: 'ANYTIME' },
  );
  const second = putCard(
    state,
    1,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 }],
    { type: 'ANYTIME', suffix: 'shove' },
  );
  const isAttack =
    event === 'PAYMENT_REQUIRED' || event === 'FORTITUDE_LOSS_RESOLVED';
  const source = isAttack
    ? putCard(
        state,
        0,
        event === 'PAYMENT_REQUIRED'
          ? [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 2 }]
          : [
              {
                op: 'CHANGE_STAT',
                target: 'CHOSEN_PLAYER',
                stat: 'FORTITUDE',
                delta: -2,
              },
            ],
        { type: 'ACTION', suffix: 'shove' },
      )
    : cardInHand(state, 0, 'gamble');
  for (const player of state.players) {
    const keep =
      player.seat === 0
        ? [source]
        : player.seat === 1
          ? withSecond
            ? [first, second]
            : [first]
          : [];
    for (const id of player.hand.filter((id) => !keep.includes(id))) {
      player.characterDiscard.push(id);
      state.cards[id]!.location = {
        zone: 'CHARACTER_DISCARD',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    }
    player.hand = keep;
  }
  assertCoreInvariants(state);
  let pending = play(
    state,
    0,
    source,
    isAttack ? state.players[1]!.id : undefined,
  ).state;
  for (
    let i = 0;
    i < 64 && taskEvent(pending.resolutionStack.at(-1)?.task) !== event;
    i++
  ) {
    pending =
      pending.responseWindow || pending.control.phaseEnd
        ? passCurrent(pending).state
        : send(
            pending,
            'GAMBLING_PASS',
            {},
            pending.players.findIndex(
              (p) => p.id === pending.gambling!.priorityPlayerId,
            ),
          ).state;
  }
  expect(taskEvent(pending.resolutionStack.at(-1)?.task)).toBe(event);
  return { state: pending, first, second };
}
