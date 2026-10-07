import type { MutableGameState } from './types';

/** Refill obligations are server-owned and resolved through the payment stack. */
export function queueRefillPayments(state: MutableGameState) {
  state.control.pendingRefillPayers ??= [];
  for (const player of [...state.players].sort((a, b) => a.seat - b.seat))
    if (
      !player.eliminated &&
      !state.control.deferredContestPassOutPlayerIds?.includes(player.id)
    )
      state.control.pendingRefillPayers.push(player.id);
}
