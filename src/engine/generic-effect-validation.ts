import type { MutableGameState } from './types';
import type { MutableFrame } from './effect-operations';
import { requireCommand } from './errors';
import { activeGamblers } from './gambling';
import { goldFloor } from './gold';
import type { WorkflowTask } from './workflow-state';
import { pendingSelfLosses, selfMitigationLocked } from './fortitude-routing';

function validateAnteCapacity(
  state: MutableGameState,
  current: WorkflowTask | undefined,
  action: 'SUBSTITUTE' | 'CANCEL' | 'RAISE',
  amount = 0,
  leaving?: string,
) {
  const round = state.gambling!;
  const tasks = state.resolutionStack.flatMap((frame) => [
    ...(frame.task === undefined ? [] : [frame.task]),
    ...(frame.pendingTasks ?? []),
  ]);
  if (current !== undefined && !tasks.includes(current)) tasks.push(current);
  const gold = new Map(state.players.map((player) => [player.id, player.gold]));
  let pot = BigInt(round.pot);
  const payments = tasks.filter(
    (task): task is Extract<WorkflowTask, { kind: 'PAYMENT' }> =>
      task.kind === 'PAYMENT' && task.destination === 'POT' && !task.canceled,
  );
  if (action === 'RAISE')
    for (const id of activeGamblers(state))
      payments.push({
        kind: 'PAYMENT',
        payer: id,
        amount,
        purpose: 'ANTE',
        destination: 'POT',
        recipient: null,
        substituted: 0,
        full: false,
        canceled: false,
      });
  for (const task of payments) {
    if (task === current && action === 'CANCEL') continue;
    const substituted =
      task === current && action === 'SUBSTITUTE' ? amount : task.substituted;
    const paid = Math.min(
      task.amount - substituted,
      gold.get(task.payer)! - goldFloor(state),
    );
    gold.set(task.payer, gold.get(task.payer)! - paid);
    pot += BigInt(paid + substituted);
  }
  const max = BigInt(
    state.rules.statBounds.gold?.max ?? Number.MAX_SAFE_INTEGER,
  );
  requireCommand(
    activeGamblers(state)
      .filter((id) => id !== leaving)
      .every((id) => BigInt(gold.get(id)!) + pot <= max),
    'GOLD_CAPACITY',
  );
}

export function validateGenericEffects(
  state: MutableGameState,
  frame: MutableFrame,
  parent: MutableFrame | undefined,
) {
  const actor = state.players.find((p) => p.id === frame.actorId)!;
  requireCommand(!selfMitigationLocked(parent, frame), 'ILLEGAL_TIMING');
  const definition =
    frame.sourceCardId === null
      ? undefined
      : state.definitions[state.cards[frame.sourceCardId]!.definitionId];
  const cost = definition?.mandatoryGoldCost ?? 0;
  if (
    definition?.effects.some(
      (effect) =>
        effect.op === 'REDIRECT_FORTITUDE_LOSS' &&
        effect.twoPlayerIgnoreFallback,
    ) &&
    state.players.filter((p) => !p.eliminated).length === 2
  ) {
    const source =
      parent?.sourceCardId === null || parent?.sourceCardId === undefined
        ? undefined
        : state.definitions[state.cards[parent.sourceCardId]!.definitionId];
    requireCommand(
      parent?.kind === 'CARD' &&
        source !== undefined &&
        ['ACTION', 'SOMETIMES', 'ANYTIME'].includes(source.type),
      'ILLEGAL_TIMING',
    );
  }
  requireCommand(
    actor === undefined || actor.gold - goldFloor(state) >= cost,
    'NOT_ELIGIBLE',
  );
  const expanded =
    frame.effects.length +
    frame.effects.reduce(
      (count, effect) =>
        count +
        (effect.op === 'ORDER_EXTRA_DRINKS'
          ? 2 * effect.count
          : effect.op === 'ORDER_EXTRA_OR_WAIVE_REFILL'
            ? 1 + 2 * effect.count
            : effect.op === 'OPTIONAL_DRINK_CHALLENGE'
              ? 2
              : effect.op === 'CONTEXT_BRANCH' &&
                  effect.branches.includes('IGNORE_DRINK_AND_PAY_INN_1')
                ? 1
                : 0),
      0,
    );
  requireCommand(expanded <= 32, 'INVALID_EFFECT');
  for (const effect of frame.effects) {
    if (
      effect.op === 'PAY_INN' &&
      effect.requireFullPayment &&
      effect.target === 'SELF'
    )
      requireCommand(
        actor.gold - goldFloor(state) >= effect.amount,
        'NOT_ELIGIBLE',
      );
    if ('target' in effect && effect.target === 'ORIGINAL_SOURCE_PLAYER')
      requireCommand(
        parent?.task?.kind === 'POST_LOSS' &&
          parent.task.originalPlayer !== null &&
          parent.task.originalPlayer !== actor.id,
        'ILLEGAL_TIMING',
      );
    switch (effect.op) {
      case 'ANTE_ALL_ACTIVE':
      case 'FORCE_LEAVE_GAMBLING':
        requireCommand(
          state.gambling?.stage === 'ROUND' &&
            activeGamblers(state).includes(actor.id),
          'ILLEGAL_TIMING',
        );
        if (effect.op === 'ANTE_ALL_ACTIVE')
          validateAnteCapacity(state, undefined, 'RAISE', effect.amount);
        if (effect.op === 'FORCE_LEAVE_GAMBLING')
          requireCommand(
            frame.targetPlayerIds.every(
              (id) =>
                activeGamblers(state).includes(id) &&
                (effect.allowSelfTarget || id !== actor.id),
            ),
            'INVALID_TARGET',
          );
        break;
      case 'SUBSTITUTE_PAYMENT_FROM_INN':
      case 'CANCEL_CURRENT_ANTE_FOR_SELF':
      case 'PREVENT_CURRENT_GOLD_LOSS':
        requireCommand(
          parent?.task?.kind === 'PAYMENT' &&
            !parent.task.canceled &&
            !parent.task.prevented &&
            parent.task.preventionAllowed !== false &&
            parent.task.payer === actor.id &&
            parent.task.amount - parent.task.substituted >= 1,
          'ILLEGAL_TIMING',
        );
        if (effect.op === 'SUBSTITUTE_PAYMENT_FROM_INN')
          requireCommand(parent.task.substituted === 0, 'ILLEGAL_TIMING');
        else if (effect.op === 'CANCEL_CURRENT_ANTE_FOR_SELF')
          requireCommand(parent.task.purpose === 'ANTE', 'ILLEGAL_TIMING');
        if (parent.task.purpose === 'ANTE')
          validateAnteCapacity(
            state,
            parent.task,
            effect.op === 'SUBSTITUTE_PAYMENT_FROM_INN'
              ? 'SUBSTITUTE'
              : 'CANCEL',
            effect.op === 'SUBSTITUTE_PAYMENT_FROM_INN'
              ? effect.scope === 'CURRENT_OBLIGATION'
                ? parent.task.amount
                : 1
              : 0,
            frame.effects.some((op) => op.op === 'LEAVE_GAMBLING')
              ? actor.id
              : undefined,
          );
        break;
      case 'REPLACE_GAMBLING_WINNER':
        requireCommand(
          parent?.task?.kind === 'SETTLEMENT' &&
            state.gambling?.stage === 'SETTLING' &&
            !parent.task.toInn,
          'ILLEGAL_TIMING',
        );
        requireCommand(
          actor.gold + state.gambling.pot <=
            (state.rules.statBounds.gold?.max ?? Number.MAX_SAFE_INTEGER),
          'GOLD_CAPACITY',
        );
        break;
      case 'END_GAMBLING':
      case 'TAKE_FROM_GAMBLING_POT':
        requireCommand(
          state.gambling?.stage === 'ROUND' &&
            parent?.task?.kind === 'CHECKPOINT' &&
            !parent.task.afterFinalPass,
          'ILLEGAL_TIMING',
        );
        if (effect.op === 'END_GAMBLING')
          requireCommand(
            !parent.task.anteAvoidance && !parent.task.sourceEndsRound,
            'ILLEGAL_TIMING',
          );
        else
          requireCommand(state.gambling.pot >= effect.amount, 'NOT_ELIGIBLE');
        break;
      case 'PASS_CURRENT_DRINK':
      case 'SPLIT_CURRENT_DRINK':
      case 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE':
      case 'REPLACE_DRINK_BASE':
        requireCommand(
          parent?.kind === 'DRINK' &&
            (effect.op === 'REPLACE_DRINK_BASE' ||
              (parent.drinkRecipientId ?? parent.actorId) === actor.id) &&
            !parent.ignoredPlayerIds.includes(actor.id),
          'ILLEGAL_TIMING',
        );
        if (effect.op === 'SPLIT_CURRENT_DRINK')
          requireCommand(!parent.noExternalSplit, 'ILLEGAL_TIMING');
        if (effect.op === 'REPLACE_DRINK_BASE')
          requireCommand(parent.drinkBase !== undefined, 'INVALID_EFFECT');
        break;
      case 'QUEUE_EXTRA_DRINK':
        requireCommand(
          (parent?.kind === 'DRINK' ||
            (parent?.task?.kind === 'PHASE' &&
              parent.task.phase === 'DRINK')) &&
            parent.actorId !== actor.id,
          'ILLEGAL_TIMING',
        );
        break;
      case 'REDIRECT_FORTITUDE_LOSS':
      case 'SHARE_FORTITUDE_LOSS':
        requireCommand(
          parent !== undefined &&
            parent.effects
              .slice(parent.nextEffectIndex)
              .some(
                (e) =>
                  e.op === 'CHANGE_STAT' &&
                  e.stat === 'FORTITUDE' &&
                  e.delta < 0,
              ),
          'ILLEGAL_TIMING',
        );
        requireCommand(
          pendingSelfLosses(state, parent, actor.id).length > 0,
          'ILLEGAL_TIMING',
        );
        if (effect.op === 'SHARE_FORTITUDE_LOSS')
          requireCommand(
            (parent.origin?.playerId ?? parent.actorId) !== actor.id &&
              (parent.origin?.playerId ?? parent.actorId) !== null &&
              parent.kind === 'CARD',
            'ILLEGAL_TIMING',
          );
        if (
          effect.op === 'REDIRECT_FORTITUDE_LOSS' &&
          effect.excludeOriginalSource
        )
          requireCommand(
            frame.targetPlayerIds.every(
              (id) =>
                id !== (parent.origin?.playerId ?? parent.actorId) &&
                id !== actor.id,
            ),
            'INVALID_TARGET',
          );
        break;
      case 'RESTART_GAMBLING_ROUND':
        requireCommand(
          parent?.task?.kind === 'SETTLEMENT' &&
            !parent.task.toInn &&
            !parent.task.restarted &&
            parent.task.winner !== actor.id &&
            state.gambling?.stage === 'SETTLING' &&
            !state.gambling.restartBlocked &&
            activeGamblers(state).includes(actor.id),
          'ILLEGAL_TIMING',
        );
        validateAnteCapacity(state, undefined, 'RAISE', effect.ante);
        break;
      case 'ORDER_EXTRA_OR_WAIVE_REFILL':
        requireCommand(
          (parent?.task?.kind === 'PAYMENT' &&
            parent.task.purpose === 'REFILL' &&
            parent.task.payer === actor.id &&
            !parent.task.prevented &&
            !parent.task.canceled) ||
            (state.phase === 'ORDER_DRINK' &&
              actor.id === state.activePlayerId &&
              parent?.task?.kind === 'PHASE'),
          'ILLEGAL_TIMING',
        );
        break;
      case 'ORDER_EXTRA_DRINKS':
        requireCommand(
          state.phase === 'ORDER_DRINK' &&
            actor.id === state.activePlayerId &&
            frame.effects.length + 2 * effect.count <= 32,
          'ILLEGAL_TIMING',
        );
        break;
      case 'FORCE_DRINK':
      case 'FORCE_SIMULTANEOUS_DRINK':
      case 'DRINKING_CONTEST':
      case 'ROUND_ON_HOUSE':
      case 'OPTIONAL_DRINK_CHALLENGE':
        requireCommand(state.gambling === null, 'ILLEGAL_TIMING');
        break;
      case 'CONTEXT_BRANCH':
        requireCommand(
          (parent?.task?.kind === 'PAYMENT' &&
            parent.task.purpose === 'ANTE' &&
            parent.task.payer === actor.id) ||
            (parent?.kind === 'DRINK' &&
              (parent.drinkRecipientId ?? parent.actorId) === actor.id),
          'ILLEGAL_TIMING',
        );
        if (parent?.task?.kind === 'PAYMENT')
          requireCommand(
            state.rules.gambling.allowLeave && !parent.task.canceled,
            'ILLEGAL_TIMING',
          );
        if (parent?.task?.kind === 'PAYMENT')
          validateAnteCapacity(state, parent.task, 'CANCEL', 0, actor.id);
        if (
          parent?.kind === 'DRINK' &&
          effect.branches.includes('IGNORE_DRINK_AND_PAY_INN_1')
        )
          requireCommand(actor.gold - goldFloor(state) >= 1, 'NOT_ELIGIBLE');
        break;
      case 'DECIDE_DRINK_SPLIT':
      case 'APPLY_DRINK_SPLIT_CHOICE':
        requireCommand(
          frame.kind === 'DRINK' && frame.noExternalSplit === true,
          'INVALID_EFFECT',
        );
        break;
    }
  }
}
