import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import { drinkState } from '../fixtures/drink-match';
import { DEFAULT_RULES } from '../../src/engine/rules';
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
const effects: Effect[] = [
  { op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
];
it.each([false, true])(
  'combines the completed Drink before splitting all numeric effects (Chasers=%s)',
  (chaser) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[22];
    expect(m.engineAudit.supportedBinding).toEqual({
      responseTrigger: m22Trigger,
      effects,
    });
    const state = drinkState([]);
    state.rules.timing = { ...DEFAULT_RULES.timing };
    state.players[0]!.fortitude = 15;
    state.players[1]!.fortitude = 15;
    const ids = state.innDrinkDeck.cardIds.slice(0, chaser ? 2 : 1);
    state.innDrinkDeck.cardIds = state.innDrinkDeck.cardIds.slice(ids.length);
    state.players[0]!.drinkPile = ids;
    ids.forEach((id, i) => {
      const d = cardDefinitionSchema.parse({
        id: `carddef_test_m23_${i}`,
        name: 'Original synthetic split Drink',
        rulesText: 'Synthetic Drink with numeric effects.',
        source: 'TEST_FIXTURE',
        type: 'DRINK',
        effects: [],
        alcoholContent: i === 0 ? 3 : 2,
        fortitudeChange: 1,
        chaser: chaser && i === 0,
      });
      state.definitions[d.id] = d;
      state.cards[id]!.definitionId = d.id;
      state.cards[id]!.location = {
        zone: 'DRINK_PILE',
        playerId: state.players[0]!.id,
      };
    });
    const split = putCard(state, 0, effects, { trigger: m22Trigger });
    const other = putCard(state, 1, effects, { trigger: m22Trigger });
    let s = until(
      send(state, 'TAKE_DRINK', {}, 0).state,
      (x) => legal(x, 0, split) !== undefined,
    );
    expect(s.resolutionStack.at(-1)!.sourceCardIds).toEqual(ids);
    expect(legal(s, 1, other)).toBeUndefined();
    s = play(s, 0, split, state.players[1]!.id).state;
    reconnectAndReplay(s);
    const final = settle(s);
    expect(final.players.slice(0, 2).map((p) => p.alcoholContent)).toEqual(
      state.players.slice(0, 2).map((p) => p.alcoholContent + (chaser ? 3 : 2)),
    );
    expect(final.players.slice(0, 2).map((p) => p.fortitude)).toEqual([16, 16]);
    expect([...final.innDrinkDiscard].sort()).toEqual([...ids].sort());
  },
);
