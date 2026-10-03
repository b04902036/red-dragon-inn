import type { CardDefinition } from '../content/cards';
import type {
  ReactionCondition,
  ResponseTrigger,
} from '../content/reaction-triggers';
import type { Effect } from '../content/effects';
import type { CardInstanceId, PlayerId } from '../shared/ids';
import { resolutionIdSchema } from '../shared/ids';
import { hasChosenTarget, validateEffects } from './card-effects-validation';
import { CommandError } from './errors';
import type { ResolutionFrame, TurnPhase, MatchLifecycle } from './model';
import type { CoreGameState, MutableGameState } from './types';

export interface ReactionContext {
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
  const definition =
    frame.sourceCardId === null
      ? undefined
      : state.definitions[state.cards[frame.sourceCardId]!.definitionId];
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
      'target' in effect
        ? state.players.filter(
            (player) =>
              !player.eliminated &&
              !frame.ignoredPlayerIds.includes(player.id) &&
              (effect.target === 'ALL_PLAYERS' ||
                (effect.target === 'SELF' && player.id === frame.actorId) ||
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
        effect.op === 'TRANSFER_GOLD' &&
        player.id !== frame.actorId &&
        frame.actorId !== null &&
        !frame.ignoredPlayerIds.includes(frame.actorId)
      ) {
        affected.add(frame.actorId);
        deltas.push(
          { playerId: frame.actorId, stat: 'GOLD', delta: -effect.amount },
          { playerId: player.id, stat: 'GOLD', delta: effect.amount },
        );
      }
    }
  }
  return {
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
): boolean {
  switch (condition.kind) {
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
): boolean {
  return (
    (trigger.event === 'ANY' || trigger.event === context.sourceKind) &&
    trigger.alternatives.some((conditions) =>
      conditions.every((condition) =>
        conditionMatches(state, playerId, context, condition),
      ),
    )
  );
}
export interface LegalResponse {
  readonly cardId: CardInstanceId;
  readonly commandType: 'PLAY_RESPONSE';
  readonly requiresTarget: boolean;
  readonly legalTargetPlayerIds: readonly PlayerId[];
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
    if (definition.type === 'SOMETIMES') {
      if (definition.responseTrigger !== undefined) {
        if (
          !triggerMatches(state, playerId, context, definition.responseTrigger)
        )
          continue;
      } else {
        // Legacy pinned Ignore/Negate definitions have structural predicates.
        // An unspecified ordinary Sometimes is never a blanket permission.
        if (definition.responseKind === 'SOMETIMES') continue;
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
    const requiresTarget = hasChosenTarget(definition.effects);
    const candidates = requiresTarget
      ? state.players
          .filter((target) => !target.eliminated && target.id !== playerId)
          .map((target) => target.id)
      : [undefined];
    const targets: PlayerId[] = [];
    let valid = false;
    for (const target of candidates) {
      const candidate = {
        id: resolutionIdSchema.parse('resolution_legality'),
        kind: 'CARD' as const,
        actorId: playerId,
        sourceCardId: cardId,
        sourceRevealed: true,
        targetPlayerIds: target === undefined ? [] : [target],
        effects: JSON.parse(JSON.stringify(definition.effects)) as Effect[],
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
        commandType: 'PLAY_RESPONSE',
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
    .filter((player) => !player.eliminated)
    .map((player) => player.id);
}
