import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { drinkState } from '../fixtures/drink-match';
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
    {
      op: 'MODIFY_DRINK',
      alcoholDelta: 2,
      fortitudeDelta: 0,
      allowDrinkEvents: false,
    },
  ],
  trigger: ResponseTrigger = {
    event: 'DRINK',
    alternatives: [[{ kind: 'SOURCE_TYPE', types: ['DRINK'] }]],
  };
it.each([0, 1])(
  'adds exactly two to a pending Drink when played by seat %s without directly changing player stats before consumption',
  (seat) => {
    const m = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/source-candidate.json',
        'utf8',
      ),
    ).mechanics[24];
    expect(m.engineAudit.supportedBinding).toEqual({
      responseTrigger: trigger,
      effects,
    });
    const state = drinkState(['fizz']);
    state.rules.timing = { ...DEFAULT_RULES.timing };
    const def = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
    state.definitions[def] = cardDefinitionSchema.parse({
      ...state.definitions[def],
      alcoholContent: 3,
    });
    const card = putCard(state, seat, effects, { trigger });
    expect(legal(state, seat, card)).toBeUndefined();
    let s = until(
      send(state, 'TAKE_DRINK', {}, 0).state,
      (x) => legal(x, seat, card) !== undefined,
    );
    s = play(s, seat, card).state;
    s = until(s, (x) => x.resolutionStack.length === 1);
    expect(s.players[0]!.alcoholContent).toBe(state.players[0]!.alcoholContent);
    reconnectAndReplay(s);
    const final = settle(s);
    expect(final.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent + 5,
    );
    expect(final.players.slice(1).map((p) => p.alcoholContent)).toEqual(
      state.players.slice(1).map((p) => p.alcoholContent),
    );
  },
);
