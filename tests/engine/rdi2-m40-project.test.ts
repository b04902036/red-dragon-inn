import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import {
  genericState,
  putCard,
  legal,
  play,
  send,
  until,
  settle,
  reconnectAndReplay,
} from '../fixtures/generic-match';
const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const mechanic = source.mechanics.find(
  (m: { id: string }) => m.id === 'gain_two_fortitude',
);
function fixture(seat = 0, fortitude = 15) {
  const state = genericState();
  state.players[seat]!.fortitude = fortitude;
  const card = putCard(state, seat, mechanic.effects, {
    type: mechanic.cardType,
  });
  return { state, card, seat };
}
it.each([
  [15, 17],
  [16, 18],
  [18, 20],
  [19, 20],
  [20, 20],
])(
  'heals %i to %i through the shared cap, only self, without cost or alternate benefit',
  (before, after) => {
    const { state, card } = fixture(0, before);
    const others = state.players.slice(1);
    expect(legal(state, 0, card)!.legalTargetPlayerIds).toEqual([]);
    const queued = play(state, 0, card);
    expect(queued.state.players[0]!.fortitude).toBe(before);
    const final = settle(queued.state);
    expect(final.players[0]!.fortitude).toBe(after);
    expect(final.players[0]!.gold).toBe(state.players[0]!.gold);
    expect(final.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent,
    );
    expect(final.players[0]!.hand).not.toContain(card);
    expect(final.cards[card]!.location.zone).toBe('CHARACTER_DISCARD');
    expect(final.players.slice(1)).toEqual(others);
  },
);
it('rejects a forged other-player healing target atomically', () => {
  const { state, card } = fixture();
  const result = applyCommand(
    state,
    intent(state, 'PLAY_CARD', {
      cardId: card,
      targetPlayerId: state.players[1]!.id,
    }),
    { actorId: state.players[0]!.id },
  );
  expect(result.status).toBe('REJECTED');
  expect(result.state).toEqual(state);
});
it('plays during another player turn and preserves the opportunity on reconnect/replay', () => {
  const { state, card } = fixture(1);
  expect(state.activePlayerId).toBe(state.players[0]!.id);
  expect(legal(state, 1, card)).toBeDefined();
  const queued = play(state, 1, card).state;
  reconnectAndReplay(queued);
  expect(settle(queued).players[1]!.fortitude).toBe(17);
});
it('plays in the phase-end Anytime opportunity without a Sometimes trigger', () => {
  const { state, card } = fixture();
  const pending = send(state, 'SKIP_ACTION', {}, 0).state;
  expect(pending.control.phaseEnd).not.toBeNull();
  expect(legal(pending, 0, card)).toBeDefined();
  expect(settle(play(pending, 0, card).state).players[0]!.fortitude).toBe(17);
});
it('plays during an active gambling Round using ordinary Anytime legality', () => {
  const { state, card } = fixture(1);
  const pending = settle(play(state, 0, cardInHand(state, 0, 'gamble')).state);
  expect(pending.gambling).not.toBeNull();
  expect(legal(pending, 1, card)).toBeDefined();
  expect(settle(play(pending, 1, card).state).players[1]!.fortitude).toBe(17);
});
it('plays inside an open response sequence and before the normal ordering action', () => {
  const { state, card } = fixture(1);
  const source = putCard(
    state,
    0,
    [{ op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -1 }],
    { type: 'ACTION' },
  );
  const pending = until(
    play(state, 0, source).state,
    (s) => legal(s, 1, card) !== undefined,
  );
  expect(pending.responseWindow).not.toBeNull();
  expect(settle(play(pending, 1, card).state).players[1]!.fortitude).toBe(17);
  const own = fixture();
  own.state.phase = 'ORDER_DRINK';
  expect(legal(own.state, 0, own.card)).toBeDefined();
});
it.each([
  [19, 18, 17, 19, false],
  [17, 20, 15, 17, true],
])(
  'gives a final rescue after loss at Fortitude %i / Alcohol %i, including insufficient healing',
  (initial, alcohol, lost, healed, eliminated) => {
    const { state, card } = fixture(1, initial);
    state.players[1]!.alcoholContent = alcohol;
    const attack = putCard(
      state,
      0,
      [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: -2,
        },
      ],
      { type: 'ACTION' },
    );
    const pending = until(
      play(state, 0, attack, state.players[1]!.id).state,
      (s) =>
        s.players[1]!.fortitude === lost && legal(s, 1, card) !== undefined,
    );
    expect(pending.players[1]!.eliminated).toBe(false);
    const queued = play(pending, 1, card).state;
    expect(queued.players[1]!.fortitude).toBe(lost);
    const final = settle(queued);
    expect(final.players[1]!.fortitude).toBe(healed);
    expect(final.players[1]!.eliminated).toBe(eliminated);
  },
);
it('legal Negate prevents all healing until stack resolution', () => {
  const { state, card } = fixture();
  const counter = putCard(state, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ANYTIME'] }]],
    },
  });
  const pending = until(
    play(state, 0, card).state,
    (s) => legal(s, 1, counter) !== undefined,
  );
  expect(pending.players[0]!.fortitude).toBe(15);
  const final = settle(play(pending, 1, counter).state);
  expect(final.players[0]!.fortitude).toBe(15);
});
it('remains a direct Fortitude-affecting card even at the cap', () => {
  const { state, card } = fixture(0, 20);
  const response = putCard(
    state,
    0,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      suffix: 'shove',
      trigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'PENDING_STAT',
              stat: 'FORTITUDE',
              direction: 'ANY',
              relation: 'SELF',
            },
          ],
        ],
      },
    },
  );
  const definition = cardDefinitionSchema.parse(
    state.definitions[state.cards[card]!.definitionId],
  );
  expect(definition.effects).toEqual([
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: 2 },
  ]);
  const pending = until(
    play(state, 0, card).state,
    (s) => legal(s, 0, response) !== undefined,
  );
  expect(legal(pending, 0, response)).toBeDefined();
});
