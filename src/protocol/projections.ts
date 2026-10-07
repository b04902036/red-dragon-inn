import type { AuthoritativeGameState, PlayerState } from '../engine/model';
import type { CoreGameState } from '../engine/types';
import {
  legalResponsesForPlayer,
  reactionContext,
} from '../engine/reaction-legality';
import { actionAttention } from './attention';
import { legalAnytimeCards } from '../engine/timed-prompts';
import { legalCardPlays } from '../engine/card-play-legality';
import { taskEvent } from '../engine/workflow-state';
import type { CardInstanceId, PlayerId } from '../shared/ids';
import {
  privatePlayerViewSchema,
  publicGameViewSchema,
  type CardReference,
  type PrivatePlayerView,
  type PublicGameView,
} from './views';

function cardReference(
  state: AuthoritativeGameState,
  id: CardInstanceId,
): CardReference {
  const card = state.cards[id];
  if (!card || card.id !== id)
    throw new Error('Invalid authoritative card reference');
  return { id: card.id, definitionId: card.definitionId };
}

function visibleResources(
  player: PlayerState,
  owner: boolean,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(player.special.resources)
      .filter(
        ([, resource]) =>
          resource.visibility === 'PUBLIC' ||
          (owner && resource.visibility === 'OWNER'),
      )
      .map(([key, resource]) => [key, resource.value]),
  );
}

function visibleSideDecks(player: PlayerState, owner: boolean) {
  return Object.fromEntries(
    Object.entries(player.special.sideDecks)
      .filter(
        ([, deck]) =>
          deck.visibility === 'PUBLIC' ||
          (owner && deck.visibility === 'OWNER'),
      )
      .map(([key, deck]) => [
        key,
        {
          deckCount: deck.deck.cardIds.length,
          discardCount: deck.discard.length,
        },
      ]),
  );
}

/** Spectators and players receive the same public whitelist. Never spread internal state. */
export function projectPublicGame(
  state: AuthoritativeGameState & {
    readonly control?: { readonly turnNumber: number };
  },
): PublicGameView {
  const view = publicGameViewSchema.parse({
    schemaVersion: state.schemaVersion,
    roomId: state.roomId,
    matchId: state.matchId,
    version: state.version,
    lifecycle: state.lifecycle,
    ...('rules' in state
      ? {
          timedPrompt: (state as CoreGameState).control.timedPrompt,
          phaseEnd:
            (state as CoreGameState).control.phaseEnd === null
              ? null
              : {
                  id: (state as CoreGameState).control.phaseEnd!.id,
                  phase: (state as CoreGameState).control.phaseEnd!.phase,
                  priorityPlayerId: (state as CoreGameState).control.phaseEnd!
                    .priorityPlayerId,
                },
        }
      : {}),
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    players: state.players.map((player) => ({
      id: player.id,
      seat: player.seat,
      displayName: player.displayName,
      characterId: player.characterId,
      fortitude: player.fortitude,
      alcoholContent: player.alcoholContent,
      gold: player.gold,
      eliminated: player.eliminated,
      handCount: player.hand.length,
      characterDeckCount: player.characterDeck.cardIds.length,
      characterDiscardCount: player.characterDiscard.length,
      drinkPileCount: player.drinkPile.length,
      resources: visibleResources(player, false),
      sideDecks: visibleSideDecks(player, false),
    })),
    innDrinkDeckCount: state.innDrinkDeck.cardIds.length,
    ...(state.barDrinkDeck === undefined
      ? {}
      : { barDrinkDeckCount: state.barDrinkDeck.length }),
    innDrinkDiscardCount: state.innDrinkDiscard.length,
    gambling:
      state.gambling === null
        ? null
        : {
            stage: state.gambling.stage,
            initiatorPlayerId: state.gambling.initiatorPlayerId,
            priorityPlayerId: state.gambling.priorityPlayerId,
            controlPlayerId: state.gambling.controlPlayerId,
            participants: [...state.gambling.participants],
            passedPlayerIds: [...state.gambling.passedPlayerIds],
            leftPlayerIds: [...state.gambling.leftPlayerIds],
            excludedPlayerIds: [...state.gambling.excludedPlayerIds],
            pot: state.gambling.pot,
            anteAmount: state.gambling.anteAmount,
            contributions: state.gambling.contributions.map((entry) => ({
              playerId: entry.playerId,
              amount: entry.amount,
            })),
            controlSourceCardId: state.gambling.controlSourceCardId,
            allowedControlCategories: [
              ...state.gambling.allowedControlCategories,
            ],
            winnerPlayerId: state.gambling.winnerPlayerId,
          },
    resolutionStack: state.resolutionStack.map((frame) => {
      const sourceId = frame.sourceCardId ?? frame.drinkProvenance?.[0];
      const opportunity = taskEvent(frame.task);
      return {
        id: frame.id,
        kind: frame.kind,
        actorId: frame.actorId,
        ...(opportunity === null ? {} : { opportunity }),
        ...(frame.drinkRecipientId === undefined
          ? {}
          : { drinkRecipientId: frame.drinkRecipientId }),
        ...(frame.pendingDrinks === undefined
          ? {}
          : {
              revealedDrinks: frame.pendingDrinks.map((work) => ({
                playerId: work.actorId,
                cards: work.provenanceCardIds.map((id) =>
                  cardReference(state, id),
                ),
              })),
            }),
        sourceCard:
          frame.sourceRevealed && sourceId !== undefined
            ? cardReference(state, sourceId)
            : null,
        ...(frame.sourceCardIds === undefined
          ? {}
          : {
              sourceCards: frame.sourceRevealed
                ? (frame.drinkProvenance ?? frame.sourceCardIds).map((id) =>
                    cardReference(state, id),
                  )
                : [],
            }),
        targetPlayerIds: [...frame.targetPlayerIds],
      };
    }),
    responseWindow:
      state.responseWindow === null
        ? null
        : {
            id: state.responseWindow.id,
            kind: state.responseWindow.kind,
            resolutionId: state.responseWindow.resolutionId,
            eligiblePlayerIds: state.players
              .filter((player) => !player.eliminated)
              .sort((a, b) => a.seat - b.seat)
              .map((player) => player.id),
            passedPlayerIds: [...state.responseWindow.passedPlayerIds],
            priorityPlayerId: state.responseWindow.priorityPlayerId,
            submittedResponses: [...state.responseWindow.submittedResponses],
            choicePlayerId:
              state.responseWindow.pendingChoice?.playerId ?? null,
          },
    winners: [...state.winners],
  });
  return state.control === undefined
    ? view
    : {
        ...view,
        attention: view.timedPrompt
          ? {
              key: view.timedPrompt.promptId,
              playerId: view.timedPrompt.priorityPlayerId,
              kind: 'RESPONSE' as const,
            }
          : actionAttention(
              view,
              state.control.turnNumber,
              state.resolutionStack.at(-1)?.nextEffectIndex,
            ),
      };
}

function choiceCounts(
  state: AuthoritativeGameState,
  ids: readonly CardInstanceId[],
) {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const definitionId = state.cards[id]!.definitionId;
    counts.set(definitionId, (counts.get(definitionId) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([definitionId, count]) => ({ definitionId, count }));
}

/** requesterId must come from the authenticated server session, not a command payload. */
export function projectPrivatePlayer(
  state: AuthoritativeGameState,
  requesterId: PlayerId,
): PrivatePlayerView {
  const player = state.players.find((entry) => entry.id === requesterId);
  if (!player) throw new RangeError('Player is not in this match');

  const window = state.responseWindow;
  const choice = window?.pendingChoice;
  return privatePlayerViewSchema.parse({
    ...('definitions' in state &&
    (state as CoreGameState).rules.devCardSelection === true
      ? {
          devChoices: {
            handSize: (state as CoreGameState).rules.handSize,
            characterCards: choiceCounts(state, [
              ...player.characterDeck.cardIds,
              ...player.characterDiscard,
              ...player.hand,
            ]),
            innCards: choiceCounts(state, [
              ...state.innDrinkDeck.cardIds,
              ...state.innDrinkDiscard,
            ]),
          },
        }
      : {}),
    schemaVersion: state.schemaVersion,
    roomId: state.roomId,
    matchId: state.matchId,
    version: state.version,
    playerId: player.id,
    ...('definitions' in state
      ? {
          legalPlayVersion: state.version,
          legalPlays: legalCardPlays(state as CoreGameState, requesterId),
        }
      : {}),
    ...('definitions' in state
      ? {
          responsePrompt:
            (state as CoreGameState).control.timedPrompt?.priorityPlayerId ===
            requesterId
              ? {
                  ...(state as CoreGameState).control.timedPrompt!,
                  hasLegalSometimes:
                    window !== null &&
                    window.pendingChoice === null &&
                    legalResponsesForPlayer(
                      state as CoreGameState,
                      requesterId,
                      reactionContext(
                        state as CoreGameState,
                        state.resolutionStack.at(-1)!,
                      ),
                    ).some(
                      (c) =>
                        (state as CoreGameState).definitions[
                          state.cards[c.cardId]!.definitionId
                        ]!.type === 'SOMETIMES',
                    ),
                }
              : null,
          legalAnytime:
            (state as CoreGameState).control.phaseEnd?.priorityPlayerId ===
              requesterId && state.resolutionStack.length === 0
              ? legalAnytimeCards(state as CoreGameState, requesterId)
              : [],
        }
      : {}),
    legalResponses:
      'definitions' in state &&
      window?.priorityPlayerId === requesterId &&
      window.pendingChoice === null
        ? legalResponsesForPlayer(
            state as CoreGameState,
            requesterId,
            reactionContext(
              state as CoreGameState,
              state.resolutionStack.at(-1)!,
            ),
          ).filter((play) => play.commandType === 'PLAY_RESPONSE')
        : [],
    hand: player.hand.map((id) => {
      const card = state.cards[id];
      if (
        !card ||
        card.ownerId !== requesterId ||
        card.location.zone !== 'HAND' ||
        card.location.playerId !== requesterId
      ) {
        throw new Error('Invalid authoritative hand ownership');
      }
      return cardReference(state, id);
    }),
    resources: visibleResources(player, true),
    sideDecks: visibleSideDecks(player, true),
    pendingChoice:
      window && choice && choice.playerId === requesterId
        ? {
            responseWindowId: window.id,
            kind: choice.kind,
            options: choice.options.map((option) => ({
              id: option.id,
              label: option.label,
            })),
            min: choice.min,
            max: choice.max,
          }
        : null,
  });
}
