import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import {
  genericState,
  putCard,
  play,
  settle,
  legal,
  until,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -1 },
];
it('shared one-damage Action affects only a chosen opponent and rejects self selection', () => {
  const m = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ).mechanics[29];
  expect(m.engineAudit.supportedBinding).toEqual({ effects });
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  expect(legal(state, 0, card)!.legalTargetPlayerIds).not.toContain(
    state.players[0]!.id,
  );
  const final = settle(play(state, 0, card, state.players[1]!.id).state);
  expect(final.players.map((p) => p.fortitude)).toEqual(
    state.players.map((p, i) => p.fortitude - (i === 1 ? 1 : 0)),
  );
  expect(final.players.map((p) => [p.alcoholContent, p.gold])).toEqual(
    state.players.map((p) => [p.alcoholContent, p.gold]),
  );
});
it.each(['IGNORE', 'NEGATE'] as const)(
  'shared %s response prevents one-damage Fortitude loss',
  (op) => {
    const state = genericState(),
      card = putCard(state, 0, effects, { type: 'ACTION' }),
      defense = putCard(
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
    let s = until(
      play(state, 0, card, state.players[1]!.id).state,
      (x) => legal(x, 1, defense) !== undefined,
    );
    s = play(s, 1, defense).state;
    const final = settle(s);
    expect(final.players.map((p) => p.fortitude)).toEqual(
      state.players.map((p) => p.fortitude),
    );
  },
);
