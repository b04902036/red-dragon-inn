import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import { changeGold, goldFloor } from './gold';
import { requireCommand } from './errors';

/** Simultaneous eligibility is frozen before redistribution; dying players cannot rescue each other. */
export function checkEliminations(
  state: MutableGameState,
  emit: EmitEvent,
  workflowCheckpoint = false,
) {
  if (
    state.lifecycle !== 'PLAYING' ||
    state.gambling !== null ||
    (!workflowCheckpoint &&
      (state.control.phaseEnd !== null ||
        state.resolutionStack.length > 0 ||
        state.responseWindow !== null))
  )
    return;
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const living = ordered.filter((player) => !player.eliminated);
  const victims = living.filter(
    (player) =>
      player.alcoholContent >= player.fortitude ||
      player.gold === 0 ||
      state.control.deferredContestPassOutPlayerIds?.includes(player.id),
  );
  const survivors = living.filter((player) => !victims.includes(player));
  if (
    state.control.eliminationCheckPending ||
    victims.length > 0 ||
    state.phase === 'ELIMINATION_CHECK'
  )
    emit({
      type: 'ELIMINATION_CHECKED',
      playerIds: victims.map((player) => player.id),
    });
  state.control.eliminationCheckPending = false;
  for (const player of victims) {
    const passedOut =
      player.alcoholContent >= player.fortitude ||
      state.control.deferredContestPassOutPlayerIds?.includes(player.id);
    player.eliminated = true;
    emit({
      type: 'PLAYER_ELIMINATED',
      playerId: player.id,
      reason: passedOut ? 'PASSED_OUT' : 'BROKE',
    });
    if (!passedOut) continue;
    const amount = player.gold - goldFloor(state);
    changeGold(state, player, -amount, emit);
    const pool =
      state.rules.elimination.passOutGold === 'ALL_TO_INN'
        ? 0
        : state.rules.elimination.innShareRounding === 'UP'
          ? Math.floor(amount / 2)
          : Math.ceil(amount / 2);
    const share =
      survivors.length === 0 ? 0 : Math.floor(pool / survivors.length);
    const payments = survivors.map((recipient) => {
      const previous = recipient.gold;
      changeGold(state, recipient, share, emit);
      return { playerId: recipient.id, amount: recipient.gold - previous };
    });
    emit({
      type: 'GOLD_REDISTRIBUTED',
      playerId: player.id,
      amount,
      innGold:
        amount - payments.reduce((sum, payment) => sum + payment.amount, 0),
      payments,
    });
  }
  state.control.eliminationCheckPending = false;
  delete state.control.deferredContestPassOutPlayerIds;
  if (survivors.length <= 1) {
    state.winners = survivors.map((player) => player.id);
    state.lifecycle = 'FINISHED';
    state.phase = null;
    state.activePlayerId = null;
    emit({ type: 'LIFECYCLE_CHANGED', lifecycle: 'FINISHED' });
    emit({ type: 'MATCH_FINISHED', winnerIds: state.winners });
  } else if (victims.some((player) => player.id === state.activePlayerId)) {
    requireCommand(
      state.control.turnNumber < Number.MAX_SAFE_INTEGER,
      'TURN_LIMIT',
    );
    const index = ordered.findIndex(
      (player) => player.id === state.activePlayerId,
    );
    const next = [
      ...ordered.slice(index + 1),
      ...ordered.slice(0, index + 1),
    ].find((player) => !player.eliminated)!;
    state.activePlayerId = next.id;
    state.phase = 'DISCARD_DRAW';
    state.control.turnNumber += 1;
    emit({
      type: 'TURN_STARTED',
      playerId: next.id,
      turnNumber: state.control.turnNumber,
    });
    emit({
      type: 'PHASE_CHANGED',
      phase: 'DISCARD_DRAW',
      activePlayerId: next.id,
    });
  }
}
