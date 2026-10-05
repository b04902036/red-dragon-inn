import { z } from 'zod';
import { publicGamblingViewSchema } from '../protocol/views';
import { playerIdSchema, resolutionIdSchema } from '../shared/ids';
import { TURN_PHASES } from './model';
import type { CoreGameState } from './types';

export const gamblingStateSchema = publicGamblingViewSchema.extend({
  checkpointReady: z.boolean().optional(),
  settlementReady: z.boolean().optional(),
  settlementReason: z.enum(['ALL_PASSED', 'IMMEDIATE_WIN']).optional(),
  potRemoved: z.number().int().nonnegative().safe().optional(),
  suspended: z.strictObject({
    resolutionId: resolutionIdSchema,
    activePlayerId: playerIdSchema,
    phase: z.enum(TURN_PHASES),
  }),
});
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(`Engine invariant: ${message}`);
}
export function assertGamblingState(state: CoreGameState) {
  z.boolean().parse(state.control.eliminationCheckPending);
  const deferred = z
    .array(playerIdSchema)
    .max(4)
    .optional()
    .parse(state.control.deferredContestPassOutPlayerIds);
  assert(
    deferred === undefined ||
      (new Set(deferred).size === deferred.length &&
        deferred.every((id) =>
          state.players.some((player) => player.id === id),
        )),
    'invalid deferred pass-out',
  );
  if (state.gambling === null) return;
  const round = gamblingStateSchema.parse(state.gambling);
  const lists = [
    round.participants,
    round.passedPlayerIds,
    round.leftPlayerIds,
    round.excludedPlayerIds,
  ];
  assert(
    lists.every((list) => new Set(list).size === list.length),
    'duplicate gambler',
  );
  const living = state.players
    .filter((player) => !player.eliminated)
    .map((player) => player.id);
  assert(
    round.participants.length > 0 &&
      [...round.participants, ...round.excludedPlayerIds].every((id) =>
        living.includes(id),
      ),
    'unknown gambler',
  );
  assert(
    round.participants.includes(round.initiatorPlayerId),
    'unknown initiator',
  );
  assert(
    round.participants.length + round.excludedPlayerIds.length ===
      living.length &&
      round.excludedPlayerIds.every((id) => !round.participants.includes(id)),
    'invalid excluded gamblers',
  );
  assert(
    [...round.passedPlayerIds, ...round.leftPlayerIds].every((id) =>
      round.participants.includes(id),
    ) && round.passedPlayerIds.every((id) => !round.leftPlayerIds.includes(id)),
    'invalid departed gambler',
  );
  const active = round.participants.filter(
    (id) => !round.leftPlayerIds.includes(id),
  );
  assert(
    active.includes(round.controlPlayerId) &&
      !round.passedPlayerIds.includes(round.controlPlayerId),
    'controller left round',
  );
  assert(
    round.stage === 'SETTLING'
      ? round.winnerPlayerId !== null && living.includes(round.winnerPlayerId)
      : round.winnerPlayerId === null,
    'invalid gambling winner',
  );
  assert(
    round.stage === 'ANTE' || round.priorityPlayerId === null
      ? round.stage === 'ANTE' ||
          active.every(
            (id) =>
              id === round.controlPlayerId ||
              round.passedPlayerIds.includes(id),
          )
      : active.includes(round.priorityPlayerId) &&
          !round.passedPlayerIds.includes(round.priorityPlayerId) &&
          round.priorityPlayerId !== round.controlPlayerId,
    'invalid gambling priority',
  );
  assert(
    round.anteAmount === state.rules.gambling.anteAmount &&
      round.contributions.length === round.participants.length &&
      new Set(round.contributions.map((entry) => entry.playerId)).size ===
        round.contributions.length &&
      round.contributions.every(
        (entry) =>
          round.participants.includes(entry.playerId) && entry.amount >= 0,
      ),
    'invalid antes',
  );
  assert(
    round.pot ===
      round.contributions.reduce((sum, entry) => sum + entry.amount, 0) -
        (round.potRemoved ?? 0),
    'pot differs from antes',
  );
  assert(
    round.allowedControlCategories.length ===
      new Set(round.allowedControlCategories).size,
    'duplicate control category',
  );
  assert(
    round.controlSourceCardId === null ||
      state.cards[round.controlSourceCardId] !== undefined,
    'unknown control source',
  );
  assert(
    state.activePlayerId === round.suspended.activePlayerId &&
      state.phase === round.suspended.phase &&
      state.resolutionStack[0]?.id === round.suspended.resolutionId &&
      state.resolutionStack[0].stage === 'OPERATIONS',
    'invalid gambling suspension',
  );
  const max = state.rules.statBounds.gold?.max ?? Number.MAX_SAFE_INTEGER;
  assert(
    active.every(
      (id) =>
        state.players.find((player) => player.id === id)!.gold <=
        max - round.pot,
    ),
    'payout exceeds Gold capacity',
  );
}
