import type { PlayerId } from '../shared/ids';
import type { MutableFrame } from './effect-operations';
import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import { requireCommand } from './errors';
import { changeGold, goldFloor, payGold } from './gold';

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
  for (const contribution of plan.contributions) {
    payGold(
      state,
      state.players.find((player) => player.id === contribution.playerId)!,
      contribution.amount,
      emit,
    );
    emit({
      type: 'GAMBLING_ANTE_PAID',
      playerId: contribution.playerId,
      amount: contribution.amount,
    });
  }
  const controller = state.rules.gambling.initiatorControls
    ? frame.actorId!
    : clockwisePlayers(state, frame.actorId!).find((id) =>
        participants.includes(id),
      )!;
  state.gambling = {
    stage: 'ROUND',
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
    pot: plan.pot,
    anteAmount: state.rules.gambling.anteAmount,
    contributions: plan.contributions,
    controlSourceCardId: frame.sourceCardId,
    allowedControlCategories: ['GAMBLING', 'CHEATING'],
    winnerPlayerId: null,
    suspended: {
      resolutionId: frame.id,
      activePlayerId: state.activePlayerId!,
      phase: state.phase!,
    },
  };
  state.gambling.priorityPlayerId = nextPlayer(state, controller);
  const definition =
    state.definitions[state.cards[frame.sourceCardId!]!.definitionId]!;
  if (definition.type === 'GAMBLING' || definition.type === 'CHEATING')
    state.gambling.allowedControlCategories = definition.gambling
      ?.allowedNextCategories ?? ['GAMBLING', 'CHEATING'];
  emit({
    type: 'GAMBLING_STARTED',
    initiatorPlayerId: frame.actorId!,
    controlPlayerId: controller,
    participants,
    excludedPlayerIds: state.gambling.excludedPlayerIds,
    anteAmount: state.gambling.anteAmount,
    pot: plan.pot,
    resolutionId: frame.id,
  });
  emitPriority(state, emit);
  if (
    (definition.type === 'GAMBLING' || definition.type === 'CHEATING') &&
    definition.gambling?.immediateWin
  )
    requestImmediateWin(state, frame, emit);
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
/** Settle only after all response children finish; clear escrow before crediting the winner. */
export function settleGambling(
  state: MutableGameState,
  emit: EmitEvent,
): boolean {
  const round = state.gambling!;
  if (
    round.stage !== 'SETTLING' &&
    activeGamblers(state).some(
      (id) =>
        id !== round.controlPlayerId && !round.passedPlayerIds.includes(id),
    )
  )
    return false;
  const winnerPlayerId = round.winnerPlayerId ?? round.controlPlayerId;
  const winner = state.players.find((player) => player.id === winnerPlayerId)!;
  const pot = round.pot;
  state.gambling = null;
  changeGold(state, winner, pot, emit);
  emit({
    type: 'GAMBLING_FINISHED',
    winnerPlayerId,
    pot,
    reason: round.stage === 'SETTLING' ? 'IMMEDIATE_WIN' : 'ALL_PASSED',
  });
  return true;
}
