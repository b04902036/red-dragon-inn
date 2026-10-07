import { expect, it } from 'vitest';
import {
  genericState,
  putCard,
  legal,
  play,
  settle,
} from '../fixtures/generic-match';
it('a generic Action two-Gold payment permits self and collects from another player', () => {
  const s = genericState(),
    id = putCard(
      s,
      0,
      [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 2 }],
      { type: 'ACTION', targetPolicy: 'ANY_LIVING_PLAYER' },
    );
  expect(legal(s, 0, id)?.legalTargetPlayerIds).toContain(s.players[0]!.id);
  const result = settle(play(s, 0, id, s.players[1]!.id).state);
  expect(result.players[0]!.gold).toBe(s.players[0]!.gold + 2);
  expect(result.players[1]!.gold).toBe(s.players[1]!.gold - 2);
});
it('a generic Anytime one-Gold payment allows self targeting without moving Gold', () => {
  const s = genericState(),
    id = putCard(
      s,
      0,
      [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 1 }],
      { type: 'ANYTIME', targetPolicy: 'ANY_LIVING_PLAYER' },
    );
  expect(legal(s, 0, id)?.legalTargetPlayerIds).toContain(s.players[0]!.id);
  const result = settle(play(s, 0, id, s.players[0]!.id).state);
  expect(result.players.map((p) => p.gold)).toEqual(
    s.players.map((p) => p.gold),
  );
});
it('a generic Anytime one-Gold payment transfers exactly one Gold from another player', () => {
  const s = genericState(),
    id = putCard(
      s,
      0,
      [{ op: 'COLLECT_GOLD', target: 'CHOSEN_PLAYER', amount: 1 }],
      { type: 'ANYTIME', targetPolicy: 'ANY_LIVING_PLAYER' },
    );
  const result = settle(play(s, 0, id, s.players[1]!.id).state);
  expect(result.players[0]!.gold).toBe(s.players[0]!.gold + 1);
  expect(result.players[1]!.gold).toBe(s.players[1]!.gold - 1);
});
