import { describe, expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  projectPublicGame,
  projectPrivatePlayer,
} from '../../src/protocol/projections';
import { drinkState } from '../fixtures/drink-match';
import {
  genericState,
  putCard,
  play,
  send,
  until,
  settle,
  legal,
  reconnectAndReplay,
} from '../fixtures/generic-match';

function drinks(suffixes = ['fizz']) {
  const state = drinkState(suffixes);
  state.players[0]!.fortitude = 15;
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const id = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
  if (state.definitions[id]!.type === 'DRINK')
    state.definitions[id] = cardDefinitionSchema.parse({
      ...state.definitions[id],
      alcoholContent: 3,
    });
  return state;
}
const drinkTrigger = {
  event: 'DRINK' as const,
  alternatives: [[{ kind: 'AFFECTS' as const, relation: 'SELF' as const }]],
};
describe('generic independent Drink workflows', () => {
  it.each([
    'ROUND_ON_HOUSE',
    'FORCE_SIMULTANEOUS_DRINK',
    'DRINKING_CONTEST',
  ] as const)(
    'executes %s from a revealed Drink Event without treating it as an ordinary Drink',
    (op) => {
      const state = drinkState(['toast']);
      state.rules.timing = { ...DEFAULT_RULES.timing };
      const id = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
      state.definitions[id] = cardDefinitionSchema.parse({
        ...state.definitions[id],
        effects: [
          op === 'FORCE_SIMULTANEOUS_DRINK'
            ? { op, targets: 'ALL_PLAYERS' }
            : { op },
        ],
      });
      let pending = send(state, 'TAKE_DRINK', {}, 0).state;
      pending = until(pending, (s) =>
        s.resolutionStack.some((frame) => frame.task?.kind === 'DRINK_BATCH'),
      );
      expect(pending.resolutionStack[0]!.kind).toBe('DRINK_EVENT');
      reconnectAndReplay(pending);
      expect(settle(pending).resolutionStack).toEqual([]);
    },
  );
  it('passes a Drink without changing its original revealer, then refreshes recipient legality', () => {
    const state = drinks();
    const pass = putCard(
      state,
      0,
      [{ op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
      { trigger: drinkTrigger },
    );
    let pending = send(state, 'TAKE_DRINK', {}, 0).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
    );
    const old = pending.control.timedPrompt!;
    reconnectAndReplay(pending);
    pending = play(
      pending,
      0,
      pass,
      state.players[1]!.id,
      old.openedAt + 100,
    ).state;
    pending = until(pending, (s) => s.resolutionStack.length === 1);
    expect(pending.resolutionStack[0]!.actorId).toBe(state.players[0]!.id);
    expect(pending.resolutionStack[0]!.drinkRecipientId).toBe(
      state.players[1]!.id,
    );
    expect(pending.control.timedPrompt!.promptId).not.toBe(old.promptId);
    const finished = settle(pending);
    expect(finished.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent,
    );
    expect(finished.players[1]!.alcoholContent).toBe(
      state.players[1]!.alcoholContent + 3,
    );
  });

  it('splits the combined Chaser total with ceil rounding into separately interruptible copies', () => {
    const state = drinks(['fizz']);
    const split = putCard(
      state,
      0,
      [{ op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' }],
      { trigger: drinkTrigger },
    );
    let pending = send(state, 'TAKE_DRINK', {}, 0).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
    );
    pending = play(pending, 0, split, state.players[1]!.id).state;
    pending = until(
      pending,
      (s) =>
        s.resolutionStack.at(-1)?.kind === 'DRINK' &&
        s.resolutionStack.length > 1,
    );
    reconnectAndReplay(pending);
    const finished = settle(pending);
    expect(finished.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent + 2,
    );
    expect(finished.players[1]!.alcoholContent).toBe(
      state.players[1]!.alcoholContent + 2,
    );
    expect(
      finished.innDrinkDiscard.filter(
        (id) => id === state.players[0]!.drinkPile[0],
      ).length,
    ).toBe(1);
  });

  it('converts Alcohol to Fortitude and directs subsequent Alcohol modifiers to Fortitude', () => {
    const state = drinks();
    const convert = putCard(
      state,
      0,
      [{ op: 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE' }],
      { trigger: drinkTrigger },
    );
    const modify = putCard(
      state,
      1,
      [
        {
          op: 'MODIFY_DRINK',
          alcoholDelta: 2,
          fortitudeDelta: 0,
          allowDrinkEvents: false,
        },
      ],
      { trigger: { event: 'DRINK', alternatives: [[]] } },
    );
    let pending = send(state, 'TAKE_DRINK', {}, 0).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
    );
    pending = play(pending, 0, convert).state;
    pending = until(
      pending,
      (s) =>
        s.resolutionStack.length === 1 &&
        s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, modify).state;
    const finished = settle(pending);
    expect(finished.players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent,
    );
    expect(finished.players[0]!.fortitude).toBe(
      state.players[0]!.fortitude + 5,
    );
  });

  it('queues a separate second Drink without revealing it before the first finishes', () => {
    const state = drinks(['fizz', 'tea']);
    const queue = putCard(
      state,
      1,
      [{ op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' }],
      {
        trigger: {
          event: 'DRINK',
          alternatives: [[{ kind: 'SOURCE_ACTOR', relation: 'OTHER' }]],
        },
      },
    );
    let pending = send(state, 'TAKE_DRINK', {}, 0).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, queue).state;
    pending = until(pending, (s) => s.resolutionStack.length === 1);
    const hidden = state.players[0]!.drinkPile[1]!;
    expect(JSON.stringify(projectPublicGame(pending))).not.toContain(hidden);
    expect(
      JSON.stringify(projectPrivatePlayer(pending, state.players[1]!.id)),
    ).not.toContain(hidden);
    reconnectAndReplay(pending);
    const finished = settle(pending);
    expect(finished.players[0]!.drinkPile).toEqual([]);
    expect(finished.innDrinkDiscard).toEqual(
      expect.arrayContaining(state.players[0]!.drinkPile),
    );
  });

  it('forces a chosen player to drink now using a separate response window', () => {
    const state = drinks();
    state.phase = 'ACTION';
    const force = putCard(
      state,
      1,
      [{ op: 'FORCE_DRINK', target: 'CHOSEN_PLAYER' }],
      { type: 'ANYTIME' },
    );
    let pending = play(state, 1, force, state.players[0]!.id).state;
    pending = until(pending, (s) => s.resolutionStack.at(-1)?.kind === 'DRINK');
    reconnectAndReplay(pending);
    expect(settle(pending).players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent + 3,
    );
  });

  it.each(['FORCE_SIMULTANEOUS_DRINK', 'ROUND_ON_HOUSE'] as const)(
    '%s creates independent copies with response windows after preparation',
    (op) => {
      const state = genericState();
      const batch = putCard(
        state,
        0,
        [op === 'ROUND_ON_HOUSE' ? { op } : { op, targets: 'ALL_PLAYERS' }],
        { type: 'ACTION' },
      );
      let pending = play(state, 0, batch).state;
      pending = until(
        pending,
        (s) => s.resolutionStack.at(-1)?.kind === 'DRINK',
      );
      const workflow = pending.resolutionStack.find(
        (f) => f.task?.kind === 'DRINK_BATCH',
      )!;
      expect(workflow.pendingDrinks).toHaveLength(3);
      if (op === 'ROUND_ON_HOUSE') {
        expect(workflow.heldDrinkCardIds!.length).toBeGreaterThan(0);
        expect(
          workflow.pendingDrinks!.every((w) => w.sourceCardIds.length === 0),
        ).toBe(true);
      }
      reconnectAndReplay(pending);
      const finished = settle(pending);
      expect(finished.resolutionStack).toEqual([]);
      expect(
        finished.players.every(
          (p) => p.alcoholContent >= state.players[p.seat]!.alcoholContent,
        ),
      ).toBe(true);
    },
  );

  it('applies generic traits to Drink values without character branches', () => {
    const state = drinks();
    const id = state.cards[state.players[0]!.drinkPile[0]!]!.definitionId;
    state.definitions[id] = cardDefinitionSchema.parse({
      ...state.definitions[id],
      traitReplacements: [
        { trait: 'ORC', alcoholContent: 7, fortitudeChange: 2 },
      ],
    });
    state.players[0]!.traits = ['ORC'];
    expect(
      settle(send(state, 'TAKE_DRINK', {}, 0).state).players[0],
    ).toMatchObject({
      alcoholContent: state.players[0]!.alcoholContent + 7,
      fortitude: state.players[0]!.fortitude + 2,
    });
  });

  it('uses source capabilities to counter Drink changes, never card titles', () => {
    const state = drinks();
    const modify = putCard(
      state,
      1,
      [
        {
          op: 'MODIFY_DRINK',
          alcoholDelta: 2,
          fortitudeDelta: 0,
          allowDrinkEvents: false,
        },
      ],
      { trigger: { event: 'DRINK', alternatives: [[]] } },
    );
    const counter = putCard(state, 2, [{ op: 'NEGATE', scope: 'TOP_STACK' }], {
      trigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'SOURCE_CAPABILITY',
              capabilities: ['CHANGES_DRINK_EFFECT'],
              match: 'ANY',
            },
          ],
        ],
      },
    });
    expect(legal(state, 2, counter)).toBeUndefined();
    let pending = send(state, 'TAKE_DRINK', {}, 0).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[1]!.id,
    );
    pending = play(pending, 1, modify).state;
    pending = until(
      pending,
      (s) => s.responseWindow?.priorityPlayerId === s.players[2]!.id,
    );
    pending = play(pending, 2, counter).state;
    expect(settle(pending).players[0]!.alcoholContent).toBe(
      state.players[0]!.alcoholContent + 3,
    );
  });
});
