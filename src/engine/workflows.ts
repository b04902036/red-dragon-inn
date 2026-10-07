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
import { routeFortitudeLoss } from './fortitude-routing';
import { checkEliminations } from './elimination';
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
  const mitigation = frame.fortitudeMitigationPlays?.find(
    (play) =>
      play.playerId === affected && play.effectIndex === frame.nextEffectIndex,
  );
  addTask(frame, {
    kind: 'POST_LOSS',
    affected,
    amount,
    originalPlayer: frame.origin?.playerId ?? frame.actorId,
    originalCard: frame.origin?.cardId ?? frame.sourceCardId,
    sourceKind: frame.kind,
    effectIndex: frame.nextEffectIndex,
    playedReduction: mitigation?.playedReduction ?? false,
    playedIgnore: mitigation?.playedIgnore ?? false,
  });
}
export function payment(
  payer: PlayerId,
  amount: number,
  destination: 'INN' | 'POT' | 'PLAYER',
  recipient: PlayerId | null = null,
  full = false,
  preventionAllowed?: boolean,
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
    ...(preventionAllowed === undefined ? {} : { preventionAllowed }),
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
    allowBuiltInSplit:
      !state.resolutionStack.some((entry) => entry.kind === 'DRINK_EVENT') &&
      frame.task?.kind !== 'DRINK_BATCH',
    source,
    skipEvents,
    id: nextResolutionId(state),
    payForRefill:
      (frame.task?.kind === 'CHALLENGE' &&
        state.rules.drinks.refillPayment === true) ||
      (frame.task?.kind === 'DRINK_BATCH' &&
        (frame.task.contestRules !== undefined ||
          frame.task.source === 'INN' ||
          frame.task.payForRefill === true)),
  });
  const alcohol = drink.effects.find(
    (e) => e.op === 'CHANGE_STAT' && e.stat === 'ALCOHOL',
  );
  const work: DrinkWork = {
    ...(drink.drinkBase === undefined ? {} : { drinkBase: drink.drinkBase }),
    ...(drink.builtInSplitAvailable === undefined
      ? {}
      : { builtInSplitAvailable: drink.builtInSplitAvailable }),
    ...(drink.noExternalSplit === undefined
      ? {}
      : { noExternalSplit: drink.noExternalSplit }),
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
  delete copy.contestScore;
  copy.id = nextResolutionId(state);
  copy.actorId = actorId;
  copy.sourceCardIds = [];
  copy.builtInSplitAvailable = false;
  if (copy.drinkBase && halve)
    copy.drinkBase = {
      alcohol: Math.ceil(copy.drinkBase.alcohol / 2),
      fortitude: Math.ceil(copy.drinkBase.fortitude / 2),
    };
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
  if (!halve && copy.kind === 'DRINK')
    copy.drinkBase = {
      alcohol: (copy.effects[0] as Extract<Effect, { op: 'CHANGE_STAT' }>)
        .delta,
      fortitude: (copy.effects[1] as Extract<Effect, { op: 'CHANGE_STAT' }>)
        .delta,
    };
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
  if (task.deferDrinkConsumption) task.consumingDrinks = false;
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
        task.mode === 'CONTEST' ? 'INN' : (task.source ?? 'DRINK_PILE'),
        task.skipLeadingEvents ?? false,
      );
      if (task.mode === 'CONTEST' && task.contestRules !== undefined) {
        if (work.kind === 'DRINK_EVENT') work.effects = [];
        const alcohol = work.effects.find(
          (effect) => effect.op === 'CHANGE_STAT' && effect.stat === 'ALCOHOL',
        );
        work.contestScore = alcohol?.op === 'CHANGE_STAT' ? alcohol.delta : 0;
      }
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
      if (task.canceled || task.prevented) return true;
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
      if (task.restarted) return true;
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
      let winners = task.scores
        .filter((s) => s.score === max)
        .map((s) => s.playerId);
      if (task.contestRules !== undefined) {
        // A passed-out contestant leaves play immediately; their Gold remains
        // available for the contest payment until final elimination settlement.
        task.passedOutPlayerIds = [
          ...new Set([
            ...(task.passedOutPlayerIds ?? []),
            ...state.players
              .filter(
                (player) =>
                  !player.eliminated &&
                  player.alcoholContent >= player.fortitude,
              )
              .map((player) => player.id),
          ]),
        ];
        state.control.deferredContestPassOutPlayerIds = [
          ...new Set([
            ...(state.control.deferredContestPassOutPlayerIds ?? []),
            ...task.passedOutPlayerIds,
          ]),
        ];
        if (winners.length > 1)
          winners = winners.filter(
            (id) => !task.passedOutPlayerIds!.includes(id),
          );
        if (winners.length === 0) {
          task.mode = 'SIMULTANEOUS';
          changed(frame, 'CONTEST_NO_WINNER', emit, null, max);
          return true;
        }
      }
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
    case 'CHALLENGE':
      if (task.stage === 'DRINKS') {
        if (task.remaining > 0) {
          task.remaining--;
          prepareDrink(state, frame, task.actorId, emit, rng, 'INN', true);
          return false;
        }
        task.stage = 'PAYOUT';
        addTask(frame, { ...task, stage: 'SURVIVAL' });
        return false;
      }
      if (task.stage === 'SURVIVAL') {
        checkEliminations(state, emit, true);
        if (!state.players.find((p) => p.id === task.actorId)!.eliminated)
          for (const payer of state.players.filter(
            (p) => !p.eliminated && p.id !== task.actorId,
          ))
            addTask(frame, payment(payer.id, 1, 'PLAYER', task.actorId));
        changed(frame, 'CHALLENGE_SURVIVAL', emit, task.actorId);
        task.stage = 'PAYOUT';
        return !frame.pendingTasks?.length;
      }
      return true;
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
    case 'CHANGE_STAT':
      if (effect.stat !== 'GOLD' || effect.delta >= 0) return false;
      for (const target of targets)
        addTask(
          frame,
          payment(
            target.id,
            -effect.delta,
            'INN',
            null,
            false,
            effect.allowGoldLossPrevention,
          ),
        );
      return true;
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
            effect.allowGoldLossPrevention,
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
            ? payment(
                target.id,
                effect.amount,
                'PLAYER',
                actor.id,
                false,
                effect.allowGoldLossPrevention,
              )
            : payment(
                actor.id,
                effect.amount,
                'PLAYER',
                target.id,
                false,
                effect.allowGoldLossPrevention,
              ),
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
      parent.task.substituted =
        effect.scope === 'CURRENT_OBLIGATION' ? parent.task.amount : 1;
      changed(frame, effect.op, emit, actor.id, parent.task.substituted);
      return true;
    case 'CANCEL_CURRENT_ANTE_FOR_SELF':
      requireCommand(parent?.task?.kind === 'PAYMENT', 'ILLEGAL_TIMING');
      parent.task.canceled = true;
      changed(frame, effect.op, emit);
      return true;
    case 'RESTART_GAMBLING_ROUND': {
      const round = state.gambling!;
      requireCommand(parent?.task?.kind === 'SETTLEMENT', 'ILLEGAL_TIMING');
      parent.task.restarted = true;
      round.stage = 'ANTE';
      round.restarted = true;
      round.winnerPlayerId = null;
      round.settlementReady = false;
      delete round.settlementReason;
      round.checkpointReady = false;
      round.priorityPlayerId = null;
      round.controlPlayerId = actor.id;
      round.controlSourceCardId = frame.sourceCardId;
      round.allowedControlCategories = ['GAMBLING', 'CHEATING'];
      round.passedPlayerIds = [];
      for (const id of activeGamblers(state))
        addTask(frame, payment(id, effect.ante, 'POT'));
      addTask(frame, { kind: 'GAMBLING_READY' });
      changed(frame, effect.op, emit, actor.id, round.pot);
      return true;
    }
    case 'PREVENT_CURRENT_GOLD_LOSS':
      requireCommand(parent?.task?.kind === 'PAYMENT', 'ILLEGAL_TIMING');
      parent.task.prevented = true;
      changed(frame, effect.op, emit);
      return true;
    case 'ORDER_EXTRA_OR_WAIVE_REFILL':
      if (parent?.task?.kind === 'PAYMENT') {
        parent.task.prevented = true;
        changed(frame, 'WAIVE_CURRENT_REFILL_PAYMENT', emit);
      } else
        frame.effects.splice(frame.nextEffectIndex + 1, 0, {
          op: 'ORDER_EXTRA_DRINKS',
          count: effect.count,
        });
      return true;
    case 'REPLACE_GAMBLING_WINNER':
      requireCommand(parent?.task?.kind === 'SETTLEMENT', 'ILLEGAL_TIMING');
      parent.task.winner = actor.id;
      state.gambling!.winnerPlayerId = actor.id;
      if (effect.blocksRestart !== false) state.gambling!.restartBlocked = true;
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
    case 'REPLACE_DRINK_BASE': {
      const drink = parent!;
      const { alcohol, fortitude } = drinkModifierEffects(drink, false);
      const base = drink.drinkBase!;
      alcohol.delta += drink.alcoholAsFortitude
        ? 0
        : effect.alcohol - base.alcohol;
      fortitude.delta +=
        effect.fortitude -
        base.fortitude +
        (drink.alcoholAsFortitude ? effect.alcohol - base.alcohol : 0);
      drink.effects = [alcohol, fortitude];
      drink.drinkBase = {
        alcohol: effect.alcohol,
        fortitude: effect.fortitude,
      };
      if (drink.contestScore !== undefined)
        drink.contestScore += effect.alcohol - base.alcohol;
      changed(frame, effect.op, emit);
      return true;
    }
    case 'SHARE_FORTITUDE_LOSS':
      routeFortitudeLoss(state, frame, parent!, true);
      changed(frame, effect.op, emit);
      return true;
    case 'OPTIONAL_DRINK_CHALLENGE':
      if (frame.ignoredPlayerIds.includes(actor.id)) return true;
      if (frame.selectedOptionId === null)
        frame.effects.splice(
          frame.nextEffectIndex + 1,
          0,
          {
            op: 'OPEN_OPTION',
            target: 'SELF',
            options: [
              { id: 'ACCEPT', label: 'Accept' },
              { id: 'DECLINE', label: 'Decline' },
            ],
          },
          effect,
        );
      else if (frame.selectedOptionId === 'ACCEPT')
        addTask(frame, {
          kind: 'CHALLENGE',
          actorId: actor.id,
          remaining: 2,
          stage: 'DRINKS',
        });
      changed(frame, effect.op, emit);
      return true;
    case 'APPLY_DRINK_SPLIT_CHOICE':
      if (frame.selectedOptionId !== 'KEEP') {
        const work: DrinkWork = {
          id: nextResolutionId(state),
          actorId: frame.drinkRecipientId ?? actor.id,
          sourceCardIds: [],
          provenanceCardIds: frame.drinkProvenance ?? frame.sourceCardIds!,
          kind: 'DRINK',
          effects: clone(
            frame.effects.filter(
              (e) =>
                e.op !== 'DECIDE_DRINK_SPLIT' &&
                e.op !== 'APPLY_DRINK_SPLIT_CHOICE',
            ),
          ),
          score: 0,
          alcoholAsFortitude: frame.alcoholAsFortitude ?? false,
          noExternalSplit: true,
          ...(frame.drinkBase === undefined
            ? {}
            : { drinkBase: frame.drinkBase }),
        };
        copyDrink(state, frame, work, work.actorId, true);
        copyDrink(state, frame, work, frame.selectedOptionId as PlayerId, true);
        frame.canceled = true;
      }
      changed(frame, effect.op, emit);
      return true;
    case 'REDIRECT_FORTITUDE_LOSS':
      if (effect.excludeOriginalSource || effect.twoPlayerIgnoreFallback)
        routeFortitudeLoss(state, frame, parent!, false);
      else parent!.redirectedFortitudePlayerId = frame.targetPlayerIds[0]!;
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
        participants: (() => {
          const living = [...state.players]
            .sort((a, b) => a.seat - b.seat)
            .filter(
              (p) =>
                !p.eliminated &&
                !state.control.deferredContestPassOutPlayerIds?.includes(p.id),
            );
          if (effect.op !== 'DRINKING_CONTEST' || effect.rules === undefined)
            return living.map((p) => p.id);
          const index = living.findIndex((p) => p.id === state.activePlayerId);
          return [...living.slice(index), ...living.slice(0, index)].map(
            (p) => p.id,
          );
        })(),
        scores: [],
        round: 0,
        initialized: false,
        ...(effect.op === 'FORCE_SIMULTANEOUS_DRINK' &&
        effect.source !== undefined
          ? { source: effect.source }
          : {}),
        ...(effect.op === 'FORCE_SIMULTANEOUS_DRINK' &&
        effect.skipLeadingEvents !== undefined
          ? { skipLeadingEvents: effect.skipLeadingEvents }
          : {}),
        ...(effect.op === 'DRINKING_CONTEST' && effect.rules !== undefined
          ? { contestRules: effect.rules }
          : {}),
        ...((effect.op === 'DRINKING_CONTEST' && effect.rules !== undefined) ||
        (effect.op === 'FORCE_SIMULTANEOUS_DRINK' && effect.source === 'INN')
          ? { deferDrinkConsumption: true }
          : {}),
        ...(effect.op === 'ROUND_ON_HOUSE' && effect.payForRefill !== undefined
          ? { payForRefill: effect.payForRefill }
          : {}),
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
