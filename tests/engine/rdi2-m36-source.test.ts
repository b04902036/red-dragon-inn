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
  systemTrigger,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  {
    op: 'CHANGE_STAT',
    target: 'EACH_OTHER_PLAYER',
    stat: 'FORTITUDE',
    delta: -1,
  },
  { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: 1 },
  { op: 'PAY_INN', target: 'SELF', amount: 1 },
];
it.each(['breather', 'shove'])(
  'synthetic original copy %s preserves other-player damage, owner-including Alcohol and resolving payment',
  (suffix) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[35];
    expect(m.engineAudit.supportedBinding).toEqual({ effects });
    const state = genericState(),
      card = putCard(state, 0, effects, { type: 'ACTION', suffix });
    const played = play(state, 0, card);
    expect(
      played.state.players.map((p) => [p.fortitude, p.alcoholContent, p.gold]),
    ).toEqual(
      state.players.map((p) => [p.fortitude, p.alcoholContent, p.gold]),
    );
    const final = settle(played.state);
    expect(
      final.players.map((p) => [p.fortitude, p.alcoholContent, p.gold]),
    ).toEqual(
      state.players.map((p, i) => [
        p.fortitude - (i === 0 ? 0 : 1),
        p.alcoholContent + 1,
        p.gold - (i === 0 ? 1 : 0),
      ]),
    );
  },
);
it.each(['IGNORE', 'NEGATE'] as const)(
  'target %s handles all effects with proper shared boundaries',
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
    expect(
      final.players.map((p) => [p.fortitude, p.alcoholContent, p.gold]),
    ).toEqual(
      state.players.map((p, i) => [
        p.fortitude - (op === 'NEGATE' || i < 2 ? 0 : 1),
        p.alcoholContent + (op === 'NEGATE' || i === 1 ? 0 : 1),
        p.gold - (op === 'IGNORE' && i === 0 ? 1 : 0),
      ]),
    );
  },
);
it('Inn substitution preserves prior damage and Alcohol; own-card Gold Ignore remains illegal', () => {
  const state = genericState(),
    card = putCard(state, 0, effects, { type: 'ACTION' });
  const ignore = putCard(
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
              stat: 'GOLD',
              direction: 'ANY',
              relation: 'SELF',
            },
          ],
        ],
      },
    },
  );
  const substitution = putCard(
    state,
    0,
    [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }],
    {
      suffix: 'gamble',
      trigger: systemTrigger('PAYMENT_REQUIRED', [
        {
          kind: 'PAYMENT_CONTEXT',
          payer: 'SELF',
          purpose: 'PAYMENT',
          minAmount: 1,
        },
      ]),
    },
  );
  const played = play(state, 0, card);
  expect(legal(played.state, 0, ignore)).toBeUndefined();
  const pending = until(
    played.state,
    (s) => legal(s, 0, substitution) !== undefined,
  );
  const final = settle(play(pending, 0, substitution).state);
  expect(final.players[0]!.gold).toBe(state.players[0]!.gold);
  expect(final.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => p.alcoholContent + 1),
  );
  expect(final.players[1]!.fortitude).toBe(state.players[1]!.fortitude - 1);
});
