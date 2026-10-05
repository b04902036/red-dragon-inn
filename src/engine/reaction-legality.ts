import type { CardDefinition } from '../content/cards';
import type {
  ReactionCondition,
  ResponseTrigger,
} from '../content/reaction-triggers';
import type { Effect } from '../content/effects';
import type { CardInstanceId, PlayerId } from '../shared/ids';
import { resolutionIdSchema } from '../shared/ids';
import {
  cardEffects,
  hasChosenTarget,
  validateEffects,
} from './card-effects-validation';
import { CommandError } from './errors';
import type { ResolutionFrame, TurnPhase, MatchLifecycle } from './model';
import type { CoreGameState, MutableGameState } from './types';
import { taskEvent } from './workflow-state';
import { sourceCapabilities } from './source-capabilities';

export interface ReactionContext {
  readonly systemEvent: ReturnType<typeof taskEvent>;
  readonly capabilities: ReturnType<typeof sourceCapabilities>;
  readonly counterFamily: string | null;
  readonly counterProtected: boolean;
  readonly allowedCounterFamilies: readonly string[] | null;
  readonly frame: ResolutionFrame;
  readonly sourceKind: ResolutionFrame['kind'];
  readonly sourceType: CardDefinition['type'] | null;
  readonly sourceActorId: PlayerId | null;
  readonly affectedPlayerIds: readonly PlayerId[];
  readonly pendingOperations: readonly Effect['op'][];
  readonly pendingStatDeltas: readonly {
    playerId: PlayerId;
    stat: 'FORTITUDE' | 'ALCOHOL' | 'GOLD';
    delta: number;
  }[];
  readonly negatable: boolean;
  readonly phase: TurnPhase | null;
  readonly lifecycle: MatchLifecycle;
}
/** Pure facts from the pending cursor, excluding canceled/ignored effects. */
export function reactionContext(
  state: CoreGameState,
  frame: ResolutionFrame,
): ReactionContext {
  const sourceId = frame.sourceCardId ?? frame.drinkProvenance?.[0];
  const definition =
    sourceId === undefined
      ? undefined
      : state.definitions[state.cards[sourceId]!.definitionId];
  const pending = frame.canceled
    ? []
    : frame.effects.slice(frame.nextEffectIndex);
  const affected = new Set<PlayerId>();
  const deltas: {
    playerId: PlayerId;
    stat: 'FORTITUDE' | 'ALCOHOL' | 'GOLD';
    delta: number;
  }[] = [];
  for (const effect of pending) {
    const targets =
      effect.op === 'CHANGE_STAT' &&
      effect.stat === 'FORTITUDE' &&
      effect.delta < 0 &&
      frame.redirectedFortitudePlayerId !== undefined
        ? state.players.filter(
            (p) =>
              p.id === frame.redirectedFortitudePlayerId &&
              !p.eliminated &&
              !frame.ignoredPlayerIds.includes(p.id),
          )
        : 'target' in effect
          ? state.players.filter(
              (player) =>
                !player.eliminated &&
                !frame.ignoredPlayerIds.includes(player.id) &&
                (effect.target === 'ALL_PLAYERS' ||
                  (effect.target === 'SELF' &&
                    player.id === (frame.drinkRecipientId ?? frame.actorId)) ||
                  (effect.target === 'ORIGINAL_SOURCE_PLAYER' &&
                    player.id === frame.responseToOrigin?.playerId) ||
                  (effect.target === 'SOURCE_ACTOR' &&
                    player.id === frame.responseToOrigin?.playerId) ||
                  (effect.target === 'CHOSEN_PLAYER' &&
                    frame.targetPlayerIds.includes(player.id)) ||
                  (effect.target === 'EACH_OTHER_PLAYER' &&
                    player.id !== frame.actorId)),
            )
          : [];
    for (const player of targets) {
      affected.add(player.id);
      if (effect.op === 'CHANGE_STAT')
        deltas.push({
          playerId: player.id,
          stat: effect.stat,
          delta: effect.delta,
        });
      if (effect.op === 'PAY_INN')
        deltas.push({
          playerId: player.id,
          stat: 'GOLD',
          delta: -Math.min(effect.amount, player.gold),
        });
      if (
        (effect.op === 'TRANSFER_GOLD' || effect.op === 'COLLECT_GOLD') &&
        player.id !== frame.actorId &&
        frame.actorId !== null &&
        !frame.ignoredPlayerIds.includes(frame.actorId)
      ) {
        affected.add(frame.actorId);
        deltas.push(
          {
            playerId: frame.actorId,
            stat: 'GOLD',
            delta:
              effect.op === 'COLLECT_GOLD' ? effect.amount : -effect.amount,
          },
          {
            playerId: player.id,
            stat: 'GOLD',
            delta:
              effect.op === 'COLLECT_GOLD' ? -effect.amount : effect.amount,
          },
        );
      }
    }
  }
  return {
    systemEvent: taskEvent(frame.task),
    capabilities: sourceCapabilities(
      definition,
      state.resolutionStack.find((parent) => parent.id === frame.parentId),
    ),
    counterFamily: definition?.counterFamily ?? null,
    counterProtected:
      definition?.counterPolicy === 'SAME_FAMILY_ONLY' ||
      definition?.allowedCounterFamilies !== undefined,
    allowedCounterFamilies: definition?.allowedCounterFamilies ?? null,
    frame,
    sourceKind: frame.kind,
    sourceType: definition?.type ?? null,
    sourceActorId: frame.actorId,
    affectedPlayerIds: [...affected],
    pendingOperations: pending.map((effect) => effect.op),
    pendingStatDeltas: deltas,
    negatable:
      !frame.canceled &&
      frame.kind === 'CARD' &&
      definition?.negatable !== false,
    phase: state.phase,
    lifecycle: state.lifecycle,
  };
}
function relates(
  id: PlayerId | null,
  actor: PlayerId,
  relation: 'SELF' | 'OTHER' | 'ANY',
) {
  return (
    id !== null &&
    (relation === 'ANY' || (relation === 'SELF' ? id === actor : id !== actor))
  );
}
function conditionMatches(
  state: CoreGameState,
  playerId: PlayerId,
  context: ReactionContext,
  condition: ReactionCondition,
  responderFamily?: string,
): boolean {
  switch (condition.kind) {
    case 'SYSTEM_EVENT':
      return (
        context.systemEvent !== null &&
        condition.events.includes(context.systemEvent)
      );
    case 'PAYMENT_CONTEXT': {
      const task = context.frame.task;
      return (
        task?.kind === 'PAYMENT' &&
        !task.canceled &&
        task.amount - task.substituted >= condition.minAmount &&
        relates(task.payer, playerId, condition.payer) &&
        (condition.purpose === 'ANY' || condition.purpose === task.purpose)
      );
    }
    case 'ACTUAL_STAT_LOSS': {
      const task = context.frame.task;
      return (
        task?.kind === 'POST_LOSS' &&
        task.amount >= condition.minAmount &&
        relates(task.affected, playerId, condition.relation)
      );
    }
    case 'ORIGINAL_SOURCE_PLAYER': {
      const task = context.frame.task;
      return (
        task?.kind === 'POST_LOSS' &&
        relates(task.originalPlayer, playerId, condition.relation)
      );
    }
    case 'SOURCE_CAPABILITY':
      return condition.match === 'ANY'
        ? condition.capabilities.some((c) => context.capabilities.includes(c))
        : condition.match === 'ALL'
          ? condition.capabilities.every((c) =>
              context.capabilities.includes(c),
            )
          : condition.capabilities.every(
              (c) => !context.capabilities.includes(c),
            );
    case 'COUNTER_FAMILY': {
      return condition.relation === 'UNPROTECTED'
        ? !context.counterProtected
        : condition.relation === 'SAME'
          ? context.counterFamily !== null &&
            responderFamily === context.counterFamily
          : context.counterFamily === null ||
            responderFamily !== context.counterFamily;
    }
    case 'PHASE_OPPORTUNITY':
      return (
        context.frame.task?.kind === 'PHASE' &&
        relates(context.frame.actorId, playerId, condition.actor) &&
        context.frame.task.phase === condition.phase
      );
    case 'GAMBLING_CHECKPOINT': {
      const task = context.frame.task;
      return (
        task?.kind === 'CHECKPOINT' &&
        (!condition.notAfterFinalPass || !task.afterFinalPass) &&
        (!condition.notAnteAvoidance || !task.anteAvoidance) &&
        (!condition.sourceWillNotEndRound || !task.sourceEndsRound) &&
        (state.gambling?.pot ?? 0) >= condition.potMin
      );
    }
    case 'SOURCE_ACTOR':
      return relates(context.sourceActorId, playerId, condition.relation);
    case 'AFFECTS':
      return context.affectedPlayerIds.some((id) =>
        relates(id, playerId, condition.relation),
      );
    case 'SOURCE_TYPE':
      return (
        context.sourceType !== null &&
        condition.types.includes(context.sourceType)
      );
    case 'SOURCE_KIND':
      return condition.kinds.includes(context.sourceKind);
    case 'NEGATABLE':
      return context.negatable === condition.value;
    case 'PENDING_OPERATION':
      return context.pendingOperations.some((op) =>
        condition.operations.includes(op),
      );
    case 'PENDING_STAT':
      return context.pendingStatDeltas.some(
        (delta) =>
          delta.stat === condition.stat &&
          relates(delta.playerId, playerId, condition.relation) &&
          (condition.direction === 'ANY' ||
            (condition.direction === 'GAIN'
              ? delta.delta > 0
              : delta.delta < 0)),
      );
    case 'TARGET_COUNT':
      return (
        context.affectedPlayerIds.length >= condition.min &&
        context.affectedPlayerIds.length <= condition.max
      );
    case 'PHASE':
      return context.phase !== null && condition.phases.includes(context.phase);
    case 'LIFECYCLE':
      return condition.lifecycles.includes(context.lifecycle);
    case 'NESTING':
      return (
        (context.frame.parentId === null ? 'ROOT' : 'CHILD') ===
        condition.relation
      );
    case 'GAMBLING': {
      const round = state.gambling;
      if (round === null) return false;
      switch (condition.fact) {
        case 'ACTIVE':
          return true;
        case 'ROUND':
          return round.stage === 'ROUND';
        case 'SETTLING':
          return round.stage === 'SETTLING';
        case 'CONTROL':
          return round.controlPlayerId === playerId;
        case 'PARTICIPANT':
          return (
            round.participants.includes(playerId) &&
            !round.leftPlayerIds.includes(playerId)
          );
        case 'CHEATING_ALLOWED':
          return round.allowedControlCategories.includes('CHEATING');
      }
      break;
    }
    case 'PLAYER_STAT': {
      const player = state.players.find((player) => player.id === playerId)!;
      const value =
        condition.stat === 'FORTITUDE'
          ? player.fortitude
          : condition.stat === 'ALCOHOL'
            ? player.alcoholContent
            : player.gold;
      switch (condition.comparison) {
        case 'LT':
          return value < condition.value;
        case 'LTE':
          return value <= condition.value;
        case 'EQ':
          return value === condition.value;
        case 'GTE':
          return value >= condition.value;
        case 'GT':
          return value > condition.value;
      }
      break;
    }
  }
}
export function triggerMatches(
  state: CoreGameState,
  playerId: PlayerId,
  context: ReactionContext,
  trigger: ResponseTrigger,
  responderFamily?: string,
): boolean {
  return (
    (trigger.event === 'ANY' || trigger.event === context.sourceKind) &&
    trigger.alternatives.some((conditions) =>
      conditions.every((condition) =>
        conditionMatches(state, playerId, context, condition, responderFamily),
      ),
    )
  );
}
export interface LegalResponse {
  readonly cardId: CardInstanceId;
  readonly commandType: 'PLAY_RESPONSE' | 'PLAY_CARD';
  readonly requiresTarget: boolean;
  readonly legalTargetPlayerIds: readonly PlayerId[];
}
export function phaseReactionContext(state: CoreGameState): ReactionContext {
  return reactionContext(state, {
    id: resolutionIdSchema.parse('resolution_phase_legality'),
    kind: 'SYSTEM',
    actorId: state.activePlayerId,
    sourceCardId: null,
    sourceRevealed: false,
    targetPlayerIds: [],
    effects: [],
    nextEffectIndex: 0,
    parentId: null,
    stage: 'RESPONSES',
    canceled: false,
    ignoredPlayerIds: [],
    window: null,
    continuation: 'RESUME',
    selectedOptionId: null,
    task: {
      kind: 'PHASE',
      phase: 'ORDER_DRINK',
      normalOrderComplete: state.control.normalOrderDone ?? false,
    },
  });
}
/** Includes trigger and effect/target validation, but not the current priority gate.
 * Used both to choose responders and to validate the exact submitted response. */
export function legalResponsesForPlayer(
  state: CoreGameState,
  playerId: PlayerId,
  context: ReactionContext,
): LegalResponse[] {
  const player = state.players.find((player) => player.id === playerId);
  if (
    !player ||
    player.eliminated ||
    state.control.deferredContestPassOutPlayerIds?.includes(playerId) ||
    state.lifecycle !== 'PLAYING' ||
    context.frame.canceled ||
    state.resolutionStack.length >= 32 ||
    (context.frame.window?.submittedResponses.length ?? 0) >= 256
  )
    return [];
  const legal: LegalResponse[] = [];
  for (const cardId of player.hand) {
    const definition = state.definitions[state.cards[cardId]!.definitionId]!;
    if (definition.type !== 'ANYTIME' && definition.type !== 'SOMETIMES')
      continue;
    if (context.frame.task !== undefined) {
      if (context.systemEvent === null) continue;
      // Eligibility is derived from legal effects, never from an existing window.
      // An Anytime holder must be able to create/join a system opportunity even
      // without a matching Sometimes. Voice eligibility is projected separately.
      if (
        definition.type === 'SOMETIMES' &&
        definition.phaseOpportunity === undefined &&
        definition.responseTrigger?.event !== 'SYSTEM' &&
        !definition.responseTrigger?.alternatives.some((conditions) =>
          conditions.some(
            (c) =>
              [
                'SYSTEM_EVENT',
                'PAYMENT_CONTEXT',
                'ACTUAL_STAT_LOSS',
                'ORIGINAL_SOURCE_PLAYER',
                'PHASE_OPPORTUNITY',
                'GAMBLING_CHECKPOINT',
              ].includes(c.kind) ||
              (c.kind === 'SOURCE_KIND' && c.kinds.includes('SYSTEM')),
          ),
        )
      )
        continue;
    }
    if (definition.type === 'SOMETIMES') {
      if (definition.phaseOpportunity !== undefined) {
        if (
          context.frame.task?.kind !== 'PHASE' ||
          context.frame.task.phase !== definition.phaseOpportunity ||
          context.frame.actorId !== playerId
        )
          continue;
      }
      if (definition.responseTrigger !== undefined) {
        if (
          !triggerMatches(
            state,
            playerId,
            context,
            definition.responseTrigger,
            definition.counterFamily,
          )
        )
          continue;
      } else {
        // Legacy pinned Ignore/Negate definitions have structural predicates.
        // An unspecified ordinary Sometimes is never a blanket permission.
        if (
          definition.responseKind === 'SOMETIMES' &&
          definition.phaseOpportunity === undefined
        )
          continue;
        if (
          definition.responseKind === 'IGNORE' &&
          !context.affectedPlayerIds.includes(playerId)
        )
          continue;
        if (definition.responseKind === 'NEGATE' && !context.negatable)
          continue;
      }
    }
    if (
      definition.effects.some((effect) => effect.op === 'NEGATE') &&
      !context.negatable
    )
      continue;
    if (
      definition.effects.some((e) =>
        [
          'NEGATE',
          'IGNORE',
          'MODIFY_PENDING_EFFECT',
          'REDIRECT_FORTITUDE_LOSS',
        ].includes(e.op),
      ) &&
      context.counterProtected &&
      (context.allowedCounterFamilies !== null
        ? definition.counterFamily === undefined ||
          !context.allowedCounterFamilies.includes(definition.counterFamily)
        : context.counterFamily === null ||
          definition.counterFamily !== context.counterFamily)
    )
      continue;
    const requiresTarget = hasChosenTarget(definition.effects);
    const candidates = requiresTarget
      ? state.players
          .filter(
            (target) =>
              !target.eliminated &&
              !state.control.deferredContestPassOutPlayerIds?.includes(
                target.id,
              ) &&
              (definition.targetPolicy === 'ANY_LIVING_PLAYER' ||
                target.id !== playerId),
          )
          .map((target) => target.id)
      : [undefined];
    const targets: PlayerId[] = [];
    let valid = false;
    for (const target of candidates) {
      const candidate = {
        responseToOrigin:
          context.frame.task?.kind === 'POST_LOSS'
            ? {
                playerId: context.frame.task.originalPlayer,
                cardId: context.frame.task.originalCard,
              }
            : {
                playerId: context.frame.actorId,
                cardId: context.frame.sourceCardId,
              },
        id: resolutionIdSchema.parse('resolution_legality'),
        kind: 'CARD' as const,
        actorId: playerId,
        sourceCardId: cardId,
        sourceRevealed: true,
        targetPlayerIds: target === undefined ? [] : [target],
        effects: cardEffects(definition),
        nextEffectIndex: 0,
        parentId: context.frame.id,
        stage: 'RESPONSES' as const,
        canceled: false,
        ignoredPlayerIds: [],
        window: null,
        continuation: 'RESUME' as const,
        selectedOptionId: null,
      };
      try {
        validateEffects(
          state as MutableGameState,
          candidate,
          context.frame as MutableGameState['resolutionStack'][number],
        );
        valid = true;
        if (target !== undefined) targets.push(target);
      } catch (error) {
        if (!(error instanceof CommandError)) throw error;
      }
    }
    if (valid)
      legal.push({
        cardId,
        commandType:
          definition.phaseOpportunity === undefined
            ? 'PLAY_RESPONSE'
            : 'PLAY_CARD',
        requiresTarget,
        legalTargetPlayerIds: targets,
      });
  }
  return legal;
}
export function timingOrder(
  state: CoreGameState,
  origin: PlayerId,
): PlayerId[] {
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat);
  const index = ordered.findIndex((player) => player.id === origin);
  return [...ordered.slice(index), ...ordered.slice(0, index)]
    .filter(
      (player) =>
        !player.eliminated &&
        !state.control.deferredContestPassOutPlayerIds?.includes(player.id),
    )
    .map((player) => player.id);
}
