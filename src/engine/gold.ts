import type { EmitEvent } from './event-writer';
import type { MutableGameState } from './types';
import { requireCommand } from './errors';
type Player = MutableGameState['players'][number];
export function goldFloor(state: MutableGameState) {
  return Math.max(0, state.rules.statBounds.gold?.min ?? 0);
}
export function goldCeiling(state: MutableGameState, player: Player) {
  const max = state.rules.statBounds.gold?.max ?? Number.MAX_SAFE_INTEGER;
  const round = state.gambling;
  return (
    max -
    (round !== null &&
    round.participants.includes(player.id) &&
    !round.leftPlayerIds.includes(player.id)
      ? round.pot
      : 0)
  );
}
/** All post-setup Gold changes flow through this event-emitting ledger. */
export function changeGold(
  state: MutableGameState,
  player: Player,
  delta: number,
  emit: EmitEvent,
) {
  requireCommand(Number.isSafeInteger(delta), 'INVALID_EFFECT');
  const requested = BigInt(player.gold) + BigInt(delta);
  const min = BigInt(goldFloor(state));
  const max = BigInt(goldCeiling(state, player));
  const value = Number(
    requested < min ? min : requested > max ? max : requested,
  );
  const previous = player.gold;
  player.gold = value;
  emit({
    type: 'GOLD_CHANGED',
    playerId: player.id,
    delta: value - previous,
    value,
  });
  if (previous > 0 && value === 0) {
    state.control.eliminationCheckPending = true;
    emit({
      type: 'ELIMINATION_CHECK_REQUESTED',
      playerId: player.id,
      reason: 'BROKE',
    });
  }
}
export function payGold(
  state: MutableGameState,
  player: Player,
  amount: number,
  emit: EmitEvent,
) {
  const paid = Math.min(amount, player.gold - goldFloor(state));
  changeGold(state, player, -paid, emit);
  return paid;
}
export function transferGold(
  state: MutableGameState,
  from: Player,
  to: Player,
  amount: number,
  emit: EmitEvent,
) {
  const paid = Math.min(
    amount,
    from.gold - goldFloor(state),
    goldCeiling(state, to) - to.gold,
  );
  changeGold(state, from, -paid, emit);
  changeGold(state, to, paid, emit);
}
