import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
import { m22Trigger } from '../fixtures/rdi2-m22-source';
import {
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';
const effects: Effect[] = [{ op: 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE' }];
it.each([15, 19])(
  'converts own Drink Alcohol to Fortitude, preserves its separate Fortitude effect and applies the 20 cap from %s',
  (start) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[23];
    expect(m.engineAudit.supportedBinding).toEqual({
      responseTrigger: m22Trigger,
      effects,
    });
    const state = drinkState(['fizz']);
    state.rules.timing = { ...DEFAULT_RULES.timing };
    state.players[0]!.fortitude = start;
    const id = state.players[0]!.drinkPile[0]!,
      def = state.cards[id]!.definitionId;
    state.definitions[def] = cardDefinitionSchema.parse({
      ...state.definitions[def],
      alcoholContent: 3,
      fortitudeChange: 1,
    });
    const own = putCard(state, 0, effects, { trigger: m22Trigger }),
      other = putCard(state, 1, effects, { trigger: m22Trigger });
    expect(legal(state, 0, own)).toBeUndefined();
    const s = until(
      send(state, 'TAKE_DRINK', {}, 0).state,
      (x) => legal(x, 0, own) !== undefined,
    );
    expect(legal(s, 1, other)).toBeUndefined();
    reconnectAndReplay(s);
    const final = settle(play(s, 0, own).state);
    expect(final.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent,
    );
    expect(final.players[0]!.fortitude).toBe(Math.min(20, start + 4));
    expect(final.players.slice(1).map((p) => p.fortitude)).toEqual(
      state.players.slice(1).map((p) => p.fortitude),
    );
  },
);
