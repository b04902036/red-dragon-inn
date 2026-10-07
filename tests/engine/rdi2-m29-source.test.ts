import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import {
  genericState,
  putCard,
  play,
  settle,
  legal,
} from '../fixtures/generic-match';
const effects: Effect[] = [
  { op: 'CHANGE_STAT', target: 'CHOSEN_PLAYER', stat: 'ALCOHOL', delta: 2 },
];
it.each(['breather', 'shove'])(
  'physical copy fixture %s adds exactly two only to another chosen player',
  (suffix) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[28];
    expect(m.engineAudit.supportedBinding).toEqual({ effects });
    const state = genericState();
    state.players.forEach((p) => {
      p.alcoholContent = 2;
    });
    const card = putCard(state, 0, effects, { type: 'ACTION', suffix });
    expect(legal(state, 0, card)!.legalTargetPlayerIds).not.toContain(
      state.players[0]!.id,
    );
    const final = settle(play(state, 0, card, state.players[1]!.id).state);
    expect(final.players.map((p) => p.alcoholContent)).toEqual(
      state.players.map((p, i) => p.alcoholContent + (i === 1 ? 2 : 0)),
    );
    expect(final.players.map((p) => p.gold)).toEqual(
      state.players.map((p) => p.gold),
    );
  },
);
it('obeys the shared Alcohol cap of twenty even when the chosen player is already at nineteen', () => {
  const state = genericState();
  state.players[1]!.alcoholContent = 19;
  state.players[1]!.fortitude = 20;
  const card = putCard(state, 0, effects, { type: 'ACTION' });
  const final = settle(play(state, 0, card, state.players[1]!.id).state);
  expect(final.players[1]!.alcoholContent).toBe(20);
});
