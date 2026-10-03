import type { Effect } from '../content/effects';
import type { CardInstanceId, PlayerId } from '../shared/ids';
import { resolutionIdSchema } from '../shared/ids';
import { matchNamespace } from './identity';
import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import type { RandomSource } from './rng';
import { drawFromPiles } from './decks';
import { requireCommand } from './errors';

export function drinkModifierEffects(
  frame: MutableGameState['resolutionStack'][number],
  allowEvents: boolean | undefined,
) {
  requireCommand(
    frame.kind === 'DRINK' ||
      (frame.kind === 'DRINK_EVENT' && allowEvents === true),
    'ILLEGAL_TIMING',
  );
  const find = (stat: 'ALCOHOL' | 'FORTITUDE') =>
    frame.effects.find(
      (effect) =>
        effect.op === 'CHANGE_STAT' &&
        effect.target === 'SELF' &&
        effect.stat === stat,
    );
  const alcohol = find('ALCOHOL');
  const fortitude = find('FORTITUDE');
  requireCommand(
    alcohol?.op === 'CHANGE_STAT' && fortitude?.op === 'CHANGE_STAT',
    'INVALID_EFFECT',
  );
  return { alcohol, fortitude };
}

/** Reveal a complete, bounded compound source before opening any response window. */
export function buildDrinkFrame(
  state: MutableGameState,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
) {
  const player = state.players.find((entry) => entry.id === actorId)!;
  const id = resolutionIdSchema.parse(
    `resolution_${matchNamespace(state.matchId)}_${state.version}`,
  );
  const cards: CardInstanceId[] = [];
  const effects: Effect[] = [];
  let alcohol = 0,
    fortitude = 0;
  let kind: 'DRINK' | 'DRINK_EVENT' = 'DRINK';
  let source: 'DRINK_PILE' | 'INN' = 'DRINK_PILE';
  const reveal = () => {
    let cardId: CardInstanceId | undefined;
    if (source === 'DRINK_PILE') cardId = player.drinkPile.shift();
    else {
      const draw = drawFromPiles(
        state.innDrinkDeck.cardIds,
        state.innDrinkDiscard,
        1,
        state.rng,
        rng,
      );
      state.innDrinkDeck.cardIds = draw.deck;
      state.innDrinkDiscard = draw.discard;
      state.rng = draw.rng;
      for (const step of draw.steps)
        if (step.kind === 'RESHUFFLE') {
          for (const card of step.cardIds)
            state.cards[card]!.location = {
              zone: 'INN_DRINK_DECK',
              deckId: state.innDrinkDeck.deckId,
            };
          emit({
            type: 'DECK_SHUFFLED',
            deckId: state.innDrinkDeck.deckId,
            playerId: null,
            reason: 'EXHAUSTED',
            cardIds: step.cardIds,
          });
        }
      cardId = draw.drawn[0];
    }
    if (cardId === undefined) return null;
    cards.push(cardId);
    state.cards[cardId]!.location = { zone: 'RESOLUTION', resolutionId: id };
    const definition = state.definitions[state.cards[cardId]!.definitionId]!;
    emit({
      type: 'DRINK_REVEALED',
      playerId: actorId,
      cardId,
      definitionId: definition.id,
    });
    requireCommand(
      definition.type === 'DRINK' || definition.type === 'DRINK_EVENT',
      'INVALID_EFFECT',
    );
    return definition;
  };
  let definition = reveal();
  if (definition === null) {
    emit({
      type: 'DRINK_EMPTY',
      playerId: actorId,
      rule: state.rules.drinks.emptyPile,
    });
    alcohol =
      state.rules.drinks.emptyPile === 'SOBER'
        ? -state.rules.drinks.soberAmount
        : 0;
  } else if (definition.type === 'DRINK_EVENT') {
    kind = 'DRINK_EVENT';
    effects.push(...definition.effects);
  } else {
    while (definition !== null) {
      if (definition.type === 'DRINK_EVENT') {
        emit({
          type: 'DRINK_EVENT_DISCARDED',
          playerId: actorId,
          cardId: cards.at(-1)!,
          context: 'CHASER',
        });
        if (state.rules.drinks.chaserEvent === 'DISCARD_STOP') {
          emit({
            type: 'DRINK_CHAIN_STOPPED',
            resolutionId: id,
            reason: 'EVENT',
          });
          break;
        }
      } else {
        alcohol += definition.alcoholContent;
        fortitude += definition.fortitudeChange;
        effects.push(...definition.effects);
        if (!definition.chaser) break;
        if (
          (definition.chaserSource ?? state.rules.drinks.chaserSource) === 'INN'
        )
          source = 'INN';
      }
      if (cards.length >= state.rules.drinks.maxChainCards) {
        emit({
          type: 'DRINK_CHAIN_STOPPED',
          resolutionId: id,
          reason: 'LIMIT',
        });
        break;
      }
      definition = reveal();
      if (definition === null)
        emit({
          type: 'DRINK_CHAIN_STOPPED',
          resolutionId: id,
          reason: 'EMPTY_SOURCE',
        });
    }
  }
  if (kind === 'DRINK')
    effects.unshift(
      { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: alcohol },
      {
        op: 'CHANGE_STAT',
        target: 'SELF',
        stat: 'FORTITUDE',
        delta: fortitude,
      },
    );
  requireCommand(effects.length <= 32, 'INVALID_EFFECT');
  emit({
    type: 'DRINK_QUEUED',
    playerId: actorId,
    resolutionId: id,
    cardIds: cards,
    kind,
  });
  return {
    id,
    kind,
    actorId,
    sourceCardId: cards[0] ?? null,
    sourceCardIds: cards,
    sourceRevealed: true,
    targetPlayerIds: [],
    effects,
    nextEffectIndex: 0,
    parentId: null,
    stage: 'RESPONSES' as const,
    canceled: false,
    ignoredPlayerIds: [],
    window: null,
    continuation: 'ELIMINATION_CHECK' as const,
    selectedOptionId: null,
  };
}
