import type { Effect } from '../content/effects';
import type { PlayerId } from '../shared/ids';
import type { MutableGameState } from './types';
import type { MutableFrame } from './effect-operations';
import { effectTargets } from './effect-operations';
import type { EmitEvent } from './event-writer';
import type { RandomSource } from './rng';
import type { WorkflowTask, DrinkWork } from './workflow-state';
import { changeGold, payGold, transferGold, goldFloor } from './gold';
import { activeGamblers, finishGamblingAntes, leaveGambling } from './gambling';
import { buildDrinkFrame, drinkModifierEffects } from './drinks';
import { nextResolutionId } from './resolution-ids';
import { dealDrinks } from './turn';
import { requireCommand } from './errors';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function addTask(frame: MutableFrame, task: WorkflowTask) {
  frame.pendingTasks ??= [];
  requireCommand(frame.pendingTasks.length < 64, 'STACK_LIMIT');
  frame.pendingTasks.push(task);
}
export function queuePostLoss(
  frame: MutableFrame,
  affected: PlayerId,
  amount: number,
) {
  addTask(frame, {
    kind: 'POST_LOSS',
    affected,
    amount,
    originalPlayer: frame.origin?.playerId ?? frame.actorId,
    originalCard: frame.origin?.cardId ?? frame.sourceCardId,
  });
}
function payment(
  payer: PlayerId,
  amount: number,
  destination: 'INN' | 'POT' | 'PLAYER',
  recipient: PlayerId | null = null,
  full = false,
): WorkflowTask {
  return {
    kind: 'PAYMENT',
    purpose: destination === 'POT' ? 'ANTE' : 'PAYMENT',
    payer,
    amount,
    destination,
    recipient,
    full,
    substituted: 0,
    canceled: false,
  };
}
function changed(
  frame: MutableFrame,
  operation: string,
  emit: EmitEvent,
  playerId: PlayerId | null = frame.actorId,
  amount = 0,
) {
  emit({
    type: 'WORKFLOW_CHANGED',
    resolutionId: frame.id,
    operation,
    playerId,
    amount,
  });
}
function addDrink(
  state: MutableGameState,
  frame: MutableFrame,
  work: DrinkWork,
) {
  frame.pendingDrinks ??= [];
  requireCommand(frame.pendingDrinks.length < 8, 'STACK_LIMIT');
  frame.pendingDrinks.push(work);
  for (const id of work.sourceCardIds)
    state.cards[id]!.location = { zone: 'RESOLUTION', resolutionId: frame.id };
}
export function prepareDrink(
  state: MutableGameState,
  frame: MutableFrame,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
  source: 'INN' | 'DRINK_PILE' = 'DRINK_PILE',
  skipEvents = false,
) {
  const drink = buildDrinkFrame(state, actorId, emit, rng, {
    source,
    skipEvents,
    id: nextResolutionId(state),
  });
  const alcohol = drink.effects.find(
    (e) => e.op === 'CHANGE_STAT' && e.stat === 'ALCOHOL',
  );
  const work: DrinkWork = {
    id: drink.id,
    actorId,
    sourceCardIds: drink.sourceCardIds,
    provenanceCardIds: drink.sourceCardIds,
    kind: drink.kind,
    effects: drink.effects,
    score: Math.max(0, alcohol?.op === 'CHANGE_STAT' ? alcohol.delta : 0),
    alcoholAsFortitude: false,
  };
  addDrink(state, frame, work);
  return work;
}
function copyDrink(
  state: MutableGameState,
  frame: MutableFrame,
  work: DrinkWork,
  actorId: PlayerId,
  halve: boolean,
) {
  const copy = clone(work);
  copy.id = nextResolutionId(state);
  copy.actorId = actorId;
  copy.sourceCardIds = [];
  for (const [index, effect] of copy.effects.entries())
    if (effect.op === 'CHANGE_STAT') {
      if (halve) effect.delta = Math.ceil(effect.delta / 2);
      else if (
        index < 2 &&
        (effect.stat === 'ALCOHOL' || effect.stat === 'FORTITUDE')
      ) {
        let sum = 0;
        const player = state.players.find((p) => p.id === actorId)!;
        for (const id of work.provenanceCardIds) {
          const definition = state.definitions[state.cards[id]!.definitionId]!;
          if (definition.type !== 'DRINK') continue;
          const replacement = definition.traitReplacements?.find((r) =>
            player.traits?.includes(r.trait),
          );
          sum +=
            effect.stat === 'ALCOHOL'
              ? (replacement?.alcoholContent ?? definition.alcoholContent)
              : (replacement?.fortitudeChange ?? definition.fortitudeChange);
        }
        effect.delta = sum;
      }
    }
  addDrink(state, frame, copy);
}
function beginBatch(
  state: MutableGameState,
  frame: MutableFrame,
  emit: EmitEvent,
  rng: RandomSource,
) {
  const task = frame.task;
  if (task?.kind !== 'DRINK_BATCH') return;
  requireCommand(task.round < 256, 'STACK_LIMIT');
  task.round++;
  task.initialized = true;
  task.scores = [];
  if (task.mode === 'HOUSE') {
    const work = prepareDrink(
      state,
      frame,
      task.participants[0]!,
      emit,
      rng,
      'INN',
      true,
    );
    frame.pendingDrinks = [];
    frame.heldDrinkCardIds = [...work.sourceCardIds];
    for (const actor of task.participants)
      copyDrink(state, frame, work, actor, false);
  } else
    for (const actor of task.participants) {
      const work = prepareDrink(
        state,
        frame,
        actor,
        emit,
        rng,
        task.mode === 'CONTEST' ? 'INN' : 'DRINK_PILE',
      );
      task.scores.push({ playerId: actor, score: work.score });
    }
  if (task.mode === 'CONTEST')
    emit({
      type: 'DRINK_CONTEST_ROUND',
      resolutionId: frame.id,
      round: task.round,
      scores: task.scores,
    });
}

/** Finish an accepted obligation only after its fresh response window closes. */
export function finishTask(
  state: MutableGameState,
  frame: MutableFrame,
  parent: MutableFrame | undefined,
  emit: EmitEvent,
  rng: RandomSource,
): boolean {
  const task = frame.task;
  if (task === undefined) return true;
  switch (task.kind) {
    case 'FORCED_DRINK':
      prepareDrink(state, parent ?? frame, task.actorId, emit, rng);
      return true;
    case 'PAYMENT': {
      if (task.canceled) return true;
      const payer = state.players.find((p) => p.id === task.payer)!;
      const remaining = task.amount - task.substituted;
      if (task.full && payer.gold - goldFloor(state) < remaining) {
        if (parent) parent.canceled = true;
        changed(frame, 'UNPAID_COST', emit, payer.id, remaining);
        return true;
      }
      if (task.destination === 'PLAYER') {
        const recipient = state.players.find((p) => p.id === task.recipient)!;
        transferGold(state, payer, recipient, remaining, emit);
        if (task.substituted)
          changeGold(state, recipient, task.substituted, emit);
      } else {
        const paid = payGold(state, payer, remaining, emit) + task.substituted;
        if (task.destination === 'POT') {
          const round = state.gambling!;
          round.pot += paid;
          round.contributions.find((c) => c.playerId === payer.id)!.amount +=
            paid;
          if (paid > 0)
            emit({
              type: 'GAMBLING_ANTE_PAID',
              playerId: payer.id,
              amount: paid,
            });
        }
      }
      return true;
    }
    case 'GAMBLING_READY':
      finishGamblingAntes(state, emit);
      return true;
    case 'SETTLEMENT': {
      const round = state.gambling!;
      const pot = round.pot;
      state.gambling = null;
      if (task.toInn) changed(frame, 'POT_TO_INN', emit, null, pot);
      else {
        changeGold(
          state,
          state.players.find((p) => p.id === task.winner)!,
          pot,
          emit,
        );
        emit({
          type: 'GAMBLING_FINISHED',
          winnerPlayerId: task.winner,
          pot,
          reason: round.settlementReason ?? 'IMMEDIATE_WIN',
        });
      }
      return true;
    }
    case 'DRINK_BATCH': {
      if (!task.initialized) {
        beginBatch(state, frame, emit, rng);
        return false;
      }
      if (task.mode !== 'CONTEST') return true;
      const max = Math.max(...task.scores.map((s) => s.score));
      const winners = task.scores
        .filter((s) => s.score === max)
        .map((s) => s.playerId);
      if (winners.length > 1) {
        task.participants = winners;
        task.initialized = false;
        beginBatch(state, frame, emit, rng);
        return false;
      }
      for (const loser of state.players.filter(
        (p) => !p.eliminated && p.id !== winners[0],
      ))
        addTask(frame, payment(loser.id, 1, 'PLAYER', winners[0]!));
      task.mode = 'SIMULTANEOUS';
      changed(frame, 'CONTEST_WINNER', emit, winners[0]!, max);
      return frame.pendingTasks!.length === 0;
    }
    default:
      return true;
  }
}

export function executeGenericOperation(
  state: MutableGameState,
  frame: MutableFrame,
  effect: Effect,
  emit: EmitEvent,
  rng: RandomSource,
): boolean {
  const parent = state.resolutionStack.at(-2);
  const actor = state.players.find((p) => p.id === frame.actorId)!;
  const targets =
    'target' in effect ? effectTargets(state, frame, effect.target) : [];
  switch (effect.op) {
    case 'PAY_INN':
      for (const target of effect.requireFullPayment
        ? effectTargets(
            state,
            { ...frame, ignoredPlayerIds: [] },
            effect.target,
          )
        : targets)
        addTask(
          frame,
          payment(
            target.id,
            effect.amount,
            'INN',
            null,
            effect.requireFullPayment ?? false,
          ),
        );
      return true;
    case 'TRANSFER_GOLD':
    case 'COLLECT_GOLD':
      if (frame.ignoredPlayerIds.includes(actor.id)) return true;
      for (const target of targets.filter((p) => p.id !== actor.id))
        addTask(
          frame,
          effect.op === 'COLLECT_GOLD'
            ? payment(target.id, effect.amount, 'PLAYER', actor.id)
            : payment(actor.id, effect.amount, 'PLAYER', target.id),
        );
      return true;
    case 'ANTE_ALL_ACTIVE':
      for (const id of activeGamblers(state))
        addTask(frame, payment(id, effect.amount, 'POT'));
      return true;
    case 'FORCE_LEAVE_GAMBLING':
      for (const p of targets) leaveGambling(state, p.id, emit);
      return true;
    case 'SUBSTITUTE_PAYMENT_FROM_INN':
      requireCommand(parent?.task?.kind === 'PAYMENT', 'ILLEGAL_TIMING');
      parent.task.substituted = 1;
      changed(frame, effect.op, emit, actor.id, 1);
      return true;
    case 'CANCEL_CURRENT_ANTE_FOR_SELF':
      requireCommand(parent?.task?.kind === 'PAYMENT', 'ILLEGAL_TIMING');
      parent.task.canceled = true;
      changed(frame, effect.op, emit);
      return true;
    case 'REPLACE_GAMBLING_WINNER':
      requireCommand(parent?.task?.kind === 'SETTLEMENT', 'ILLEGAL_TIMING');
      parent.task.winner = actor.id;
      state.gambling!.winnerPlayerId = actor.id;
      changed(frame, effect.op, emit);
      return true;
    case 'END_GAMBLING':
      addTask(frame, { kind: 'SETTLEMENT', winner: actor.id, toInn: true });
      state.gambling!.stage = 'SETTLING';
      state.gambling!.winnerPlayerId = actor.id;
      state.gambling!.settlementReady = true;
      return true;
    case 'TAKE_FROM_GAMBLING_POT': {
      const round = state.gambling!;
      const paid = Math.min(effect.amount, round.pot);
      round.pot -= paid;
      round.potRemoved = (round.potRemoved ?? 0) + paid;
      changeGold(state, actor, paid, emit);
      changed(frame, effect.op, emit, actor.id, paid);
      return true;
    }
    case 'ORDER_EXTRA_DRINKS':
      frame.effects.splice(
        frame.nextEffectIndex + 1,
        0,
        ...Array.from({ length: effect.count }, () => [
          {
            op: 'OPEN_CHOICE' as const,
            target: 'SELF' as const,
            kind: 'TARGET' as const,
          },
          {
            op: 'DEAL_DRINKS' as const,
            target: 'CHOSEN_PLAYER' as const,
            count: 1,
          },
        ]).flat(),
      );
      return true;
    case 'DEAL_DRINKS':
      for (const target of targets)
        for (const id of dealDrinks(state, target, effect.count, emit, rng))
          emit({
            type: 'DRINK_ORDERED',
            playerId: actor.id,
            targetPlayerId: target.id,
            cardId: id,
          });
      return true;
    case 'FORCE_DRINK':
      for (const target of targets)
        prepareDrink(state, frame, target.id, emit, rng);
      return true;
    case 'QUEUE_EXTRA_DRINK':
      requireCommand(
        parent?.actorId !== null && parent !== undefined,
        'ILLEGAL_TIMING',
      );
      parent.afterTasks ??= [];
      requireCommand(parent.afterTasks.length < 8, 'STACK_LIMIT');
      parent.afterTasks.push({ kind: 'FORCED_DRINK', actorId: parent.actorId });
      return true;
    case 'PASS_CURRENT_DRINK':
      parent!.drinkRecipientId = frame.targetPlayerIds[0]!;
      changed(frame, effect.op, emit, parent!.drinkRecipientId);
      return true;
    case 'SPLIT_CURRENT_DRINK': {
      const work: DrinkWork = {
        id: nextResolutionId(state),
        actorId: parent!.drinkRecipientId ?? parent!.actorId!,
        sourceCardIds: [],
        provenanceCardIds: [
          ...(parent!.drinkProvenance ?? parent!.sourceCardIds!),
        ],
        kind: 'DRINK',
        effects: clone(parent!.effects),
        score: 0,
        alcoholAsFortitude: parent!.alcoholAsFortitude ?? false,
      };
      copyDrink(state, parent!, work, work.actorId, true);
      copyDrink(state, parent!, work, frame.targetPlayerIds[0]!, true);
      parent!.effects = [];
      parent!.canceled = true;
      changed(frame, effect.op, emit);
      return true;
    }
    case 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE': {
      const { alcohol, fortitude } = drinkModifierEffects(parent!, false);
      fortitude.delta += alcohol.delta;
      alcohol.delta = 0;
      parent!.alcoholAsFortitude = true;
      changed(frame, effect.op, emit);
      return true;
    }
    case 'REDIRECT_FORTITUDE_LOSS':
      parent!.redirectedFortitudePlayerId = frame.targetPlayerIds[0]!;
      changed(frame, effect.op, emit, frame.targetPlayerIds[0]!);
      return true;
    case 'FORCE_SIMULTANEOUS_DRINK':
    case 'DRINKING_CONTEST':
    case 'ROUND_ON_HOUSE':
      addTask(frame, {
        kind: 'DRINK_BATCH',
        mode:
          effect.op === 'DRINKING_CONTEST'
            ? 'CONTEST'
            : effect.op === 'ROUND_ON_HOUSE'
              ? 'HOUSE'
              : 'SIMULTANEOUS',
        participants: state.players
          .filter((p) => !p.eliminated)
          .map((p) => p.id),
        scores: [],
        round: 0,
        initialized: false,
      });
      return true;
    case 'CONTEXT_BRANCH':
      if (parent!.task?.kind === 'PAYMENT') {
        parent!.task.canceled = true;
        leaveGambling(state, actor.id, emit);
      } else {
        if (effect.branches.includes('IGNORE_DRINK_AND_PAY_INN_1')) {
          addTask(frame, payment(actor.id, 1, 'INN', null, true));
          frame.effects.splice(frame.nextEffectIndex + 1, 0, {
            op: 'IGNORE',
            scope: 'CURRENT_EFFECT',
          });
          return true;
        }
        if (!parent!.ignoredPlayerIds.includes(actor.id))
          parent!.ignoredPlayerIds.push(actor.id);
        emit({
          type: 'SOURCE_IGNORED',
          resolutionId: parent!.id,
          playerId: actor.id,
        });
      }
      return true;
    default:
      return false;
  }
}
