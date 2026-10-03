import type { EmitEvent } from './event-writer';
import type { MutableGameState } from './types';
import { changeGold } from './gold';
import { requireCommand } from './errors';

/** Stat operations complete their whole source before elimination is evaluated. */
export function changeStat(
  state: MutableGameState,
  player: MutableGameState['players'][number],
  stat: 'FORTITUDE' | 'ALCOHOL' | 'GOLD',
  delta: number,
  emit: EmitEvent,
) {
  if (stat === 'GOLD') {
    changeGold(state, player, delta, emit);
    return;
  }
  const field = stat === 'FORTITUDE' ? 'fortitude' : 'alcoholContent';
  const bounds = state.rules.statBounds[field];
  const min = BigInt(bounds?.min ?? -Number.MAX_SAFE_INTEGER);
  const max = BigInt(bounds?.max ?? Number.MAX_SAFE_INTEGER);
  const requested = BigInt(player[field]) + BigInt(delta);
  const value = Number(
    requested < min ? min : requested > max ? max : requested,
  );
  const actualDelta = value - player[field];
  requireCommand(Number.isSafeInteger(actualDelta), 'INVALID_EFFECT');
  const wasPassedOut = player.alcoholContent >= player.fortitude;
  player[field] = value;
  emit({
    type: stat === 'FORTITUDE' ? 'FORTITUDE_CHANGED' : 'ALCOHOL_CHANGED',
    playerId: player.id,
    delta: actualDelta,
    value,
  });
  state.control.eliminationCheckPending = true;
  if (!wasPassedOut && player.alcoholContent >= player.fortitude)
    emit({
      type: 'ELIMINATION_CHECK_REQUESTED',
      playerId: player.id,
      reason: 'PASSED_OUT',
    });
}
