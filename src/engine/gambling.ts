import type { PlayerId } from '../shared/ids';
import type { MutableFrame } from './effect-operations';
import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import { requireCommand } from './errors';
import { goldFloor } from './gold';

export function activeGamblers(state: MutableGameState) {
  const round = state.gambling!;
  return round.participants.filter((id) => !round.leftPlayerIds.includes(id));
}
function clockwisePlayers(state: MutableGameState, after: PlayerId) {
  const ordered = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.id);
  const index = ordered.indexOf(after);
  return [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)];
}
function nextPlayer(state: MutableGameState, after: PlayerId) {
  return (
    clockwisePlayers(state, after).find(
      (id) =>
        activeGamblers(state).includes(id) &&
        !state.gambling!.passedPlayerIds.includes(id) &&
        id !== state.gambling!.controlPlayerId,
    ) ?? null
  );
}
function roundPlan(
  state: MutableGameState,
  actorId: PlayerId,
):
  | { code: 'NOT_ELIGIBLE' | 'GOLD_CAPACITY' }
  | { contributions: { playerId: PlayerId; amount: number }[]; pot: number } {
  const rules = state.rules.gambling;
  const contributions = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .filter((player) => !player.eliminated)
    .map((player) => ({
      playerId: player.id,
      amount:
        rules.insufficientGold === 'PAY_AVAILABLE'
          ? Math.min(rules.anteAmount, player.gold - goldFloor(state))
          : player.gold - goldFloor(state) >= rules.anteAmount
            ? rules.anteAmount
            : 0,
    }))
    .filter((entry) => entry.amount > 0);
  if (!contributions.some((entry) => entry.playerId === actorId))
    return { code: 'NOT_ELIGIBLE' as const };
  const pot = contributions.reduce((sum, entry) => sum + entry.amount, 0);
  const max = state.rules.statBounds.gold?.max ?? Number.MAX_SAFE_INTEGER;
  if (
    contributions.some(
      (entry) =>
        state.players.find((player) => player.id === entry.playerId)!.gold -
          entry.amount +
          pot >
        max,
    )
  )
    return { code: 'GOLD_CAPACITY' as const };
  return { contributions, pot };
}
export function validateGamblingStart(
  state: MutableGameState,
  frame: MutableFrame,
) {
  requireCommand(
    state.gambling === null &&
      frame.parentId === null &&
      frame.actorId !== null &&
      frame.actorId === state.activePlayerId &&
      state.phase === 'ACTION',
    'ILLEGAL_TIMING',
  );
  const plan = roundPlan(state, frame.actorId);
  if ('code' in plan) requireCommand(false, plan.code);
}
export function startGambling(
  state: MutableGameState,
  frame: MutableFrame,
  emit: EmitEvent,
) {
  const plan = roundPlan(state, frame.actorId!);
  if ('code' in plan) {
    // Replies may change Gold after source acceptance. Abort without charging anyone.
    emit({
      type: 'GAMBLING_START_CANCELED',
      resolutionId: frame.id,
      reason: plan.code,
    });
    return;
  }
  const participants = plan.contributions.map((entry) => entry.playerId);
  const controller = state.rules.gambling.initiatorControls
    ? frame.actorId!
    : clockwisePlayers(state, frame.actorId!).find((id) =>
        participants.includes(id),
      )!;
  state.gambling = {
    stage: 'ANTE',
    initiatorPlayerId: frame.actorId!,
    priorityPlayerId: null,
    controlPlayerId: controller,
    participants,
    passedPlayerIds: [],
    leftPlayerIds: [],
    excludedPlayerIds: state.players
      .filter(
        (player) => !player.eliminated && !participants.includes(player.id),
      )
      .map((player) => player.id),
    pot: 0,
    anteAmount: state.rules.gambling.anteAmount,
    contributions: plan.contributions.map((c) => ({ ...c, amount: 0 })),
    controlSourceCardId: frame.sourceCardId,
    allowedControlCategories: ['GAMBLING', 'CHEATING'],
    winnerPlayerId: null,
    suspended: {
      resolutionId: frame.id,
      activePlayerId: state.activePlayerId!,
      phase: state.phase!,
    },
  };
  state.gambling.checkpointReady = false;
  const definition =
    state.definitions[state.cards[frame.sourceCardId!]!.definitionId]!;
  if (definition.type === 'GAMBLING' || definition.type === 'CHEATING')
    state.gambling.allowedControlCategories = definition.gambling
      ?.allowedNextCategories ?? ['GAMBLING', 'CHEATING'];
  frame.pendingTasks = [
    ...plan.contributions.map((c) => ({
      kind: 'PAYMENT' as const,
      purpose: 'ANTE' as const,
      payer: c.playerId,
      amount: c.amount,
      substituted: 0,
      canceled: false,
      destination: 'POT' as const,
      recipient: null,
      full: false,
    })),
    { kind: 'GAMBLING_READY' },
  ];
}
export function finishGamblingAntes(state: MutableGameState, emit: EmitEvent) {
  const round = state.gambling!;
  round.stage = 'ROUND';
  round.priorityPlayerId = nextPlayer(state, round.controlPlayerId);
  emit({
    type: 'GAMBLING_STARTED',
    initiatorPlayerId: round.initiatorPlayerId,
    controlPlayerId: round.controlPlayerId,
    participants: round.participants,
    excludedPlayerIds: round.excludedPlayerIds,
    anteAmount: round.anteAmount,
    pot: round.pot,
    resolutionId: round.suspended.resolutionId,
  });
  emitPriority(state, emit);
  const definition =
    state.definitions[
      state.cards[state.resolutionStack[0]!.sourceCardId!]!.definitionId
    ]!;
  if (
    (definition.type === 'GAMBLING' || definition.type === 'CHEATING') &&
    definition.gambling?.immediateWin &&
    !round.restarted
  )
    requestImmediateWin(state, state.resolutionStack[0]!, emit);
}
function emitPriority(state: MutableGameState, emit: EmitEvent) {
  emit({
    type: 'GAMBLING_PRIORITY_CHANGED',
    priorityPlayerId: state.gambling!.priorityPlayerId,
  });
}
export function takeGamblingControl(
  state: MutableGameState,
  frame: MutableFrame,
  categories: ('GAMBLING' | 'CHEATING')[],
  emit: EmitEvent,
) {
  requireCommand(
    state.gambling !== null && activeGamblers(state).includes(frame.actorId!),
    'NOT_ELIGIBLE',
  );
  const round = state.gambling;
  round.controlPlayerId = frame.actorId!;
  round.passedPlayerIds = [];
  round.controlSourceCardId = frame.sourceCardId;
  round.allowedControlCategories = categories;
  emit({
    type: 'GAMBLING_CONTROL_CHANGED',
    playerId: frame.actorId!,
    cardId: frame.sourceCardId,
    allowedControlCategories: categories,
  });
  advanceGamblingPriority(state, frame.actorId!, emit);
}
export function requestImmediateWin(
  state: MutableGameState,
  frame: MutableFrame,
  emit: EmitEvent,
) {
  requireCommand(
    state.gambling !== null && activeGamblers(state).includes(frame.actorId!),
    'NOT_ELIGIBLE',
  );
  state.gambling.stage = 'SETTLING';
  state.gambling.winnerPlayerId = frame.actorId!;
  emit({
    type: 'GAMBLING_WIN_REQUESTED',
    playerId: frame.actorId!,
    resolutionId: frame.id,
  });
}
export function leaveGambling(
  state: MutableGameState,
  actorId: PlayerId,
  emit: EmitEvent,
) {
  requireCommand(
    state.gambling !== null && activeGamblers(state).includes(actorId),
    'NOT_ELIGIBLE',
  );
  requireCommand(state.rules.gambling.allowLeave, 'LEAVE_NOT_ALLOWED');
  if (activeGamblers(state).length === 1) {
    emit({ type: 'GAMBLING_LEAVE_SKIPPED', playerId: actorId });
    return;
  }
  state.gambling.leftPlayerIds.push(actorId);
  state.gambling.passedPlayerIds = state.gambling.passedPlayerIds.filter(
    (id) => id !== actorId,
  );
  for (const frame of state.resolutionStack)
    if (
      frame.actorId === actorId &&
      frame.effects.some((effect) => effect.op === 'TAKE_GAMBLING_CONTROL')
    )
      frame.canceled = true;
  emit({ type: 'GAMBLING_PLAYER_LEFT', playerId: actorId });
  if (state.gambling.controlPlayerId === actorId) {
    const controller = clockwisePlayers(state, actorId).find((id) =>
      activeGamblers(state).includes(id),
    )!;
    state.gambling.controlPlayerId = controller;
    state.gambling.passedPlayerIds = [];
    state.gambling.controlSourceCardId = null;
    state.gambling.allowedControlCategories = ['GAMBLING', 'CHEATING'];
    emit({
      type: 'GAMBLING_CONTROL_CHANGED',
      playerId: controller,
      cardId: null,
      allowedControlCategories: state.gambling.allowedControlCategories,
    });
  }
  advanceGamblingPriority(state, actorId, emit);
}
export function advanceGamblingPriority(
  state: MutableGameState,
  actorId: PlayerId,
  emit: EmitEvent,
) {
  state.gambling!.priorityPlayerId = nextPlayer(state, actorId);
  state.gambling!.checkpointReady = false;
  emitPriority(state, emit);
}
export function passGambling(
  state: MutableGameState,
  actorId: PlayerId,
  emit: EmitEvent,
) {
  state.gambling!.passedPlayerIds.push(actorId);
  emit({ type: 'GAMBLING_PASSED', playerId: actorId });
  advanceGamblingPriority(state, actorId, emit);
}
