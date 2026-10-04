import { describe, expect, it } from 'vitest';
import type { Effect } from '../../src/content/effects';
import { effectSchema } from '../../src/content/effects';
import { cardDefinitionSchema } from '../../src/content/cards';
import { applyCommand } from '../../src/engine/commands';
import { assertCoreInvariants } from '../../src/engine/invariants';
import {
  taskEvent,
  workflowTaskSchema,
  drinkWorkSchema,
} from '../../src/engine/workflow-state';
import { nextResolutionId } from '../../src/engine/resolution-ids';
import { playerIdSchema } from '../../src/shared/ids';
import { intent, mutable } from '../fixtures/core-match';
import { cardInHand } from '../fixtures/timing-match';
import { drinkState } from '../fixtures/drink-match';
import { DEFAULT_RULES } from '../../src/engine/rules';
import {
  genericState,
  putCard,
  play,
  legal,
  settle,
  send,
  until,
  systemTrigger,
  reconnectAndReplay,
} from '../fixtures/generic-match';

const scoped: Effect[] = [
  { op: 'ANTE_ALL_ACTIVE', amount: 1 },
  { op: 'FORCE_LEAVE_GAMBLING', target: 'CHOSEN_PLAYER' },
  { op: 'REPLACE_GAMBLING_WINNER', target: 'SELF' },
  { op: 'END_GAMBLING', potDestination: 'INN' },
  { op: 'TAKE_FROM_GAMBLING_POT', amount: 1 },
  { op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 },
  { op: 'CANCEL_CURRENT_ANTE_FOR_SELF' },
  { op: 'ORDER_EXTRA_DRINKS', count: 1 },
  { op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' },
  { op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
  { op: 'SPLIT_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
  { op: 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE' },
  { op: 'REDIRECT_FORTITUDE_LOSS', target: 'CHOSEN_PLAYER' },
  {
    op: 'CONTEXT_BRANCH',
    branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
  },
  {
    op: 'CHANGE_STAT',
    target: 'ORIGINAL_SOURCE_PLAYER',
    stat: 'FORTITUDE',
    delta: -2,
  },
];
describe('bounded generic contracts and shared legality', () => {
  it.each(scoped)('hides and rejects $op outside its opportunity', (effect) => {
    const state = genericState();
    const id = putCard(state, 1, [effect], { type: 'ANYTIME' });
    expect(legal(state, 1, id)).toBeUndefined();
    const command = intent(state, 'PLAY_CARD', {
      cardId: id,
      ...('target' in effect && effect.target === 'CHOSEN_PLAYER'
        ? { targetPlayerId: state.players[2]!.id }
        : {}),
    });
    expect(
      applyCommand(state, command, { actorId: state.players[1]!.id }).status,
    ).toBe('REJECTED');
  });
  it.each([
    { op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 2 },
    { op: 'ORDER_EXTRA_DRINKS', count: 9 },
    {
      op: 'CONTEXT_BRANCH',
      branches: ['IGNORE_CURRENT_DRINK', 'IGNORE_CURRENT_DRINK'],
    },
    {
      op: 'CONTEXT_BRANCH',
      branches: ['IGNORE_CURRENT_DRINK', 'IGNORE_DRINK_AND_PAY_INN_1'],
    },
    { op: 'FORCE_SIMULTANEOUS_DRINK', targets: 'EXECUTE_JS' },
  ])('rejects malformed data $op', (effect) => {
    expect(effectSchema.safeParse(effect).success).toBe(false);
  });
  it('requires family metadata for protected counters and Sometimes for phase opportunities', () => {
    const state = genericState();
    const definition =
      state.definitions[
        state.cards[cardInHand(state, 0, 'breather')]!.definitionId
      ]!;
    expect(
      cardDefinitionSchema.safeParse({
        ...definition,
        counterPolicy: 'SAME_FAMILY_ONLY',
      }).success,
    ).toBe(false);
    expect(
      cardDefinitionSchema.safeParse({
        ...definition,
        phaseOpportunity: 'ORDER_DRINK',
      }).success,
    ).toBe(false);
    expect(
      workflowTaskSchema.safeParse({
        kind: 'POST_LOSS',
        affected: 'player_1',
        amount: 0,
        originalPlayer: 'player_0',
        originalCard: null,
      }).success,
    ).toBe(false);
    expect(drinkWorkSchema.safeParse({}).success).toBe(false);
    expect(
      taskEvent({
        kind: 'SETTLEMENT',
        winner: state.players[0]!.id,
        toInn: true,
      }),
    ).toBeNull();
  });
  it('rejects resolution counter exhaustion without emitting a duplicate ID', () => {
    const state = genericState();
    state.control.resolutionOrdinal = Number.MAX_SAFE_INTEGER;
    expect(() => nextResolutionId(state)).toThrow('counter exhausted');
  });
  it.each([0, 1])(
    'full mandatory costs require available funds before Ignore (%i Gold)',
    (gold) => {
      const state = drinkState();
      state.rules.timing = { ...DEFAULT_RULES.timing };
      state.players[0]!.gold = gold;
      const cost = putCard(
        state,
        0,
        [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }],
        {
          mandatoryGoldCost: 1,
          trigger: {
            event: 'DRINK',
            alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
          },
        },
      );
      let pending = send(state, 'TAKE_DRINK', {}, 0).state;
      pending = until(
        pending,
        (s) => s.responseWindow?.priorityPlayerId === s.players[0]!.id,
      );
      expect(legal(pending, 0, cost) !== undefined).toBe(gold > 0);
      if (gold > 0) {
        pending = play(pending, 0, cost).state;
        const finished = settle(pending);
        expect(finished.players[0]!.gold).toBe(0);
        expect(finished.players[0]!.alcoholContent).toBe(
          state.players[0]!.alcoholContent,
        );
      } else
        expect(
          applyCommand(
            pending,
            intent(pending, 'PLAY_RESPONSE', {
              cardId: cost,
              responseWindowId: pending.responseWindow!.id,
            }),
            { actorId: state.players[0]!.id },
          ).status,
        ).toBe('REJECTED');
    },
  );
  it.each(['IGNORE_CURRENT_DRINK', 'IGNORE_DRINK_AND_PAY_INN_1'] as const)(
    'selects the %s multi-trigger branch for a Drink and cancels an ante before leaving',
    (branch) => {
      const state = genericState();
      const id = putCard(
        state,
        1,
        [{ op: 'CONTEXT_BRANCH', branches: ['CANCEL_ANTE_AND_LEAVE', branch] }],
        {
          trigger: {
            event: 'ANY',
            alternatives: [
              [
                { kind: 'SYSTEM_EVENT', events: ['ANTE_REQUIRED'] },
                {
                  kind: 'PAYMENT_CONTEXT',
                  payer: 'SELF',
                  purpose: 'ANTE',
                  minAmount: 1,
                },
              ],
              [
                { kind: 'SOURCE_KIND', kinds: ['DRINK'] },
                { kind: 'AFFECTS', relation: 'SELF' },
              ],
            ],
          },
        },
      );
      let pending = play(state, 0, cardInHand(state, 0, 'gamble')).state;
      pending = until(
        pending,
        (s) => s.resolutionStack.at(-1)?.task?.kind === 'PAYMENT',
      );
      reconnectAndReplay(pending);
      pending = play(pending, 1, id).state;
      const finished = settle(pending);
      expect(finished.players[1]!.gold).toBe(state.players[1]!.gold);
      expect(finished.gambling!.leftPlayerIds).toContain(state.players[1]!.id);
      expect(finished.gambling!.pot).toBe(3);
      const drinking = drinkState();
      drinking.phase = 'ACTION';
      drinking.rules.timing = { ...DEFAULT_RULES.timing };
      const ignore = putCard(
        drinking,
        0,
        [{ op: 'CONTEXT_BRANCH', branches: ['CANCEL_ANTE_AND_LEAVE', branch] }],
        {
          trigger: {
            event: 'DRINK',
            alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
          },
        },
      );
      const force = putCard(
        drinking,
        1,
        [{ op: 'FORCE_DRINK', target: 'CHOSEN_PLAYER' }],
        { type: 'ANYTIME' },
      );
      let drink = play(drinking, 1, force, drinking.players[0]!.id).state;
      drink = until(
        drink,
        (s) =>
          s.resolutionStack.at(-1)?.kind === 'DRINK' &&
          s.responseWindow?.priorityPlayerId === s.players[0]!.id,
      );
      drink = play(drink, 0, ignore).state;
      const ignored = settle(drink);
      expect(ignored.players[0]!.alcoholContent).toBe(
        drinking.players[0]!.alcoholContent,
      );
      expect(ignored.players[0]!.gold).toBe(
        drinking.players[0]!.gold - (branch === 'IGNORE_CURRENT_DRINK' ? 0 : 1),
      );
    },
  );
  it('uses collection in the reverse direction and permits validated living self targets', () => {
    const state = genericState();
    const collect = putCard(
      state,
      0,
      [{ op: 'COLLECT_GOLD', target: 'EACH_OTHER_PLAYER', amount: 1 }],
      { type: 'ANYTIME' },
    );
    expect(
      settle(play(state, 0, collect).state).players.map((p) => p.gold),
    ).toEqual([13, 9, 9, 9]);
    const self = putCard(
      state,
      1,
      [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: 2,
        },
      ],
      { type: 'ANYTIME', targetPolicy: 'ANY_LIVING_PLAYER' },
    );
    expect(legal(state, 1, self)?.legalTargetPlayerIds).toContain(
      state.players[1]!.id,
    );
    expect(
      settle(play(state, 1, self, state.players[1]!.id).state).players[1]!
        .fortitude,
    ).toBe(22);
  });
  it('rejects unknown serialized obligation players and provenance', () => {
    const state = genericState();
    putCard(state, 0, [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }], {
      trigger: systemTrigger('ANTE_REQUIRED'),
    });
    const pending = mutable(
      until(
        play(state, 0, cardInHand(state, 0, 'gamble')).state,
        (s) => s.resolutionStack.at(-1)?.task?.kind === 'PAYMENT',
      ),
    );
    const frame = pending.resolutionStack.at(-1)!;
    if (frame.task?.kind !== 'PAYMENT') throw new Error('Missing obligation');
    frame.task.payer = playerIdSchema.parse('player_unknown');
    expect(() => assertCoreInvariants(pending)).toThrow(
      'unknown workflow player',
    );
  });
});
