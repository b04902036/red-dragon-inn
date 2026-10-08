import type { DomainEvent } from './events';
import {
  publicNarrationEventSchema,
  type PublicNarrationEvent,
  type NarrationRelation,
} from './public-narration';
import type {
  PlayerId,
  ResolutionId,
  CardInstanceId,
  CardDefinitionId,
} from '../shared/ids';

type Frame = NonNullable<DomainEvent['narration']>['frames'][number];
export interface PublicNarrationContext {
  frames: Record<string, Frame>;
  playedCards: Record<string, ResolutionId>;
  revealedDrinks: Record<string, CardDefinitionId>;
  lastSequence: number;
}
export const emptyNarrationContext = (): PublicNarrationContext => ({
  frames: {},
  playedCards: {},
  revealedDrinks: {},
  lastSequence: 0,
});
type StoredEvent = { readonly sequence: number; readonly event: DomainEvent };
type PublicPayload = PublicNarrationEvent extends infer Event
  ? Event extends PublicNarrationEvent
    ? Omit<Event, 'id' | 'matchId' | 'sequence' | 'stateVersion' | 'eventIndex'>
    : never
  : never;
function relation(frame: Frame | undefined): NarrationRelation {
  if (frame?.operations.includes('NEGATE')) return 'NEGATES';
  if (frame?.operations.includes('IGNORE')) return 'IGNORES';
  if (frame?.operations.includes('REDIRECT_FORTITUDE_LOSS')) return 'REDIRECTS';
  if (
    frame?.operations.some((op) =>
      [
        'MODIFY_DRINK',
        'MODIFY_PENDING_EFFECT',
        'REPLACE_DRINK_BASE',
        'SHARE_FORTITUDE_LOSS',
      ].includes(op),
    )
  )
    return 'MODIFIES';
  return 'RESPONDS_TO';
}
/** Server-only correlation. Internal physical IDs never become public output fields. */
export function projectPublicNarration(
  batch: readonly StoredEvent[],
  previous: PublicNarrationContext = emptyNarrationContext(),
  publicResourceKeys: ReadonlyMap<PlayerId, ReadonlySet<string>> = new Map(),
) {
  const context = {
    frames: { ...previous.frames },
    playedCards: { ...previous.playedCards },
    revealedDrinks: { ...previous.revealedDrinks },
    lastSequence: previous.lastSequence,
  };
  let lastSequence = context.lastSequence;
  for (const { sequence, event } of batch) {
    if (!Number.isSafeInteger(sequence) || sequence !== lastSequence + 1)
      throw new RangeError('Narration sequence gap or duplicate ordering');
    lastSequence = sequence;
    for (const frame of event.narration?.frames ?? [])
      context.frames[frame.resolutionId] = frame;
    if (event.type === 'RESOLUTION_STARTED' && event.cardId !== null)
      context.playedCards[event.cardId] = event.resolutionId;
    if (event.type === 'DRINK_REVEALED')
      context.revealedDrinks[event.cardId] = event.definitionId;
  }
  context.lastSequence = lastSequence;
  const publicResolution = (id: ResolutionId | null): ResolutionId | null => {
    const seen = new Set<string>();
    while (
      id !== null &&
      context.frames[id]?.kind === 'SYSTEM' &&
      !seen.has(id)
    ) {
      seen.add(id);
      id = context.frames[id]!.parentId;
    }
    return id;
  };
  const events: PublicNarrationEvent[] = [];
  for (const { sequence, event } of batch) {
    if (event.matchId === null) continue;
    const resolutionId = publicResolution(
      event.narration?.resolutionId ??
        ('resolutionId' in event ? (event.resolutionId ?? null) : null),
    );
    const frame =
      resolutionId === null ? undefined : context.frames[resolutionId];
    const cause = {
      resolutionId,
      parentId: publicResolution(frame?.parentId ?? null),
    };
    const push = (payload: PublicPayload) =>
      events.push(
        publicNarrationEventSchema.parse({
          ...payload,
          id: `${event.matchId}:${sequence}`,
          matchId: event.matchId,
          sequence,
          stateVersion: event.stateVersion,
          eventIndex: event.eventIndex,
        }),
      );
    switch (event.type) {
      case 'CHALLENGE_DECIDED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          accepted: event.accepted,
        });
        break;
      case 'MATCH_STARTED':
        push({
          type: event.type,
          playerIds: event.playerIds,
          activePlayerId: event.activePlayerId,
        });
        break;
      case 'TURN_STARTED':
        push({
          type: event.type,
          playerId: event.playerId,
          turnNumber: event.turnNumber,
        });
        break;
      case 'PHASE_CHANGED':
        push({
          type: event.type,
          playerId: event.activePlayerId,
          phase: event.phase,
        });
        break;
      case 'MATCH_FINISHED':
        push({ type: event.type, winnerIds: event.winnerIds });
        break;
      case 'PLAYER_ELIMINATED':
        push({
          type: event.type,
          playerId: event.playerId,
          reason: event.reason,
        });
        break;
      case 'CARDS_DRAWN':
        push({
          type: 'CHARACTER_CARDS_DRAWN',
          ...cause,
          playerId: event.playerId,
          count: event.cardIds.length,
        });
        break;
      case 'CARDS_DISCARDED':
        push({
          type: 'CHARACTER_CARDS_DISCARDED',
          ...cause,
          playerId: event.playerId,
          count: event.cardIds.length,
        });
        break;
      case 'CARD_PLAYED': {
        const id = context.playedCards[event.cardId as CardInstanceId] ?? null;
        const card = id === null ? undefined : context.frames[id];
        push({
          type: event.type,
          playerId: event.playerId,
          cardDefinitionId: event.definitionId,
          ...(event.presentationVariantId === undefined
            ? {}
            : { presentationVariantId: event.presentationVariantId }),
          resolutionId: id,
          parentId: publicResolution(card?.parentId ?? null),
          targetPlayerIds: card?.targetPlayerIds ?? [],
          responseRelation: card?.parentId ? relation(card) : null,
        });
        break;
      }
      case 'RESOLUTION_STARTED':
        push({
          type: event.type,
          resolutionId: event.resolutionId,
          parentId: publicResolution(event.parentId),
          playerId: event.playerId,
        });
        break;
      case 'RESOLUTION_COMPLETED':
        if (context.frames[event.resolutionId]?.kind === 'SYSTEM') break;
        push({
          type: event.type,
          ...cause,
          resolutionId: event.resolutionId,
          canceled: event.canceled,
        });
        break;
      case 'SOURCE_NEGATED':
        push({
          type: 'RELATION_RESOLVED',
          relation: 'NEGATES',
          sourceResolutionId: event.byResolutionId,
          targetResolutionId: event.resolutionId,
          playerId: context.frames[event.byResolutionId]?.playerId ?? null,
        });
        break;
      case 'SOURCE_IGNORED':
        push({
          type: 'RELATION_RESOLVED',
          relation: 'IGNORES',
          sourceResolutionId:
            event.narration?.frames.at(-1)?.resolutionId ?? null,
          targetResolutionId: event.resolutionId,
          playerId: event.playerId,
        });
        break;
      case 'DRINK_ORDERED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          targetPlayerId: event.targetPlayerId,
          count: 1,
        });
        break;
      case 'DRINK_DEALT':
        if (event.cardIds.length)
          push({
            type: event.type,
            ...cause,
            playerId: event.playerId,
            count: event.cardIds.length,
          });
        break;
      case 'DRINK_REVEALED':
        push({
          type: event.type,
          ...cause,
          parentId: publicResolution(
            event.parentResolutionId ?? cause.parentId,
          ),
          playerId: event.playerId,
          cardDefinitionId: event.definitionId,
          chainRole:
            event.chainPosition === undefined
              ? 'LEGACY'
              : event.chainPosition === 0
                ? 'BASE'
                : 'CHASER',
          chainPosition: event.chainPosition ?? null,
          hasChaser: event.hasChaser ?? null,
          source: event.source ?? null,
        });
        break;
      case 'DRINK_CHAIN_STOPPED':
        push({ type: event.type, ...cause, reason: event.reason });
        break;
      case 'DRINK_EMPTY':
        push({ type: event.type, ...cause, playerId: event.playerId });
        break;
      case 'FORTITUDE_CHANGED':
      case 'ALCOHOL_CHANGED':
      case 'GOLD_CHANGED':
        if (event.delta === 0) break;
        push({
          type: 'STAT_CHANGED',
          ...cause,
          playerId: event.playerId,
          stat:
            event.type === 'FORTITUDE_CHANGED'
              ? 'FORTITUDE'
              : event.type === 'ALCOHOL_CHANGED'
                ? 'ALCOHOL'
                : 'GOLD',
          before: event.value - event.delta,
          after: event.value,
          delta: event.delta,
        });
        break;
      case 'DRINK_MODIFIED':
        push({
          type: event.type,
          ...cause,
          sourceResolutionId:
            event.narration?.frames.at(-1)?.resolutionId ?? null,
          alcoholDelta: event.alcoholDelta,
          fortitudeDelta: event.fortitudeDelta,
        });
        break;
      case 'PENDING_EFFECT_MODIFIED':
        push({
          type: 'EFFECT_MODIFIED',
          ...cause,
          sourceResolutionId:
            event.narration?.frames.at(-1)?.resolutionId ?? null,
          effectIndex: event.effectIndex,
          delta: event.delta,
        });
        break;
      case 'DRINK_EVENT_DISCARDED': {
        const definition = context.revealedDrinks[event.cardId];
        if (definition !== undefined)
          push({
            type: event.type,
            ...cause,
            playerId: event.playerId,
            cardDefinitionId: definition,
            context: event.context,
          });
        break;
      }
      case 'RESPONSE_PASSED':
        push({
          type: 'PRIORITY_PASSED',
          ...cause,
          playerId: event.playerId,
          kind: 'RESPONSE',
        });
        break;
      case 'ANYTIME_PASSED':
        push({
          type: 'PRIORITY_PASSED',
          ...cause,
          playerId: event.playerId,
          kind: 'PHASE_END',
        });
        break;
      case 'GOLD_REDISTRIBUTED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          amount: event.amount,
          innGold: event.innGold,
          payments: event.payments,
        });
        break;
      case 'GAMBLING_WIN_REQUESTED':
        push({
          type: 'GAMBLING_WINNER_PENDING',
          ...cause,
          playerId: event.playerId,
        });
        break;
      case 'RESOURCE_CHANGED':
        if (
          event.delta !== 0 &&
          publicResourceKeys.get(event.playerId)?.has(event.resource)
        )
          push({
            type: event.type,
            ...cause,
            playerId: event.playerId,
            resource: event.resource,
            before: event.value - event.delta,
            after: event.value,
            delta: event.delta,
          });
        break;
      case 'GAMBLING_STARTED':
        push({
          type: event.type,
          ...cause,
          playerId: event.initiatorPlayerId,
          participants: event.participants,
          ante: event.anteAmount,
          pot: event.pot,
        });
        break;
      case 'GAMBLING_ANTE_PAID':
        push({
          type: 'GAMBLING_ANTE',
          ...cause,
          playerId: event.playerId,
          amount: event.amount,
        });
        break;
      case 'GAMBLING_RAISED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          amount: event.amount,
        });
        break;
      case 'PAYMENT_SETTLED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          recipientPlayerId: event.recipientPlayerId,
          destination: event.destination,
          amount: event.amount,
          payerAmount: event.payerAmount,
          innSubstitution: event.innSubstitution,
        });
        break;
      case 'GAMBLING_CONTROL_CHANGED':
        push({
          type: event.type,
          ...cause,
          playerId: event.playerId,
          allowedControlCategories: event.allowedControlCategories,
        });
        break;
      case 'GAMBLING_PASSED':
        push({ type: 'GAMBLING_PASSED', ...cause, playerId: event.playerId });
        break;
      case 'GAMBLING_PLAYER_LEFT':
        push({
          type: 'GAMBLING_PLAYER_LEFT',
          ...cause,
          playerId: event.playerId,
        });
        break;
      case 'GAMBLING_FINISHED':
        push({
          type: 'GAMBLING_PAYOUT',
          ...cause,
          playerId: event.winnerPlayerId,
          amount: event.pot,
          destination: 'WINNER',
        });
        break;
      case 'DRINK_CONTEST_ROUND_STARTED':
        push({
          type: 'CONTEST_ROUND_STARTED',
          ...cause,
          round: event.round,
          playerIds: event.playerIds,
        });
        break;
      case 'DRINK_CONTEST_RESULT':
        push({
          type: 'CONTEST_RESULT',
          ...cause,
          round: event.round,
          scores: event.scores,
          highestScore: event.highestScore,
          winnerIds: event.winnerIds,
        });
        break;
      case 'WORKFLOW_CHANGED': {
        const candidate = {
          ...cause,
          type: 'PUBLIC_EFFECT_CHANGED',
          operation: event.operation,
          playerId: event.playerId,
          amount: event.amount,
        };
        const parsed = publicNarrationEventSchema.safeParse({
          ...candidate,
          id: `${event.matchId}:${sequence}`,
          matchId: event.matchId,
          sequence,
          stateVersion: event.stateVersion,
          eventIndex: event.eventIndex,
        });
        if (parsed.success) events.push(parsed.data);
        break;
      }
      default:
        break;
    }
  }
  return { events, context };
}
