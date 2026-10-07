import type { PublicNarrationEvent } from '../protocol/public-narration';
import type { Presentation } from '../protocol/presentation';
import type { PublicGameView } from '../protocol/views';
import type { Locale } from '../shared/locales';
import { formatMessage } from '../shared/ui-messages';
import { phaseName } from './room-state';

export function timelineText(
  event: PublicNarrationEvent,
  history: readonly PublicNarrationEvent[],
  view: PublicGameView,
  presentation: Presentation,
  locale: Locale,
) {
  const t = (
    key: Parameters<typeof formatMessage>[1],
    values: Parameters<typeof formatMessage>[2] = {},
  ) => formatMessage(locale, key, values);
  const player = (id: string | null) =>
    view.players.find((p) => p.id === id)?.displayName ?? t('table.none');
  const names = (ids: readonly string[]) => ids.map(player).join(', ');
  const cardName = (id: string) =>
    presentation.cards.find((card) => card.id === id)?.name ?? id;
  const resolutionName = (id: string | null): string => {
    if (id === null) return t('table.card');
    const source = history.find(
      (item) =>
        (item.type === 'CARD_PLAYED' || item.type === 'DRINK_REVEALED') &&
        item.resolutionId === id,
    );
    if (source && 'cardDefinitionId' in source)
      return cardName(source.cardDefinitionId);
    const round = history.find(
      (item) =>
        item.type === 'CONTEST_ROUND_STARTED' && item.resolutionId === id,
    );
    return round ? t('timeline.contest') : t('table.card');
  };
  const sign = (amount: number) => (amount > 0 ? `+${amount}` : String(amount));
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(event))
    if (typeof value === 'number') values[key] = value;
  if ('playerId' in event) values.name = player(event.playerId);
  if ('resolutionId' in event) values.card = resolutionName(event.resolutionId);
  if ('cardDefinitionId' in event)
    values.card = cardName(event.cardDefinitionId);
  if ('parentId' in event)
    values.context = event.parentId
      ? t('timeline.cause', { card: resolutionName(event.parentId) })
      : '';
  if ('targetPlayerIds' in event)
    values.targets = event.targetPlayerIds.length
      ? t('timeline.target', { names: names(event.targetPlayerIds) })
      : '';
  switch (event.type) {
    case 'MATCH_FINISHED':
      values.winners = event.winnerIds.length
        ? names(event.winnerIds)
        : t('table.tie');
      break;
    case 'PHASE_CHANGED':
      values.phase = phaseName(event.phase, locale);
      break;
    case 'PLAYER_ELIMINATED':
      values.reason = t(`timeline.${event.reason}`);
      break;
    case 'CARD_PLAYED':
      values.response =
        event.responseRelation && event.parentId
          ? t('timeline.response', {
              relation: t(`timeline.${event.responseRelation}`),
              card: resolutionName(event.parentId),
            })
          : '';
      break;
    case 'RESOLUTION_COMPLETED':
      values.result = t(
        event.canceled ? 'timeline.negated' : 'timeline.resolved',
      );
      break;
    case 'RELATION_RESOLVED':
      values.source = resolutionName(event.sourceResolutionId);
      values.card = resolutionName(event.targetResolutionId);
      values.relation = t(`timeline.${event.relation}`);
      values.targets =
        event.relation === 'IGNORES'
          ? t('timeline.target', { names: player(event.playerId) })
          : '';
      break;
    case 'DRINK_ORDERED':
      values.target = player(event.targetPlayerId);
      break;
    case 'DRINK_REVEALED':
      values.role =
        t(`timeline.${event.chainRole}`) +
        (event.hasChaser === true ? t('timeline.hasChaser') : '');
      break;
    case 'DRINK_CHAIN_STOPPED':
      values.reason = t(`timeline.${event.reason}`);
      break;
    case 'DRINK_MODIFIED':
      values.source = resolutionName(event.sourceResolutionId);
      values.alcohol = sign(event.alcoholDelta);
      values.fortitude = sign(event.fortitudeDelta);
      break;
    case 'EFFECT_MODIFIED':
      values.source = resolutionName(event.sourceResolutionId);
      values.effectIndex = event.effectIndex + 1;
      values.delta = sign(event.delta);
      break;
    case 'STAT_CHANGED':
      values.stat = t(
        event.stat === 'FORTITUDE'
          ? 'player.fortitude'
          : event.stat === 'ALCOHOL'
            ? 'player.alcohol'
            : 'player.gold',
      );
      values.delta = sign(event.delta);
      values.context = event.resolutionId
        ? t('timeline.cause', { card: resolutionName(event.resolutionId) })
        : '';
      break;
    case 'RESOURCE_CHANGED':
      values.resource =
        presentation.mechanics?.find((item) => item.id === event.resource)
          ?.name ?? event.resource;
      values.delta = sign(event.delta);
      break;
    case 'GOLD_REDISTRIBUTED':
      values.payments = event.payments
        .map((item) => `${player(item.playerId)} ${item.amount}`)
        .join(', ');
      break;
    case 'GAMBLING_STARTED':
      values.participants = names(event.participants);
      break;
    case 'PAYMENT_SETTLED':
      values.target =
        event.destination === 'INN'
          ? t('table.inn')
          : event.destination === 'POT'
            ? t('table.pot')
            : player(event.recipientPlayerId);
      values.substitution = event.innSubstitution
        ? t('timeline.substitution', { amount: event.innSubstitution })
        : '';
      break;
    case 'CONTEST_ROUND_STARTED':
      values.participants = names(event.playerIds);
      values.roundLabel = t(
        event.round === 1 ? 'timeline.round' : 'timeline.tiebreak',
      );
      break;
    case 'CONTEST_RESULT':
      values.scores = event.scores
        .map((score) => `${player(score.playerId)} ${score.score}`)
        .join(', ');
      values.result =
        event.winnerIds.length > 1
          ? t('timeline.tie', { winners: names(event.winnerIds) })
          : event.winnerIds.length
            ? t('timeline.winner', { winners: names(event.winnerIds) })
            : t('timeline.noWinner');
      break;
    case 'CHALLENGE_DECIDED':
      values.decision = t(
        event.accepted ? 'timeline.ACCEPT' : 'timeline.DECLINE',
      );
      break;
    case 'PUBLIC_EFFECT_CHANGED':
      values.operation = t(`timeline.effect.${event.operation}`);
      values.targets = event.playerId
        ? t('timeline.target', { names: player(event.playerId) })
        : '';
      break;
    default:
      break;
  }
  return t(`timeline.${event.type}`, values);
}

/** Parent links are public facts; preserve chronology while indenting causal depth. */
export function timelineDepth(
  event: PublicNarrationEvent,
  history: readonly PublicNarrationEvent[],
) {
  const parentById = new Map(
    history
      .filter((item) => 'resolutionId' in item && item.resolutionId)
      .map((item) => [
        'resolutionId' in item ? item.resolutionId : null,
        'parentId' in item ? item.parentId : null,
      ]),
  );
  let id =
    'parentId' in event
      ? event.parentId
      : event.type === 'RELATION_RESOLVED'
        ? event.targetResolutionId
        : null;
  let depth = 0;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    depth++;
    id = parentById.get(id) ?? null;
  }
  return depth;
}
