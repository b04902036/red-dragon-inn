import { z } from 'zod';
import { playerIdSchema, responseWindowIdSchema } from '../shared/ids';
import type { PlayerId } from '../shared/ids';
import type { CoreGameState, MutableGameState } from './types';
import type { TurnPhase, ResolutionFrame } from './model';
import type { EmitEvent } from './event-writer';
import {
  legalResponsesForPlayer,
  reactionContext,
  timingOrder,
} from './reaction-legality';
import { requireCommand } from './errors';
import { matchNamespace } from './identity';
import { TURN_PHASES } from './model';

export interface Clock {
  now(): number;
}
export const timedPromptSchema = z
  .strictObject({
    promptId: z.string().min(1).max(128),
    kind: z.enum(['RESPONSE_DECISION', 'PHASE_END_ANYTIME']),
    windowId: responseWindowIdSchema,
    priorityPlayerId: playerIdSchema,
    openedAt: z.number().int().nonnegative().safe(),
    deadlineAt: z.number().int().nonnegative().safe().nullable(),
  })
  .refine((p) => p.deadlineAt === null || p.deadlineAt >= p.openedAt);
export type TimedPrompt = z.infer<typeof timedPromptSchema>;
export interface PhaseEndWindow {
  id: z.infer<typeof responseWindowIdSchema>;
  phase: TurnPhase;
  nextPhase: TurnPhase;
  origin: PlayerId;
  passedPlayerIds: PlayerId[];
  priorityPlayerId: PlayerId | null;
}
export const phaseEndSchema = z.strictObject({
  id: responseWindowIdSchema,
  phase: z.enum(['DISCARD_DRAW', 'ACTION', 'ORDER_DRINK', 'DRINK']),
  nextPhase: z.enum(TURN_PHASES),
  origin: playerIdSchema,
  passedPlayerIds: z
    .array(playerIdSchema)
    .max(4)
    .refine((ids) => new Set(ids).size === ids.length),
  priorityPlayerId: playerIdSchema.nullable(),
});

/** No pending source exists here: parent-dependent effects cannot be phase-end plays. */
export function legalAnytimeCards(state: CoreGameState, playerId: PlayerId) {
  const frame: ResolutionFrame = {
    id: 'resolution_phase_end' as ResolutionFrame['id'],
    kind: 'SYSTEM',
    actorId: state.activePlayerId,
    sourceCardId: null,
    sourceRevealed: false,
    targetPlayerIds: [],
    effects: [],
    nextEffectIndex: 0,
    parentId: null,
    stage: 'OPERATIONS',
    canceled: false,
    ignoredPlayerIds: [],
    window: null,
    continuation: 'RESUME',
    selectedOptionId: null,
  };
  return legalResponsesForPlayer(
    state,
    playerId,
    reactionContext(state, frame),
  ).filter(
    (c) =>
      state.definitions[state.cards[c.cardId]!.definitionId]!.type ===
      'ANYTIME',
  );
}
export function completePhase(
  state: MutableGameState,
  nextPhase: TurnPhase,
  emit: EmitEvent,
) {
  requireCommand(
    state.phase !== null && state.activePlayerId !== null,
    'WRONG_PHASE',
  );
  const phaseSometimes =
    state.phase === 'ORDER_DRINK' &&
    nextPhase === 'DRINK' &&
    state.players
      .find((p) => p.id === state.activePlayerId)!
      .hand.some(
        (id) =>
          state.definitions[state.cards[id]!.definitionId]!.phaseOpportunity ===
          'ORDER_DRINK',
      );
  if (state.rules.timing.phaseEndMs === 0 && !phaseSometimes) {
    state.phase = nextPhase;
    state.control.normalOrderDone = false;
    emit({
      type: 'PHASE_CHANGED',
      phase: nextPhase,
      activePlayerId: state.activePlayerId,
    });
    return;
  }
  const id = responseWindowIdSchema.parse(
    `window_grace_${state.version}_${state.phase}`,
  );
  state.control.phaseEnd = {
    id,
    phase: state.phase,
    nextPhase,
    origin: state.activePlayerId,
    passedPlayerIds: [],
    priorityPlayerId: null,
  };
  emit({ type: 'PHASE_END_WINDOW_OPENED', windowId: id, phase: state.phase });
}
export function passAnytime(
  state: MutableGameState,
  actorId: PlayerId,
  windowId: string,
  emit: EmitEvent,
) {
  const grace = state.control.phaseEnd;
  requireCommand(grace !== null && grace.id === windowId, 'WRONG_WINDOW');
  requireCommand(
    state.resolutionStack.length === 0 && grace.priorityPlayerId === actorId,
    'NOT_PRIORITY',
  );
  grace.passedPlayerIds.push(actorId);
  grace.priorityPlayerId = null;
  state.control.timedPrompt = null;
  emit({ type: 'ANYTIME_PASSED', windowId: grace.id, playerId: actorId });
}
/** Called after every accepted mutation, with one injected clock reading per transaction. */
export function synchronizePrompt(
  state: MutableGameState,
  now: number,
  emit: EmitEvent,
) {
  z.number().int().nonnegative().safe().parse(now);
  let windowId: TimedPrompt['windowId'] | null = null;
  let playerId: PlayerId | null = null;
  let kind: TimedPrompt['kind'] = 'RESPONSE_DECISION';
  const response = state.responseWindow;
  if (
    response !== null &&
    response.pendingChoice === null &&
    state.rules.timing.responseMs > 0
  ) {
    windowId = response.id;
    playerId = response.priorityPlayerId;
  } else if (
    state.resolutionStack.length === 0 &&
    state.control.phaseEnd !== null
  ) {
    const grace = state.control.phaseEnd;
    playerId =
      state.rules.timing.phaseEndMs === 0
        ? null
        : (timingOrder(state, grace.origin).find(
            (id) =>
              !grace.passedPlayerIds.includes(id) &&
              legalAnytimeCards(state, id).length > 0,
          ) ?? null);
    grace.priorityPlayerId = playerId;
    if (playerId === null) {
      state.phase = grace.nextPhase;
      state.control.normalOrderDone = false;
      state.control.phaseEnd = null;
      emit({ type: 'PHASE_END_WINDOW_CLOSED', windowId: grace.id });
      emit({
        type: 'PHASE_CHANGED',
        phase: state.phase,
        activePlayerId: state.activePlayerId!,
      });
    } else {
      windowId = grace.id;
      kind = 'PHASE_END_ANYTIME';
    }
  }
  if (windowId === null || playerId === null || state.lifecycle !== 'PLAYING') {
    state.control.timedPrompt = null;
    return;
  }
  const previous = state.control.timedPrompt;
  if (
    previous?.windowId === windowId &&
    previous.priorityPlayerId === playerId &&
    previous.kind === kind
  )
    return;
  const prompt = timedPromptSchema.parse({
    promptId: `prompt_${matchNamespace(state.matchId)}_${state.version}`,
    kind,
    windowId,
    priorityPlayerId: playerId,
    openedAt: now,
    deadlineAt:
      state.rules.timing.turnOwnerUntimed === true &&
      playerId === state.activePlayerId
        ? null
        : now +
          (kind === 'RESPONSE_DECISION'
            ? state.rules.timing.responseMs
            : state.rules.timing.phaseEndMs),
  });
  state.control.timedPrompt = prompt;
  emit({ type: 'TIMED_PROMPT_OPENED', ...prompt });
}
