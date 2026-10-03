import { describe, expect, it } from 'vitest';
import { cardDefinitionSchema } from '../../src/content/cards';
import { responseTriggerSchema } from '../../src/content/reaction-triggers';
import type { ReactionCondition } from '../../src/content/reaction-triggers';
import {
  legalResponsesForPlayer,
  reactionContext,
  triggerMatches,
  timingOrder,
} from '../../src/engine/reaction-legality';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { applyCommand } from '../../src/engine/commands';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { accepted, intent, mutable } from '../fixtures/core-match';
import {
  actionState,
  cardInHand,
  pass,
  passWindow,
  playAction,
  response,
} from '../fixtures/timing-match';
import { startRound, gamblingPlay } from '../fixtures/gambling-match';
import { drinkState } from '../fixtures/drink-match';

function removeResponses(
  state: ReturnType<typeof actionState>,
  seats: number[],
) {
  for (const seat of seats) {
    const player = state.players[seat]!;
    for (const id of [...player.hand]) {
      if (
        !['ANYTIME', 'SOMETIMES'].includes(
          state.definitions[state.cards[id]!.definitionId]!.type,
        )
      )
        continue;
      player.hand.splice(player.hand.indexOf(id), 1);
      player.characterDiscard.push(id);
      state.cards[id]!.location = {
        zone: 'CHARACTER_DISCARD',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
    }
  }
}
describe('authoritative response opportunities', () => {
  it('starts with the source actor, then living seats, skipping empty private hands', () => {
    const source = actionState();
    removeResponses(source, [1]);
    source.players[2]!.eliminated = true;
    const queued = playAction(source).state;
    expect(timingOrder(queued, queued.players[0]!.id)).toEqual([
      'player_0',
      'player_1',
      'player_3',
    ]);
    expect(queued.responseWindow!.eligiblePlayerIds).toEqual([
      'player_0',
      'player_3',
    ]);
    expect(queued.responseWindow!.priorityPlayerId).toBe('player_0');
    expect(pass(queued).state.responseWindow!.priorityPlayerId).toBe(
      'player_3',
    );
    expect(projectPublicGame(queued).responseWindow!.eligiblePlayerIds).toEqual(
      ['player_0', 'player_1', 'player_3'],
    );
  });
  it('resolves immediately when nobody has any legal response, without fabricated passes', () => {
    const source = actionState();
    removeResponses(source, [0, 1, 2, 3]);
    const result = playAction(source);
    expect(result.state.responseWindow).toBeNull();
    expect(result.state.phase).toBe('ORDER_DRINK');
    expect(result.state.players[1]!.fortitude).toBe(18);
    expect(
      result.events.some(
        (event) =>
          event.type === 'RESPONSE_PASSED' ||
          event.type === 'RESPONSE_WINDOW_OPENED',
      ),
    ).toBe(false);
  });
  it('uses the exact same legal cards and targets for private projection and command validation', () => {
    const state = playAction().state;
    const actor = state.responseWindow!.priorityPlayerId!;
    const legal = legalResponsesForPlayer(
      state,
      actor,
      reactionContext(state, state.resolutionStack[0]!),
    );
    expect(projectPrivatePlayer(state, actor).legalResponses).toEqual(legal);
    for (const play of legal) {
      const result = applyCommand(
        state,
        intent(state, 'PLAY_RESPONSE', {
          cardId: play.cardId,
          responseWindowId: state.responseWindow!.id,
          ...(play.requiresTarget
            ? { targetPlayerId: play.legalTargetPlayerIds[0] }
            : {}),
        }),
        { actorId: actor },
      );
      expect(result.status).toBe('ACCEPTED');
    }
    expect(projectPublicGame(state)).not.toHaveProperty('legalResponses');
    expect(
      projectPrivatePlayer(state, state.players[1]!.id).legalResponses,
    ).toEqual([]);
  });
  it('rejects an unrelated Sometimes and an unspecified ordinary Sometimes despite an open window', () => {
    const source = actionState();
    const id = source.cards[cardInHand(source, 0, 'breather')]!.definitionId;
    for (const trigger of [
      undefined,
      { event: 'DRINK' as const, alternatives: [[]] },
    ]) {
      source.definitions[id] = cardDefinitionSchema.parse({
        ...source.definitions[id],
        type: 'SOMETIMES',
        responseKind: 'SOMETIMES',
        responseTrigger: trigger,
      });
      const state = playAction(source).state;
      expect(
        applyCommand(
          state,
          intent(state, 'PLAY_RESPONSE', {
            cardId: cardInHand(state, 0, 'breather'),
            responseWindowId: state.responseWindow!.id,
          }),
          { actorId: state.players[0]!.id },
        ),
      ).toMatchObject({ status: 'REJECTED', code: 'ILLEGAL_TIMING' });
    }
  });
  it('re-evaluates modified parent effects, resets passes, restarts at the original actor and replaces old legality', () => {
    const source = actionState();
    removeResponses(source, [2, 3]);
    const ignoreId =
      source.cards[cardInHand(source, 0, 'ignore')]!.definitionId;
    const negateId =
      source.cards[cardInHand(source, 0, 'negate')]!.definitionId;
    const breatherId =
      source.cards[cardInHand(source, 0, 'breather')]!.definitionId;
    for (const [id, direction] of [
      [ignoreId, 'LOSS'],
      [negateId, 'GAIN'],
    ] as const) {
      source.definitions[id] = cardDefinitionSchema.parse({
        ...source.definitions[id],
        responseKind: 'SOMETIMES',
        responseTrigger: {
          event: 'CARD',
          alternatives: [
            [
              {
                kind: 'PENDING_STAT',
                stat: 'FORTITUDE',
                direction,
                relation: 'ANY',
              },
            ],
          ],
        },
        effects: [{ op: 'DRAW_CARDS', target: 'SELF', count: 1 }],
      });
    }
    source.definitions[breatherId] = cardDefinitionSchema.parse({
      ...source.definitions[breatherId],
      type: 'SOMETIMES',
      responseKind: 'SOMETIMES',
      responseTrigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'PENDING_STAT',
              stat: 'FORTITUDE',
              direction: 'LOSS',
              relation: 'SELF',
            },
          ],
        ],
      },
      effects: [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 4 }],
    });
    const root = playAction(source).state;
    const oldWindow = root.responseWindow!.id;
    const oldCard = cardInHand(root, 0, 'ignore');
    const next = response(root, 1, 'breather');
    const state = next.state;
    expect(next.events).toContainEqual(
      expect.objectContaining({
        type: 'RESOLUTION_STARTED',
        parentId: root.resolutionStack[0]!.id,
      }),
    );
    expect(state.resolutionStack).toHaveLength(1);
    expect(state.responseWindow!.id).not.toBe(oldWindow);
    expect(state.responseWindow!.passedPlayerIds).toEqual([]);
    expect(state.responseWindow!.priorityPlayerId).toBe('player_0');
    const legal = projectPrivatePlayer(
      state,
      state.players[0]!.id,
    ).legalResponses;
    expect(legal.map((play) => play.cardId)).not.toContain(oldCard);
    expect(legal.map((play) => play.cardId)).toContain(
      cardInHand(state, 0, 'negate'),
    );
    expect(
      applyCommand(
        state,
        intent(state, 'PLAY_RESPONSE', {
          cardId: oldCard,
          responseWindowId: state.responseWindow!.id,
        }),
        { actorId: state.players[0]!.id },
      ),
    ).toMatchObject({ status: 'REJECTED', code: 'ILLEGAL_TIMING' });
    const snapshot = JSON.parse(JSON.stringify(state)) as typeof state;
    assertCoreInvariants(snapshot);
    expect(passWindow(snapshot)).toEqual(passWindow(state));
  });
});

describe('validated predicate families', () => {
  const conditions: ReactionCondition[] = [
    { kind: 'SOURCE_ACTOR', relation: 'OTHER' },
    { kind: 'AFFECTS', relation: 'SELF' },
    { kind: 'SOURCE_TYPE', types: ['ACTION'] },
    { kind: 'SOURCE_KIND', kinds: ['CARD'] },
    { kind: 'NEGATABLE', value: true },
    { kind: 'PENDING_OPERATION', operations: ['CHANGE_STAT'] },
    {
      kind: 'PENDING_STAT',
      stat: 'FORTITUDE',
      direction: 'LOSS',
      relation: 'SELF',
    },
    { kind: 'TARGET_COUNT', min: 1, max: 1 },
    { kind: 'PHASE', phases: ['ACTION'] },
    { kind: 'LIFECYCLE', lifecycles: ['PLAYING'] },
    { kind: 'NESTING', relation: 'ROOT' },
    { kind: 'PLAYER_STAT', stat: 'FORTITUDE', comparison: 'EQ', value: 20 },
  ];
  it.each(conditions)('evaluates %j from authoritative facts', (condition) => {
    const state = playAction().state;
    const context = reactionContext(state, state.resolutionStack[0]!);
    expect(
      triggerMatches(
        state,
        state.players[1]!.id,
        context,
        responseTriggerSchema.parse({
          event: 'CARD',
          alternatives: [[condition]],
        }),
      ),
    ).toBe(true);
    expect(
      triggerMatches(
        state,
        state.players[1]!.id,
        context,
        responseTriggerSchema.parse({
          event: 'DRINK',
          alternatives: [[condition]],
        }),
      ),
    ).toBe(false);
  });
  it('validates predicates strictly, including bounds and executable/unknown input', () => {
    for (const trigger of [
      { event: 'CARD', alternatives: [] },
      { event: 'NOPE', alternatives: [[]] },
      {
        event: 'CARD',
        alternatives: [[{ kind: 'CODE', code: 'return true' }]],
      },
      {
        event: 'CARD',
        alternatives: [[{ kind: 'TARGET_COUNT', min: 3, max: 1 }]],
      },
      {
        event: 'CARD',
        alternatives: [
          [{ kind: 'PENDING_OPERATION', operations: ['unknown'] }],
        ],
      },
    ])
      expect(responseTriggerSchema.safeParse(trigger).success).toBe(false);
  });
  it('relevant triggers are accepted as Sometimes while a changed phase/player stat invalidates them', () => {
    const source = actionState();
    const id = source.cards[cardInHand(source, 0, 'breather')]!.definitionId;
    source.definitions[id] = cardDefinitionSchema.parse({
      ...source.definitions[id],
      type: 'SOMETIMES',
      responseKind: 'SOMETIMES',
      responseTrigger: {
        event: 'CARD',
        alternatives: [
          [
            { kind: 'SOURCE_ACTOR', relation: 'SELF' },
            {
              kind: 'PLAYER_STAT',
              stat: 'FORTITUDE',
              comparison: 'LTE',
              value: 20,
            },
          ],
        ],
      },
    });
    const state = playAction(source).state;
    expect(
      accepted(state, 'PLAY_RESPONSE', {
        cardId: cardInHand(state, 0, 'breather'),
        responseWindowId: state.responseWindow!.id,
      }).status,
    ).toBe('ACCEPTED');
    const copy = mutable(state);
    copy.players[0]!.fortitude = 21;
    expect(
      legalResponsesForPlayer(
        copy,
        copy.players[0]!.id,
        reactionContext(copy, copy.resolutionStack[0]!),
      ).map((play) => play.cardId),
    ).not.toContain(cardInHand(copy, 0, 'breather'));
  });
  it.each(['LT', 'LTE', 'EQ', 'GTE', 'GT'] as const)(
    'evaluates current player stats with %s, independent of cached source facts',
    (comparison) => {
      const state = playAction().state;
      const context = reactionContext(state, state.resolutionStack[0]!);
      for (const stat of ['FORTITUDE', 'ALCOHOL', 'GOLD'] as const) {
        const actual = stat === 'FORTITUDE' ? 20 : stat === 'GOLD' ? 10 : 0;
        const value =
          comparison === 'LT' || comparison === 'LTE'
            ? actual + 1
            : comparison === 'GT' || comparison === 'GTE'
              ? actual - 1
              : actual;
        const condition = {
          kind: 'PLAYER_STAT' as const,
          stat,
          comparison,
          value,
        };
        expect(
          triggerMatches(state, state.players[0]!.id, context, {
            event: 'ANY',
            alternatives: [[condition]],
          }),
        ).toBe(true);
        expect(
          triggerMatches(state, state.players[0]!.id, context, {
            event: 'ANY',
            alternatives: [
              [
                {
                  ...condition,
                  value:
                    comparison === 'LT' || comparison === 'LTE'
                      ? actual - 1
                      : actual + 1,
                },
              ],
            ],
          }),
        ).toBe(false);
      }
    },
  );
  it.each([
    'ACTIVE',
    'ROUND',
    'SETTLING',
    'CONTROL',
    'PARTICIPANT',
    'CHEATING_ALLOWED',
  ] as const)('evaluates gambling fact %s against the live round', (fact) => {
    const state = mutable(gamblingPlay(startRound().state, 1, 'gamble').state);
    const context = reactionContext(state, state.resolutionStack.at(-1)!);
    if (fact === 'SETTLING') state.gambling!.stage = 'SETTLING';
    const actor = state.players[0]!.id;
    const trigger = {
      event: 'ANY' as const,
      alternatives: [[{ kind: 'GAMBLING' as const, fact }]],
    };
    expect(triggerMatches(state, actor, context, trigger)).toBe(true);
    if (fact === 'CONTROL')
      state.gambling!.controlPlayerId = state.players[1]!.id;
    else if (fact === 'PARTICIPANT') state.gambling!.leftPlayerIds.push(actor);
    else if (fact === 'CHEATING_ALLOWED')
      state.gambling!.allowedControlCategories = ['GAMBLING'];
    else if (fact === 'ROUND') state.gambling!.stage = 'SETTLING';
    else if (fact === 'SETTLING') state.gambling!.stage = 'ROUND';
    else state.gambling = null;
    expect(triggerMatches(state, actor, context, trigger)).toBe(false);
    state.gambling = null;
    expect(triggerMatches(state, actor, context, trigger)).toBe(false);
  });
  it('derives pending payments, actor receipts, multi-target scope, Drink and gain opportunities, and ignores executed/ignored operations', () => {
    const source = actionState([
      { op: 'TRANSFER_GOLD', target: 'CHOSEN_PLAYER', amount: 2 },
      { op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 3 },
      { op: 'CHANGE_STAT', target: 'ALL_PLAYERS', stat: 'ALCOHOL', delta: 1 },
    ]);
    const state = mutable(playAction(source).state);
    const frame = state.resolutionStack[0]!;
    const context = reactionContext(state, frame);
    expect(context.affectedPlayerIds).toHaveLength(4);
    expect(context.pendingStatDeltas).toContainEqual({
      playerId: state.players[0]!.id,
      stat: 'GOLD',
      delta: -2,
    });
    expect(context.pendingStatDeltas).toContainEqual({
      playerId: state.players[1]!.id,
      stat: 'GOLD',
      delta: 2,
    });
    expect(context.pendingStatDeltas).toContainEqual({
      playerId: state.players[1]!.id,
      stat: 'GOLD',
      delta: -3,
    });
    expect(
      triggerMatches(state, state.players[0]!.id, context, {
        event: 'ANY',
        alternatives: [
          [
            { kind: 'AFFECTS', relation: 'OTHER' },
            {
              kind: 'PENDING_STAT',
              stat: 'ALCOHOL',
              direction: 'GAIN',
              relation: 'ANY',
            },
          ],
        ],
      }),
    ).toBe(true);
    frame.nextEffectIndex = 2;
    frame.ignoredPlayerIds = [state.players[0]!.id];
    expect(
      reactionContext(state, frame).pendingStatDeltas.some(
        (delta) =>
          delta.stat === 'GOLD' || delta.playerId === state.players[0]!.id,
      ),
    ).toBe(false);
    frame.canceled = true;
    expect(reactionContext(state, frame).pendingOperations).toEqual([]);
    const drink = accepted(drinkState(['fizz']), 'TAKE_DRINK').state;
    const drinkContext = reactionContext(drink, drink.resolutionStack[0]!);
    expect(
      triggerMatches(drink, drink.players[0]!.id, drinkContext, {
        event: 'DRINK',
        alternatives: [
          [
            {
              kind: 'PENDING_STAT',
              stat: 'ALCOHOL',
              direction: 'ANY',
              relation: 'SELF',
            },
          ],
        ],
      }),
    ).toBe(true);
    expect(drinkContext.negatable).toBe(false);
  });
  it('rejects wrong actors/types/phases/lifecycles/nesting/operations and recognizes alternatives', () => {
    const state = playAction().state;
    const context = reactionContext(state, state.resolutionStack[0]!);
    const falseConditions: ReactionCondition[] = [
      { kind: 'SOURCE_ACTOR', relation: 'SELF' },
      { kind: 'SOURCE_TYPE', types: ['CHEATING'] },
      { kind: 'SOURCE_KIND', kinds: ['DRINK_EVENT'] },
      { kind: 'AFFECTS', relation: 'OTHER' },
      { kind: 'NEGATABLE', value: false },
      { kind: 'PENDING_OPERATION', operations: ['DRAW_CARDS'] },
      {
        kind: 'PENDING_STAT',
        stat: 'GOLD',
        direction: 'LOSS',
        relation: 'OTHER',
      },
      { kind: 'TARGET_COUNT', min: 2, max: 4 },
      { kind: 'PHASE', phases: ['DRINK'] },
      { kind: 'LIFECYCLE', lifecycles: ['LOBBY'] },
      { kind: 'NESTING', relation: 'CHILD' },
    ];
    for (const condition of falseConditions)
      expect(
        triggerMatches(state, state.players[1]!.id, context, {
          event: 'ANY',
          alternatives: [[condition]],
        }),
      ).toBe(false);
    expect(
      triggerMatches(state, state.players[1]!.id, context, {
        event: 'ANY',
        alternatives: [
          [falseConditions[0]!],
          [{ kind: 'SOURCE_ACTOR', relation: 'ANY' }],
        ],
      }),
    ).toBe(true);
    const nested = response(state, 1, 'ignore').state;
    expect(
      triggerMatches(
        nested,
        nested.players[0]!.id,
        reactionContext(nested, nested.resolutionStack.at(-1)!),
        {
          event: 'CARD',
          alternatives: [
            [
              { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
              { kind: 'NESTING', relation: 'CHILD' },
            ],
          ],
        },
      ),
    ).toBe(true);
  });
  it('filters invalid effects and targets without mutating authoritative state', () => {
    const state = mutable(playAction().state);
    for (const player of state.players)
      player.special.resources.tokens = { value: 0, visibility: 'PUBLIC' };
    const actor = state.players[0]!.id;
    const id = state.cards[cardInHand(state, 0, 'breather')]!.definitionId;
    state.definitions[id] = cardDefinitionSchema.parse({
      ...state.definitions[id],
      effects: [
        {
          op: 'CUSTOM',
          target: 'CHOSEN_PLAYER',
          effect_key: 'core.adjust-resource',
          params: { resource: 'tokens', delta: 1 },
        },
      ],
    });
    delete state.players[2]!.special.resources.tokens;
    const before = JSON.stringify(state);
    const legal = legalResponsesForPlayer(
      state,
      actor,
      reactionContext(state, state.resolutionStack[0]!),
    ).find((play) => play.cardId === cardInHand(state, 0, 'breather'))!;
    expect(legal.requiresTarget).toBe(true);
    expect(legal.legalTargetPlayerIds).toEqual(['player_1', 'player_3']);
    expect(JSON.stringify(state)).toBe(before);
    state.definitions[id]!.effects = [
      { op: 'MODIFY_PENDING_EFFECT', effectIndex: 20, delta: 1 },
    ];
    expect(
      legalResponsesForPlayer(
        state,
        actor,
        reactionContext(state, state.resolutionStack[0]!),
      ).map((play) => play.cardId),
    ).not.toContain(cardInHand(state, 0, 'breather'));
    const definition =
      state.definitions[
        state.cards[state.resolutionStack[0]!.sourceCardId!]!.definitionId
      ]!;
    definition.negatable = false;
    expect(
      legalResponsesForPlayer(
        state,
        actor,
        reactionContext(state, state.resolutionStack[0]!),
      ).map((play) => play.cardId),
    ).not.toContain(cardInHand(state, 0, 'negate'));
    expect(
      legalResponsesForPlayer(
        { ...state, lifecycle: 'FINISHED' },
        actor,
        reactionContext(state, state.resolutionStack[0]!),
      ),
    ).toEqual([]);
    state.players[0]!.eliminated = true;
    expect(
      legalResponsesForPlayer(
        state,
        actor,
        reactionContext(state, state.resolutionStack[0]!),
      ),
    ).toEqual([]);
  });
});
