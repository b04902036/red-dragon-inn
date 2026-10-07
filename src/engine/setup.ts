import { z } from 'zod';
import { contentPackSchema } from '../content/pack';
import { cardInstanceSchema } from '../content/cards';
import type { CardInstance } from '../content/cards';
import {
  characterIdSchema,
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
  deckIdSchema,
} from '../shared/ids';
import type { CardInstanceId, DeckId } from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
import { assertCoreInvariants } from './invariants';
import { compareIds, matchNamespace } from './identity';
import { DEFAULT_RULES, rulesConfigSchema } from './rules';
import { seededRng } from './rng';
import type { CoreGameState } from './types';

export const matchSetupSchema = z.strictObject({
  roomId: roomIdSchema,
  matchId: matchIdSchema,
  hostPlayerId: playerIdSchema,
  content: contentPackSchema,
  publicNarrationVersion: z.literal(1).optional(),
  innDrinkDeckIds: z
    .array(deckIdSchema)
    .min(1)
    .max(8)
    .refine((ids) => new Set(ids).size === ids.length)
    .optional(),
  seed: z.number().int().min(0).max(0xffffffff),
  rules: rulesConfigSchema.prefault(DEFAULT_RULES),
  version: stateVersionSchema.default(stateVersionSchema.parse(0)),
  players: z
    .array(
      z.strictObject({
        id: playerIdSchema,
        characterId: characterIdSchema,
        seat: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
        displayName: z
          .string()
          .min(1)
          .max(80)
          .refine((s) => s.trim().length > 0),
      }),
    )
    .min(2)
    .max(4),
});
export type MatchSetup = z.input<typeof matchSetupSchema>;
/** Prepare a server-owned match; START_MATCH performs all random setup and emits events. */
export function createMatch(input: MatchSetup): CoreGameState {
  const setup = matchSetupSchema.parse(input);
  const pack = setup.content;
  const namespace = matchNamespace(setup.matchId);
  const cards: Record<CardInstanceId, CardInstance> = {};
  let ordinal = 0;
  function instantiate(
    deckId: DeckId,
    ownerId: CardInstance['ownerId'],
    zone: 'CHARACTER_DECK' | 'INN_DRINK_DECK',
  ) {
    const instances: CardInstanceId[] = [];
    const entries = pack.deckCards
      .filter((entry) => entry.deckId === deckId)
      .sort((a, b) => compareIds(a.cardId, b.cardId));
    for (const entry of entries)
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        const location =
          zone === 'INN_DRINK_DECK'
            ? { zone, deckId }
            : { zone, deckId, playerId: ownerId };
        const card = cardInstanceSchema.parse({
          id: `card_${namespace}_${ordinal++}`,
          definitionId: entry.cardId,
          ownerId,
          location,
        });
        cards[card.id] = card;
        instances.push(card.id);
      }
    if (instances.length > 256)
      throw new RangeError('Core deck exceeds 256 copies');
    return { deckId, cardIds: instances };
  }
  const players = [...setup.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => {
      const character = pack.characters.find(
        (character) => character.id === player.characterId,
      );
      const decks = pack.decks.filter(
        (deck) =>
          deck.characterId === player.characterId && deck.type === 'CHARACTER',
      );
      if (!character || decks.length !== 1)
        throw new RangeError('Character requires exactly one core deck');
      const deck = instantiate(decks[0]!.id, player.id, 'CHARACTER_DECK');
      if (deck.cardIds.length < setup.rules.handSize)
        throw new RangeError('Character deck cannot supply initial hand');
      return {
        ...player,
        traits: character.rules.traits ?? [],
        ...setup.rules.initialStats,
        eliminated: false,
        hand: [],
        characterDeck: deck,
        characterDiscard: [],
        drinkPile: [],
        special: {
          resources: Object.fromEntries(
            Object.entries(character.rules.resources).map(([key, resource]) => [
              key,
              { value: resource.initialValue, visibility: resource.visibility },
            ]),
          ),
          sideDecks: {},
        },
      };
    });
  const availableInnDecks = pack.decks.filter(
    (deck) => deck.type === 'INN_DRINK',
  );
  const innDecks =
    setup.innDrinkDeckIds === undefined
      ? availableInnDecks
      : setup.innDrinkDeckIds.map((id) =>
          availableInnDecks.find((deck) => deck.id === id),
        );
  if (
    innDecks.some((deck) => deck === undefined) ||
    (setup.innDrinkDeckIds === undefined && innDecks.length !== 1)
  )
    throw new RangeError('Match requires an explicit valid Inn deck selection');
  const innDrinkDeck = instantiate(innDecks[0]!.id, null, 'INN_DRINK_DECK');
  for (const deck of innDecks.slice(1)) {
    const additional = instantiate(deck!.id, null, 'INN_DRINK_DECK');
    for (const id of additional.cardIds)
      cards[id]!.location = {
        zone: 'INN_DRINK_DECK',
        deckId: innDrinkDeck.deckId,
      };
    innDrinkDeck.cardIds.push(...additional.cardIds);
  }
  if (innDrinkDeck.cardIds.length > 256)
    throw new RangeError('Bar deck exceeds 256 copies');
  if (
    innDrinkDeck.cardIds.length <
    players.length * setup.rules.initialDrinkCount
  )
    throw new RangeError('Inn deck cannot supply initial drinks');
  const state: CoreGameState = {
    schemaVersion: 1,
    ...(setup.publicNarrationVersion === undefined
      ? {}
      : { publicNarrationVersion: setup.publicNarrationVersion }),
    roomId: setup.roomId,
    matchId: setup.matchId,
    version: setup.version,
    lifecycle: 'SETUP',
    phase: null,
    activePlayerId: null,
    players,
    cards,
    innDrinkDeck,
    ...(innDecks.length > 1 ? { barDrinkDeck: [] } : {}),
    innDrinkDiscard: [],
    gambling: null,
    resolutionStack: [],
    responseWindow: null,
    rng: seededRng(setup.seed),
    winners: [],
    contentVersionId: pack.version.id,
    rules: setup.rules,
    definitions: Object.fromEntries(pack.cards.map((card) => [card.id, card])),
    initialCardCount: ordinal,
    control: {
      hostPlayerId: setup.hostPlayerId,
      turnNumber: 0,
      eliminationCheckPending: false,
      timedPrompt: null,
      phaseEnd: null,
      acceptedCommands: {},
    },
  };
  assertCoreInvariants(state);
  return state;
}
