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
  passCurrent,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'FORTITUDE', delta: -3 },
];
it.each(['breather', 'shove'])(
  'current fire Action copy %s deals exactly three to another player with no added cost or effect',
  (suffix) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[31];
    expect(m.engineAudit.supportedBinding).toEqual({ effects });
    const state = genericState(),
      card = putCard(state, 0, effects, { type: 'ACTION', suffix });
    expect(legal(state, 0, card)!.legalTargetPlayerIds).not.toContain(
      state.players[0]!.id,
    );
    const played = play(state, 0, card, state.players[1]!.id);
    expect(played.events.some((event) => event.type === 'GOLD_CHANGED')).toBe(
      false,
    );
    let final = played.state;
    for (
      let i = 0;
      i < 128 &&
      (final.responseWindow !== null || final.control.phaseEnd !== null);
      i++
    ) {
      const result = passCurrent(final);
      expect(result.events.some((event) => event.type === 'GOLD_CHANGED')).toBe(
        false,
      );
      final = result.state;
    }
    expect(final.responseWindow).toBeNull();
    expect(final.control.phaseEnd).toBeNull();
    expect(final.players.map((p) => p.fortitude)).toEqual(
      state.players.map((p, i) => p.fortitude - (i === 1 ? 3 : 0)),
    );
    expect(
      final.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]),
    ).toEqual(
      state.players.map((p) => [p.gold, p.alcoholContent, p.drinkPile]),
    );
  },
);
it.each(['IGNORE', 'NEGATE'] as const)(
  'normal %s protects against the current three-Fortitude fire effect',
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
    expect(settle(s).players.map((p) => p.fortitude)).toEqual(
      state.players.map((p) => p.fortitude),
    );
  },
);
