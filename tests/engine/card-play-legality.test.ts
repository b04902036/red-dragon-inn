import { expect, it } from 'vitest';
import { legalCardPlays } from '../../src/engine/card-play-legality';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { synchronizePrompt } from '../../src/engine/timed-prompts';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { cardDefinitionSchema } from '../../src/content/cards';
import { playerIdSchema, resolutionIdSchema } from '../../src/shared/ids';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { accepted, intent, mutable, started } from '../fixtures/core-match';
import {
  actionState,
  cardInHand,
  playAction,
  priorityFor,
} from '../fixtures/timing-match';
import { gamblingPlay, startRound } from '../fixtures/gambling-match';
import { reversedPendingStat } from '../fixtures/legal-play-match';
it('normal Action plays are private, owned, and limited to the active Action phase', () => {
  const discard = started(1, 7);
  const action = actionState();
  const cardId = cardInHand(action, 0, 'shove');
  expect(
    legalCardPlays(discard, discard.players[0]!.id).map((p) => p.cardId),
  ).not.toContain(cardId);
  expect(legalCardPlays(action, action.players[0]!.id)).toContainEqual({
    cardId,
    commandType: 'PLAY_CARD',
    requiresTarget: true,
    legalTargetPlayerIds: ['player_1', 'player_2', 'player_3'],
  });
  expect(
    legalCardPlays(action, action.players[1]!.id).map((p) => p.cardId),
  ).not.toContain(cardInHand(action, 1, 'shove'));
  expect(
    legalCardPlays({ ...action, lifecycle: 'FINISHED' }, action.players[0]!.id),
  ).toEqual([]);
  const eliminated = mutable(action);
  eliminated.players[0]!.eliminated = true;
  expect(legalCardPlays(eliminated, eliminated.players[0]!.id)).toEqual([]);
  expect(
    legalCardPlays(action, playerIdSchema.parse('player_unknown')),
  ).toEqual([]);
});
it('Anytime remains legal out of turn during a normal phase, with exact effect/target validation', () => {
  const state = started(1, 7);
  const legal = legalCardPlays(state, state.players[2]!.id).find(
    (p) => p.cardId === cardInHand(state, 2, 'breather'),
  )!;
  expect(legal).toMatchObject({
    commandType: 'PLAY_CARD',
    requiresTarget: false,
  });
  expect(
    applyCommand(
      state,
      intent(state, legal.commandType, { cardId: legal.cardId }),
      { actorId: state.players[2]!.id },
    ).status,
  ).toBe('ACCEPTED');
});
it('only current priority receives relevant Sometimes plays; unrelated triggers and Action cards are absent', () => {
  const source = playAction().state;
  const first = projectPrivatePlayer(source, source.players[0]!.id);
  expect(first.legalPlays.map((p) => p.cardId)).not.toContain(
    cardInHand(source, 0, 'ignore'),
  );
  expect(
    projectPrivatePlayer(source, source.players[1]!.id).legalPlays,
  ).toEqual([]);
  const next = priorityFor(source, 1);
  expect(
    projectPrivatePlayer(next, next.players[1]!.id).legalPlays.map(
      (p) => p.cardId,
    ),
  ).toContain(cardInHand(next, 1, 'ignore'));
  expect(
    projectPrivatePlayer(next, next.players[1]!.id).legalPlays.map(
      (p) => p.cardId,
    ),
  ).not.toContain(cardInHand(next, 1, 'shove'));
});
it('a nested pending-effect change removes old legal cards and offers the newly matched response', () => {
  const { before, after, lossCardId, gainCardId } = reversedPendingStat();
  expect(
    projectPrivatePlayer(before, before.players[0]!.id).legalPlays.map(
      (p) => p.cardId,
    ),
  ).toContain(lossCardId);
  const current = projectPrivatePlayer(
    after,
    after.players[0]!.id,
  ).legalPlays.map((p) => p.cardId);
  expect(current).not.toContain(lossCardId);
  expect(current).toContain(gainCardId);
  expect(after.responseWindow!.id).not.toBe(before.responseWindow!.id);
  expect(
    applyCommand(
      after,
      intent(after, 'PLAY_RESPONSE', {
        cardId: lossCardId,
        responseWindowId: after.responseWindow!.id,
      }),
      { actorId: after.players[0]!.id },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'ILLEGAL_TIMING' });
});
it('gambling control categories and Winning-Hand-like restrictions use the accepted command validator', () => {
  const initial = startRound().state;
  const actor = initial.players.find(
    (p) => p.id === initial.gambling!.priorityPlayerId,
  )!;
  expect(legalCardPlays(initial, actor.id).map((p) => p.cardId)).toContain(
    cardInHand(initial, actor.seat, 'cheat'),
  );
  expect(legalCardPlays(initial, actor.id).map((p) => p.cardId)).toContain(
    cardInHand(initial, actor.seat, 'breather'),
  );
  const restricted = mutable(initial);
  restricted.gambling!.allowedControlCategories = ['GAMBLING'];
  expect(
    legalCardPlays(restricted, actor.id).map((p) => p.cardId),
  ).not.toContain(cardInHand(restricted, actor.seat, 'cheat'));
  expect(legalCardPlays(restricted, actor.id).map((p) => p.cardId)).toContain(
    cardInHand(restricted, actor.seat, 'gamble'),
  );
  expect(
    applyCommand(
      restricted,
      intent(restricted, 'GAMBLING_PLAY', {
        cardId: cardInHand(restricted, actor.seat, 'cheat'),
      }),
      { actorId: actor.id },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'CONTROL_RESTRICTED' });
  const winning = mutable(initial);
  const id =
    winning.cards[cardInHand(winning, actor.seat, 'gamble')]!.definitionId;
  winning.definitions[id] = cardDefinitionSchema.parse({
    ...winning.definitions[id],
    gambling: { immediateWin: true, allowedNextCategories: ['GAMBLING'] },
  });
  expect(
    legalCardPlays(winning, actor.id).some(
      (p) => p.cardId === cardInHand(winning, actor.seat, 'gamble'),
    ),
  ).toBe(true);
  expect(
    gamblingPlay(winning, actor.seat, 'gamble').state.resolutionStack.length,
  ).toBeGreaterThan(1);
});
it('target-restricted Action exposes only valid targets and every listed target is accepted', () => {
  const state = actionState();
  for (const player of state.players)
    player.special.resources.tokens = { value: 0, visibility: 'PUBLIC' };
  delete state.players[2]!.special.resources.tokens;
  const cardId = cardInHand(state, 0, 'shove');
  state.definitions[state.cards[cardId]!.definitionId]!.effects = [
    {
      op: 'CUSTOM',
      effect_key: 'core.adjust-resource',
      target: 'CHOSEN_PLAYER',
      params: { resource: 'tokens', delta: 1 },
    },
  ];
  const before = JSON.stringify(state);
  const play = legalCardPlays(state, state.players[0]!.id).find(
    (p) => p.cardId === cardId,
  )!;
  expect(play.legalTargetPlayerIds).toEqual(['player_1', 'player_3']);
  expect(JSON.stringify(state)).toBe(before);
  for (const targetPlayerId of play.legalTargetPlayerIds)
    expect(
      applyCommand(
        state,
        intent(state, 'PLAY_CARD', { cardId, targetPlayerId }),
        { actorId: state.players[0]!.id },
      ).status,
    ).toBe('ACCEPTED');
  expect(
    applyCommand(
      state,
      intent(state, 'PLAY_CARD', { cardId, targetPlayerId: 'player_2' }),
      { actorId: state.players[0]!.id },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'INVALID_EFFECT' });
});
it('invalid root effects never appear as playable, and valid Gambling initiation includes its automatic effects', () => {
  const state = actionState();
  const cardId = cardInHand(state, 0, 'shove');
  state.definitions[state.cards[cardId]!.definitionId]!.effects = [
    { op: 'NEGATE', scope: 'TOP_STACK' },
  ];
  expect(
    legalCardPlays(state, state.players[0]!.id).some(
      (p) => p.cardId === cardId,
    ),
  ).toBe(false);
  expect(
    legalCardPlays(state, state.players[0]!.id).some(
      (p) => p.cardId === cardInHand(state, 0, 'gamble'),
    ),
  ).toBe(true);
});
it('automatic Gambling effects respect the shared effect limit and exhausted response capacity offers no play', () => {
  const state = actionState();
  const gamble = cardInHand(state, 0, 'gamble');
  state.definitions[state.cards[gamble]!.definitionId]!.effects = Array.from(
    { length: 32 },
    () => ({ op: 'DRAW_CARDS' as const, target: 'SELF' as const, count: 1 }),
  );
  expect(
    legalCardPlays(state, state.players[0]!.id).some(
      (p) => p.cardId === gamble,
    ),
  ).toBe(false);
  expect(
    applyCommand(state, intent(state, 'PLAY_CARD', { cardId: gamble }), {
      actorId: state.players[0]!.id,
    }),
  ).toMatchObject({ status: 'REJECTED', code: 'INVALID_EFFECT' });
  const response = mutable(playAction().state);
  const history = Array.from({ length: 256 }, (_, index) =>
    resolutionIdSchema.parse(`resolution_record_${index}`),
  );
  response.responseWindow!.submittedResponses = history;
  response.resolutionStack.at(-1)!.window!.submittedResponses = history;
  assertCoreInvariants(response);
  expect(
    legalCardPlays(response, response.responseWindow!.priorityPlayerId!),
  ).toEqual([]);
  const actor = response.players.find(
    (p) => p.id === response.responseWindow!.priorityPlayerId,
  )!;
  expect(
    applyCommand(
      response,
      intent(response, 'PLAY_RESPONSE', {
        cardId: cardInHand(response, actor.seat, 'breather'),
        responseWindowId: response.responseWindow!.id,
      }),
      { actorId: actor.id },
    ),
  ).toMatchObject({
    status: 'REJECTED',
    code: 'STACK_LIMIT',
    state: response,
    events: [],
  });
});
it('private legal plays never appear in public state or in another player’s private projection', () => {
  const state = actionState();
  const a = projectPrivatePlayer(state, state.players[0]!.id),
    b = projectPrivatePlayer(state, state.players[1]!.id);
  const publicJson = JSON.stringify(projectPublicGame(state));
  expect(publicJson).not.toMatch(
    /legalPlays|legalPlayVersion|legalTargetPlayerIds/,
  );
  for (const play of a.legalPlays) {
    expect(publicJson).not.toContain(play.cardId);
    expect(JSON.stringify(b)).not.toContain(play.cardId);
  }
  expect(a.legalPlayVersion).toBe(state.version);
  expect(
    projectPrivatePlayer(
      JSON.parse(JSON.stringify(state)) as typeof state,
      state.players[0]!.id,
    ),
  ).toEqual(a);
});
it('expiry removes the old priority’s private legal plays and re-evaluates the next holder', () => {
  const state = mutable(playAction().state);
  state.rules.timing = { ...DEFAULT_RULES.timing };
  synchronizePrompt(state, 1000, () => {});
  const first = state.control.timedPrompt!;
  const old = projectPrivatePlayer(state, first.priorityPlayerId);
  expect(old.legalPlays.every((p) => p.promptId === first.promptId)).toBe(true);
  const result = applyTimeout(state, {
    ...intent(state, 'EXPIRE_PROMPT'),
    promptId: first.promptId,
    now: first.deadlineAt,
  });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('expiry rejected');
  expect(
    projectPrivatePlayer(result.state, first.priorityPlayerId).legalPlays,
  ).toEqual([]);
  expect(
    projectPrivatePlayer(
      result.state,
      result.state.control.timedPrompt!.priorityPlayerId,
    ).legalPlays.length,
  ).toBeGreaterThan(0);
});
it('phase-end only offers the current holder’s Anytime and cannot be bypassed by a submitted legal list', () => {
  const state = mutable(started(1, 7));
  state.rules.timing = { ...DEFAULT_RULES.timing };
  const next = accepted(state, 'DISCARD', { cardIds: [] }).state;
  const playerId = next.control.timedPrompt!.priorityPlayerId;
  const legal = projectPrivatePlayer(next, playerId).legalPlays;
  expect(legal).toHaveLength(1);
  expect(legal[0]!.cardId).toBe(cardInHand(next, 0, 'breather'));
  expect(projectPrivatePlayer(next, next.players[1]!.id).legalPlays).toEqual(
    [],
  );
  expect(
    applyCommand(
      next,
      intent(next, 'PLAY_CARD', {
        cardId: cardInHand(next, 0, 'shove'),
        targetPlayerId: 'player_1',
        legalPlays: legal,
      }),
      { actorId: playerId },
    ),
  ).toMatchObject({ status: 'REJECTED', code: 'INVALID_COMMAND' });
});
