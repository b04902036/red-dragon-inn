import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import {
  genericState,
  putCard,
  play,
  settle,
  until,
  legal,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  {
    op: 'CHANGE_STAT',
    target: 'EACH_OTHER_PLAYER',
    stat: 'FORTITUDE',
    delta: -1,
  },
];
it('synthetic verified binding hits every other player, never actor, with no Gold/Alcohol change or chosen target', () => {
  const m = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ).mechanics[34];
  expect(m.engineAudit.supportedBinding).toEqual({ effects });
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  expect(legal(state, 0, card)!.requiresTarget).toBe(false);
  const final = settle(play(state, 0, card).state);
  expect(final.players.map((p) => p.fortitude)).toEqual(
    state.players.map((p, i) => p.fortitude - (i === 0 ? 0 : 1)),
  );
  expect(final.players.map((p) => [p.gold, p.alcoholContent])).toEqual(
    state.players.map((p) => [p.gold, p.alcoholContent]),
  );
});
it.each(['IGNORE', 'NEGATE'] as const)(
  'a target %s uses correct shared multi-target boundaries',
  (op) => {
    const state = genericState(),
      card = putCard(state, 0, effects, { type: 'ACTION' }),
      response = putCard(
        state,
        1,
        [
          op === 'IGNORE'
            ? { op, scope: 'CURRENT_EFFECT' }
            : { op, scope: 'TOP_STACK' },
        ],
        {
          trigger: {
            event: 'CARD',
            alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
          },
        },
      );
    const pending = until(
      play(state, 0, card).state,
      (s) => legal(s, 1, response) !== undefined,
    );
    const final = settle(play(pending, 1, response).state);
    expect(final.players.map((p) => p.fortitude)).toEqual(
      state.players.map(
        (p, i) => p.fortitude - (op === 'NEGATE' || i < 2 ? 0 : 1),
      ),
    );
  },
);
