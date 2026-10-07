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
  reconnectAndReplay,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: -1 },
  { op: 'COLLECT_GOLD', target: 'EACH_OTHER_PLAYER', amount: 1 },
];
function fixture() {
  const state = genericState();
  state.players.forEach((p, i) => {
    p.alcoholContent = i === 1 ? 0 : 3;
    p.gold = 10;
  });
  const card = putCard(state, 0, effects, { type: 'ACTION' });
  return { state, card };
}
it('uses the shared binding, sobers actor and opponents, and collects one from each opponent even at zero Alcohol', () => {
  const m = JSON.parse(
    readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
  ).mechanics[27];
  expect(m.engineAudit.supportedBinding).toEqual({ effects });
  const { state, card } = fixture();
  const pending = play(state, 0, card).state;
  reconnectAndReplay(pending);
  const final = settle(pending);
  expect(final.players.map((p) => p.alcoholContent)).toEqual(
    state.players.map((p) => Math.max(0, p.alcoholContent - 1)),
  );
  expect(final.players.map((p) => p.gold)).toEqual(
    state.players.map(
      (p, i) => p.gold + (i === 0 ? state.players.length - 1 : -1),
    ),
  );
});
it('shared Ignore protects one opponent from both Alcohol and Gold effects while other players resolve normally', () => {
  const { state, card } = fixture();
  state.players[1]!.alcoholContent = 3;
  const ignore = putCard(
    state,
    1,
    [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
    {
      trigger: {
        event: 'CARD',
        alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
      },
    },
  );
  let s = until(
    play(state, 0, card).state,
    (x) => legal(x, 1, ignore) !== undefined,
  );
  s = play(s, 1, ignore).state;
  const final = settle(s);
  expect(final.players[1]!.gold).toBe(10);
  expect(final.players[1]!.alcoholContent).toBe(3);
  expect(final.players[0]!.alcoholContent).toBe(2);
  expect(final.players[0]!.gold).toBe(10 + state.players.length - 2);
  expect(final.players.slice(2).map((p) => p.gold)).toEqual(
    state.players.slice(2).map(() => 9),
  );
});
it('shared Negate prevents both effects of the pending Action', () => {
  const { state, card } = fixture();
  const negate = putCard(state, 1, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
    trigger: {
      event: 'CARD',
      alternatives: [[{ kind: 'SOURCE_TYPE', types: ['ACTION'] }]],
    },
  });
  let s = until(
    play(state, 0, card).state,
    (x) => legal(x, 1, negate) !== undefined,
  );
  s = play(s, 1, negate).state;
  const final = settle(s);
  expect(final.players.map((p) => [p.alcoholContent, p.gold])).toEqual(
    state.players.map((p) => [p.alcoholContent, p.gold]),
  );
});
