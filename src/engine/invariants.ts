import { z } from 'zod';
import {
  cardDefinitionSchema,
  cardInstanceSchema,
  cardLocationSchema,
} from '../content/cards';
import type { CardInstance } from '../content/cards';
import {
  cardInstanceIdSchema,
  commandIdSchema,
  contentVersionIdSchema,
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../shared/ids';
import { stateVersionSchema } from '../shared/version';
import { clientCommandSchema } from '../protocol/commands';
import { MATCH_LIFECYCLES, TURN_PHASES } from './model';
import { rulesConfigSchema } from './rules';
import { rngStateSchema } from './rng';
import type { CoreGameState } from './types';
import { assertResolutionState } from './resolution-state';
import { assertGamblingState } from './gambling-state';
import { systemActionSchema } from './system-actions';
import { timedPromptSchema, phaseEndSchema } from './timed-prompts';
import { traitSchema } from '../content/mechanics';
const acceptedCommandSchema = z.union([
  clientCommandSchema,
  systemActionSchema,
]);

function requireInvariant(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new RangeError(`Engine invariant: ${message}`);
}
const safeInteger = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
export function assertCoreInvariants(state: CoreGameState): void {
  roomIdSchema.parse(state.roomId);
  matchIdSchema.parse(state.matchId);
  contentVersionIdSchema.parse(state.contentVersionId);
  stateVersionSchema.parse(state.version);
  rngStateSchema.parse(state.rng);
  z.literal(1).parse(state.schemaVersion);
  z.enum(MATCH_LIFECYCLES).parse(state.lifecycle);
  const rules = rulesConfigSchema.parse(state.rules);
  z.number().int().min(2).max(4).parse(state.players.length);
  requireInvariant(
    new Set(state.players.map((p) => p.id)).size === state.players.length,
    'duplicate player',
  );
  requireInvariant(
    new Set(state.players.map((p) => p.seat)).size === state.players.length,
    'duplicate seat',
  );
  const ids = new Set(state.players.map((p) => playerIdSchema.parse(p.id)));
  assertResolutionState(state);
  assertGamblingState(state);
  requireInvariant(ids.has(state.control.hostPlayerId), 'host is not a player');
  safeInteger.nonnegative().parse(state.control.turnNumber);
  if (state.control.resolutionOrdinal !== undefined)
    safeInteger.nonnegative().parse(state.control.resolutionOrdinal);
  if (state.control.normalOrderDone !== undefined)
    z.boolean().parse(state.control.normalOrderDone);
  if (state.control.phaseOpportunityKey !== undefined)
    z.string().max(128).parse(state.control.phaseOpportunityKey);
  if (state.control.phaseEnd !== null) {
    const grace = phaseEndSchema.parse(state.control.phaseEnd);
    requireInvariant(
      state.lifecycle === 'PLAYING' &&
        grace.phase === state.phase &&
        grace.origin === state.activePlayerId &&
        grace.passedPlayerIds.every((id) => ids.has(id)),
      'invalid phase-end window',
    );
    requireInvariant(
      grace.priorityPlayerId === null ||
        (ids.has(grace.priorityPlayerId) &&
          !grace.passedPlayerIds.includes(grace.priorityPlayerId)),
      'invalid phase-end priority',
    );
  }
  if (state.control.timedPrompt !== null) {
    const prompt = timedPromptSchema.parse(state.control.timedPrompt);
    requireInvariant(
      ids.has(prompt.priorityPlayerId) && state.lifecycle === 'PLAYING',
      'invalid prompt player',
    );
    requireInvariant(
      (prompt.deadlineAt === null) ===
        (rules.timing.turnOwnerUntimed === true &&
          prompt.priorityPlayerId === state.activePlayerId),
      'invalid turn-owner deadline',
    );
    requireInvariant(
      prompt.kind === 'RESPONSE_DECISION'
        ? state.responseWindow?.id === prompt.windowId &&
            state.responseWindow.priorityPlayerId === prompt.priorityPlayerId
        : state.control.phaseEnd?.id === prompt.windowId &&
            state.control.phaseEnd.priorityPlayerId === prompt.priorityPlayerId,
      'prompt does not match priority',
    );
  }
  if (state.lifecycle === 'PLAYING') {
    z.enum(TURN_PHASES).parse(state.phase);
    requireInvariant(
      state.players.some((p) => p.id === state.activePlayerId && !p.eliminated),
      'exactly one living active player required',
    );
    requireInvariant(
      state.control.turnNumber > 0,
      'playing turn number must be positive',
    );
  } else
    requireInvariant(
      state.activePlayerId === null && state.phase === null,
      'inactive match has an active turn',
    );
  if (state.lifecycle === 'FINISHED')
    requireInvariant(
      state.winners.length <= 1 &&
        state.gambling === null &&
        state.resolutionStack.length === 0 &&
        state.responseWindow === null &&
        JSON.stringify(state.winners) ===
          JSON.stringify(
            state.players
              .filter((player) => !player.eliminated)
              .map((player) => player.id),
          ),
      'invalid finished match',
    );
  for (const player of state.players) {
    z.array(traitSchema)
      .max(16)
      .parse(player.traits ?? []);
    z.number().int().min(0).max(3).parse(player.seat);
    z.string().min(1).max(80).parse(player.displayName);
    z.boolean().parse(player.eliminated);
    for (const stat of ['fortitude', 'alcoholContent', 'gold'] as const) {
      const value = safeInteger.parse(player[stat]);
      const bounds = rules.statBounds[stat];
      requireInvariant(stat !== 'gold' || value >= 0, 'Gold is negative');
      requireInvariant(
        bounds === null || (value >= bounds.min && value <= bounds.max),
        `${stat} is outside bounds`,
      );
    }
    requireInvariant(
      player.hand.length <= rules.handSize,
      'hand exceeds configured size',
    );
  }
  for (const [key, definition] of Object.entries(state.definitions))
    requireInvariant(
      cardDefinitionSchema.parse(definition).id === key,
      'definition key mismatch',
    );
  const registry = Object.fromEntries(
    Object.entries(state.cards).map(([key, value]) => {
      const card = cardInstanceSchema.parse(value);
      requireInvariant(
        key === card.id && state.definitions[card.definitionId] !== undefined,
        'invalid card registry',
      );
      return [key, card];
    }),
  );
  requireInvariant(
    Object.keys(registry).length === state.initialCardCount,
    'card conservation failed',
  );
  const seen = new Set<string>();
  const locate = (
    cardId: string,
    ownerId: CardInstance['ownerId'],
    location: CardInstance['location'],
  ) => {
    cardInstanceIdSchema.parse(cardId);
    const card = registry[cardId];
    requireInvariant(
      card !== undefined && !seen.has(cardId),
      'card missing or in multiple zones',
    );
    requireInvariant(
      card.ownerId === ownerId &&
        JSON.stringify(card.location) ===
          JSON.stringify(cardLocationSchema.parse(location)),
      'card ownership/location mismatch',
    );
    seen.add(cardId);
  };
  for (const p of state.players) {
    for (const id of p.hand) locate(id, p.id, { zone: 'HAND', playerId: p.id });
    for (const id of p.characterDeck.cardIds)
      locate(id, p.id, {
        zone: 'CHARACTER_DECK',
        playerId: p.id,
        deckId: p.characterDeck.deckId,
      });
    for (const id of p.characterDiscard)
      locate(id, p.id, {
        zone: 'CHARACTER_DISCARD',
        playerId: p.id,
        deckId: p.characterDeck.deckId,
      });
    for (const id of p.drinkPile)
      locate(id, null, { zone: 'DRINK_PILE', playerId: p.id });
    for (const special of Object.values(p.special.sideDecks)) {
      for (const id of special.deck.cardIds)
        locate(id, p.id, {
          zone: 'SPECIAL_DECK',
          playerId: p.id,
          deckId: special.deck.deckId,
        });
      for (const id of special.discard)
        locate(id, p.id, {
          zone: 'SPECIAL_DISCARD',
          playerId: p.id,
          deckId: special.deck.deckId,
        });
    }
  }
  for (const id of state.innDrinkDeck.cardIds)
    locate(id, null, {
      zone: 'INN_DRINK_DECK',
      deckId: state.innDrinkDeck.deckId,
    });
  for (const id of state.innDrinkDiscard)
    locate(id, null, {
      zone: 'INN_DRINK_DISCARD',
      deckId: state.innDrinkDeck.deckId,
    });
  for (const frame of state.resolutionStack) {
    const held = [
      ...(frame.heldDrinkCardIds ?? []),
      ...(frame.pendingDrinks ?? []).flatMap((work) => work.sourceCardIds),
    ];
    for (const id of held)
      locate(id, null, { zone: 'RESOLUTION', resolutionId: frame.id });
    const sourceCards =
      frame.sourceCardIds ??
      (frame.sourceCardId === null ? [] : [frame.sourceCardId]);
    for (const id of sourceCards) {
      const card = registry[id];
      requireInvariant(card !== undefined, 'unknown resolution source');
      if (card.location.zone === 'RESOLUTION')
        locate(
          card.id,
          frame.kind === 'DRINK' || frame.kind === 'DRINK_EVENT'
            ? null
            : frame.actorId,
          {
            zone: 'RESOLUTION',
            resolutionId: frame.id,
          },
        );
    }
  }
  requireInvariant(
    seen.size === Object.keys(registry).length,
    'card has no zone',
  );
  for (const [key, receipt] of Object.entries(state.control.acceptedCommands)) {
    commandIdSchema.parse(key);
    stateVersionSchema.parse(receipt.acceptedVersion);
    const command = acceptedCommandSchema.parse(
      JSON.parse(receipt.fingerprint) as unknown,
    );
    requireInvariant(
      command.commandId === key &&
        command.roomId === state.roomId &&
        command.type !== 'JOIN_ROOM' &&
        receipt.acceptedVersion === command.expectedStateVersion + 1 &&
        ids.has(receipt.actorId) &&
        receipt.acceptedVersion <= state.version,
      'invalid command receipt',
    );
  }
}
