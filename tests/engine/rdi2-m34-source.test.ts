import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import { applyCommand } from '../../src/engine/commands';
import { intent } from '../fixtures/core-match';
import {
  genericState,
  putCard,
  play,
  settle,
  until,
  legal,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -4 },
];
it("the verified synthetic four-damage binding changes only another player's Fortitude", () => {
  const m = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ).mechanics[33];
  expect(m.engineAudit.supportedBinding).toEqual({ effects });
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  const final = settle(play(state, 0, card, state.players[1]!.id).state);
  expect(final.players.map((p) => p.fortitude)).toEqual(
    state.players.map((p, i) => p.fortitude - (i === 1 ? 4 : 0)),
  );
  expect(
    final.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]),
  ).toEqual(state.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]));
});
it.each(['IGNORE', 'NEGATE'] as const)(
  'ordinary %s prevents four-damage Action',
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
      play(state, 0, card, state.players[1]!.id).state,
      (s) => legal(s, 1, response) !== undefined,
    );
    expect(settle(play(pending, 1, response).state).players[1]!.fortitude).toBe(
      state.players[1]!.fortitude,
    );
  },
);
it('self targeting rejects at the shared server boundary', () => {
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  const r = applyCommand(
    state,
    intent(state, 'PLAY_CARD', {
      cardId: card,
      targetPlayerId: state.players[0]!.id,
    }),
    { actorId: state.players[0]!.id },
  );
  expect(r.status).toBe('REJECTED');
  expect(r.state).toEqual(state);
});
