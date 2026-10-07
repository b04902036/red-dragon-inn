import type { Effect } from '../content/effects';
import type { CardInstanceId, PlayerId, ResolutionId } from '../shared/ids';
import { resolutionIdSchema } from '../shared/ids';
import { matchNamespace } from './identity';
import type { MutableGameState } from './types';
import type { EmitEvent } from './event-writer';
import type { RandomSource } from './rng';
import { drawInnDrinks } from './inn-deck';
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
  options: {
    source?: 'DRINK_PILE' | 'INN';
    skipEvents?: boolean;
    id?: ResolutionId;
    payForRefill?: boolean;
    allowBuiltInSplit?: boolean;
  } = {},
) {
  const player = state.players.find((entry) => entry.id === actorId)!;
  const id =
    options.id ??
    resolutionIdSchema.parse(
      `resolution_${matchNamespace(state.matchId)}_${state.version}`,
    );
  const cards: CardInstanceId[] = [];
  const effects: Effect[] = [];
  let alcohol = 0,
    fortitude = 0;
  let kind: 'DRINK' | 'DRINK_EVENT' = 'DRINK';
  let source: 'DRINK_PILE' | 'INN' = options.source ?? 'DRINK_PILE';
  const reveal = () => {
    let cardId: CardInstanceId | undefined;
    if (source === 'DRINK_PILE') cardId = player.drinkPile.shift();
    else {
      cardId = drawInnDrinks(
        state,
        1,
        emit,
        rng,
        options.payForRefill === true,
      )[0];
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
  if (options.skipEvents) {
    let skipped = 0;
    while (
      definition?.type === 'DRINK_EVENT' &&
      skipped < state.rules.drinks.maxChainCards
    ) {
      const skippedCard = cards.pop()!;
      state.innDrinkDiscard.push(skippedCard);
      state.cards[skippedCard]!.location = {
        zone: 'INN_DRINK_DISCARD',
        deckId: state.innDrinkDeck.deckId,
      };
      emit({
        type: 'DRINK_EVENT_DISCARDED',
        playerId: actorId,
        cardId: skippedCard,
        context: 'SOURCE_SELECTION',
      });
      skipped++;
      definition = reveal();
    }
    requireCommand(definition?.type !== 'DRINK_EVENT', 'INVALID_EFFECT');
  }
  const initialDefinition = definition;
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
        const replacement = definition.traitReplacements?.find((r) =>
          player.traits?.includes(r.trait),
        );
        alcohol += replacement?.alcoholContent ?? definition.alcoholContent;
        fortitude += replacement?.fortitudeChange ?? definition.fortitudeChange;
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
    ...(kind === 'DRINK' ? { drinkBase: { alcohol, fortitude } } : {}),
    ...(initialDefinition?.type === 'DRINK' && initialDefinition.builtInSplit
      ? {
          noExternalSplit: true,
          builtInSplitAvailable: options.allowBuiltInSplit !== false,
        }
      : {}),
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
