import { expect, it } from 'vitest';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { DEFAULT_RULES } from '../../src/engine/rules';
import { synchronizePrompt } from '../../src/engine/timed-prompts';
import { assertCoreInvariants } from '../../src/engine/invariants';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { actionState, cardInHand } from '../fixtures/timing-match';
import { intent, mutable, started } from '../fixtures/core-match';
import type { CoreGameState } from '../../src/engine/types';

function current(state: CoreGameState) {
  const next = mutable(state);
  next.rules.timing = { ...DEFAULT_RULES.timing };
  return next;
}
function send(
  state: CoreGameState,
  type: string,
  fields: Record<string, unknown> = {},
  now = 1000,
) {
  const actorId =
    state.responseWindow?.priorityPlayerId ??
    state.control.phaseEnd?.priorityPlayerId ??
    state.activePlayerId!;
  const command = intent(state, type, fields);
  const result = applyCommand(state, command, {
    actorId,
    clock: { now: () => now },
  });
  expect(result.status).toBe('ACCEPTED');
  if (result.status !== 'ACCEPTED') throw new Error('Rejected test command');
  return { ...result, command, actorId };
}
function expiry(state: CoreGameState, now = 1000000) {
  return applyTimeout(state, {
    ...intent(state, 'EXPIRE_PROMPT'),
    promptId: state.control.timedPrompt!.promptId,
    now,
  });
}

it('the turn owner can retain a source response indefinitely, play a legal Sometimes, or explicitly pass', () => {
  const state = current(actionState());
  const pending = send(state, 'PLAY_CARD', {
    cardId: cardInHand(state, 0, 'shove'),
    targetPlayerId: 'player_1',
  }).state;
  const prompt = pending.control.timedPrompt!;
  expect(prompt.priorityPlayerId).toBe(pending.activePlayerId);
  expect(prompt.deadlineAt).toBeNull();
  expect(expiry(pending)).toMatchObject({
    status: 'REJECTED',
    code: 'WRONG_WINDOW',
    state: pending,
    events: [],
  });
  const own = projectPrivatePlayer(pending, pending.activePlayerId!);
  expect(own.responsePrompt?.hasLegalSometimes).toBe(true);
  const sometimes = own.legalPlays.find(
    (play) =>
      pending.definitions[pending.cards[play.cardId]!.definitionId]!.type ===
      'SOMETIMES',
  )!;
  expect(sometimes).toBeDefined();
  const played = send(
    pending,
    sometimes.commandType,
    {
      cardId: sometimes.cardId,
      responseWindowId: prompt.windowId,
      promptId: prompt.promptId,
      ...(sometimes.legalTargetPlayerIds.length
        ? { targetPlayerId: sometimes.legalTargetPlayerIds[0] }
        : {}),
    },
    1000000,
  ).state;
  expect(played.control.timedPrompt?.promptId).not.toBe(prompt.promptId);
  const passed = send(
    pending,
    'PASS_RESPONSE',
    { responseWindowId: prompt.windowId, promptId: prompt.promptId },
    1000000,
  ).state;
  const guest = passed.control.timedPrompt!;
  expect(guest.priorityPlayerId).not.toBe(passed.activePlayerId);
  expect(guest.deadlineAt).toBe(1030000);
  expect(expiry(passed, 1030000).status).toBe('ACCEPTED');
});

it('the owner can keep phase-end Anytime priority and play after 15 seconds, while guests still expire', () => {
  const state = send(current(started(1, 7)), 'DISCARD', { cardIds: [] }).state;
  const prompt = state.control.timedPrompt!;
  expect(prompt.kind).toBe('PHASE_END_ANYTIME');
  expect(prompt.deadlineAt).toBeNull();
  expect(expiry(state).status).toBe('REJECTED');
  const card = projectPrivatePlayer(state, state.activePlayerId!)
    .legalPlays[0]!;
  const played = send(
    state,
    card.commandType,
    { cardId: card.cardId, promptId: prompt.promptId },
    1000000,
  ).state;
  expect(played.phase).toBe('DISCARD_DRAW');
  expect(played.control.timedPrompt?.deadlineAt).toBeNull();
  const passed = send(
    state,
    'PASS_ANYTIME',
    { responseWindowId: prompt.windowId, promptId: prompt.promptId },
    1000000,
  ).state;
  expect(passed.phase).toBe('DISCARD_DRAW');
  expect(passed.control.timedPrompt!.deadlineAt).toBe(1015000);
  expect(expiry(passed, 1015000).status).toBe('ACCEPTED');
});

it('normal turn phases never acquire a deadline before the owner chooses their phase action', () => {
  const state = current(started(1, 7));
  synchronizePrompt(state, 1000, () => {});
  expect(state.control.timedPrompt).toBeNull();
  const later = send(state, 'DISCARD', { cardIds: [] }, 1000000).state;
  expect(later.phase).toBe('DISCARD_DRAW');
  expect(later.control.timedPrompt?.deadlineAt).toBeNull();
});

it('exemption follows the active player, not the host, source actor or responder', () => {
  const state = current(actionState());
  const pending = send(state, 'PLAY_CARD', {
    cardId: cardInHand(state, 0, 'shove'),
    targetPlayerId: 'player_1',
  }).state;
  const guest = send(pending, 'PASS_RESPONSE', {
    responseWindowId: pending.responseWindow!.id,
  }).state;
  const child = send(
    guest,
    'PLAY_RESPONSE',
    {
      responseWindowId: guest.responseWindow!.id,
      cardId: cardInHand(guest, 1, 'ignore'),
    },
    2000,
  ).state;
  expect(child.control.timedPrompt!.priorityPlayerId).toBe(
    child.players[1]!.id,
  );
  expect(child.control.timedPrompt!.deadlineAt).toBe(32000);
  let owner = child;
  for (
    let i = 0;
    i < 4 &&
    owner.control.timedPrompt?.priorityPlayerId !== owner.activePlayerId;
    i++
  )
    owner = send(
      owner,
      'PASS_RESPONSE',
      { responseWindowId: owner.responseWindow!.id },
      3000,
    ).state;
  expect(owner.control.timedPrompt!.priorityPlayerId).toBe(
    owner.activePlayerId,
  );
  expect(owner.control.timedPrompt!.deadlineAt).toBeNull();
  const nextTurn = current(actionState());
  nextTurn.activePlayerId = nextTurn.players[1]!.id;
  const nextOwner = send(nextTurn, 'PLAY_CARD', {
    cardId: cardInHand(nextTurn, 1, 'shove'),
    targetPlayerId: nextTurn.players[0]!.id,
  }).state;
  expect(nextOwner.control.timedPrompt!.priorityPlayerId).toBe(
    nextTurn.players[1]!.id,
  );
  expect(nextOwner.control.timedPrompt!.deadlineAt).toBeNull();
});

it('untimed identity, legal plays and deterministic events survive snapshot/replay', () => {
  const pending = send(current(started(1, 7)), 'DISCARD', {
    cardIds: [],
  }).state;
  const restored = coreStateSchema.parse(
    JSON.parse(JSON.stringify(pending)) as unknown,
  );
  expect(restored.control.timedPrompt).toEqual(pending.control.timedPrompt);
  const result = send(
    restored,
    'PASS_ANYTIME',
    { responseWindowId: restored.control.phaseEnd!.id },
    1000000,
  );
  expect(
    replayFromSnapshot(restored, 0, [
      {
        actorId: result.actorId,
        command: result.command,
        firstSequence: 1,
        lastSequence: result.events.length,
        events: result.events,
        acceptedAt: '2026-10-05T00:00:00.000Z',
        clockTime: 1000000,
      },
    ]).state,
  ).toEqual(result.state);
});

it('older pinned timing policies retain their deadlines and corrupt owner/guest deadline claims fail invariants', () => {
  const state = current(started(1, 7));
  delete state.rules.timing.turnOwnerUntimed;
  const historical = send(state, 'DISCARD', { cardIds: [] }).state;
  expect(historical.control.timedPrompt!.deadlineAt).toBe(16000);
  expect(expiry(historical, 16000).status).toBe('ACCEPTED');
  const owner = mutable(
    send(current(started(1, 7)), 'DISCARD', { cardIds: [] }).state,
  );
  owner.control.timedPrompt!.deadlineAt = 16000;
  expect(() => assertCoreInvariants(owner)).toThrow(
    'invalid turn-owner deadline',
  );
});
