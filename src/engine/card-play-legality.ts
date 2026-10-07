import type { CardDefinition } from '../content/cards';
import type { Effect } from '../content/effects';
import type { CardInstanceId, PlayerId } from '../shared/ids';
import { resolutionIdSchema } from '../shared/ids';
import type { CoreGameState, MutableGameState } from './types';
import { CommandError, requireCommand } from './errors';
import { activeGamblers } from './gambling';
import {
  cardEffects,
  hasChosenTarget,
  validateEffects,
} from './card-effects-validation';
import {
  legalResponsesForPlayer,
  reactionContext,
  phaseReactionContext,
} from './reaction-legality';
import { legalAnytimeCards } from './timed-prompts';

export type CardPlayCommand = 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY';
export interface LegalPlay {
  cardId: CardInstanceId;
  commandType: CardPlayCommand;
  requiresTarget: boolean;
  legalTargetPlayerIds: PlayerId[];
  promptId?: string;
}
/** Shared command/category/context checks and automatic effects, before any mutation. */
export function cardDefinitionForPlay(
  state: CoreGameState,
  playerId: PlayerId,
  cardId: CardInstanceId,
  command: CardPlayCommand,
): CardDefinition {
  const player = state.players.find((p) => p.id === playerId);
  requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
  requireCommand(player !== undefined && !player.eliminated, 'NOT_ELIGIBLE');
  requireCommand(player.hand.includes(cardId), 'CARD_NOT_IN_HAND');
  const definition = state.definitions[state.cards[cardId]!.definitionId]!;
  requireCommand(state.resolutionStack.length < 32, 'STACK_LIMIT');
  requireCommand(
    (state.resolutionStack.at(-1)?.window?.submittedResponses.length ?? 0) <
      256,
    'STACK_LIMIT',
  );
  if (command === 'PLAY_RESPONSE') {
    requireCommand(
      state.responseWindow?.priorityPlayerId === playerId &&
        state.responseWindow.pendingChoice === null,
      'NOT_PRIORITY',
    );
    requireCommand(
      definition.type === 'SOMETIMES' || definition.type === 'ANYTIME',
      'ILLEGAL_TIMING',
    );
    return definition;
  }
  if (
    command === 'PLAY_CARD' &&
    definition.type === 'SOMETIMES' &&
    definition.phaseOpportunity === 'ORDER_DRINK'
  ) {
    requireCommand(
      state.phase === 'ORDER_DRINK' && state.activePlayerId === playerId,
      'ILLEGAL_TIMING',
    );
    requireCommand(
      state.resolutionStack.length === 0 ||
        (state.resolutionStack.at(-1)?.task?.kind === 'PHASE' &&
          state.responseWindow?.priorityPlayerId === playerId),
      'RESOLUTION_PENDING',
    );
    requireCommand(
      legalResponsesForPlayer(
        state,
        playerId,
        state.resolutionStack.length === 0
          ? phaseReactionContext(state)
          : reactionContext(state, state.resolutionStack.at(-1)!),
      ).some((play) => play.cardId === cardId),
      'ILLEGAL_TIMING',
    );
    return definition;
  }
  requireCommand(state.responseWindow === null, 'RESOLUTION_PENDING');
  if (command === 'GAMBLING_PLAY') {
    const round = state.gambling;
    requireCommand(round !== null, 'NO_GAMBLING');
    requireCommand(
      state.resolutionStack.at(-1)?.id === round.suspended.resolutionId,
      'RESOLUTION_PENDING',
    );
    requireCommand(
      activeGamblers(state as MutableGameState).includes(playerId),
      'NOT_ELIGIBLE',
    );
    requireCommand(round.priorityPlayerId === playerId, 'NOT_PRIORITY');
    requireCommand(
      definition.type === 'GAMBLING' || definition.type === 'CHEATING',
      'UNSUPPORTED_CARD',
    );
    requireCommand(
      round.allowedControlCategories.includes(definition.type),
      'CONTROL_RESTRICTED',
    );
    const effects: Effect[] = [
      ...(definition.effects.some(
        (effect) => effect.op === 'TAKE_GAMBLING_CONTROL',
      )
        ? []
        : [
            {
              op: 'TAKE_GAMBLING_CONTROL',
              allowedNextCategories: definition.gambling
                ?.allowedNextCategories ?? ['GAMBLING', 'CHEATING'],
            } as Effect,
          ]),
      ...definition.effects.filter((effect) => effect.op !== 'START_GAMBLING'),
    ];
    if (definition.gambling?.immediateWin) effects.push({ op: 'WIN_GAMBLING' });
    return { ...definition, effects };
  }
  if (definition.type === 'ANYTIME') {
    requireCommand(
      state.resolutionStack.length === 0 ||
        (state.gambling?.stage === 'ROUND' &&
          state.resolutionStack.at(-1)?.id ===
            state.gambling.suspended.resolutionId),
      'RESOLUTION_PENDING',
    );
    if (state.control.phaseEnd !== null) {
      requireCommand(
        state.control.phaseEnd.priorityPlayerId === playerId,
        'NOT_PRIORITY',
      );
      requireCommand(
        legalAnytimeCards(state, playerId).some((c) => c.cardId === cardId),
        'ILLEGAL_TIMING',
      );
    }
    return definition;
  }
  requireCommand(
    state.gambling === null && state.resolutionStack.length === 0,
    'RESOLUTION_PENDING',
  );
  requireCommand(state.control.phaseEnd === null, 'RESOLUTION_PENDING');
  requireCommand(state.activePlayerId === playerId, 'NOT_ACTIVE_PLAYER');
  requireCommand(state.phase === 'ACTION', 'WRONG_PHASE');
  requireCommand(
    definition.type === 'ACTION' || definition.type === 'GAMBLING',
    'UNSUPPORTED_CARD',
  );
  requireCommand(
    definition.type !== 'GAMBLING' || definition.gambling?.canStart !== false,
    'ILLEGAL_TIMING',
  );
  return definition.type === 'GAMBLING'
    ? {
        ...definition,
        effects: definition.effects.some(
          (effect) => effect.op === 'START_GAMBLING',
        )
          ? definition.effects
          : [{ op: 'START_GAMBLING' }, ...definition.effects],
      }
    : definition;
}
/** Pure private projection; uses the exact context/category/effect validators used when queuing. */
export function legalCardPlays(
  state: CoreGameState,
  playerId: PlayerId,
): LegalPlay[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated || state.lifecycle !== 'PLAYING') return [];
  const promptId =
    state.control.timedPrompt?.priorityPlayerId === playerId
      ? state.control.timedPrompt.promptId
      : undefined;
  if (state.responseWindow !== null) {
    if (state.responseWindow.submittedResponses.length >= 256) return [];
    if (
      state.responseWindow.priorityPlayerId !== playerId ||
      state.responseWindow.pendingChoice !== null
    )
      return [];
    return legalResponsesForPlayer(
      state,
      playerId,
      reactionContext(state, state.resolutionStack.at(-1)!),
    ).map((play) => ({
      ...play,
      legalTargetPlayerIds: [...play.legalTargetPlayerIds],
      ...(promptId === undefined ? {} : { promptId }),
    }));
  }
  const legal: LegalPlay[] = [];
  for (const cardId of player.hand) {
    const commandType =
      state.gambling !== null &&
      state.definitions[state.cards[cardId]!.definitionId]!.type !== 'ANYTIME'
        ? 'GAMBLING_PLAY'
        : 'PLAY_CARD';
    let definition: CardDefinition;
    try {
      definition = cardDefinitionForPlay(state, playerId, cardId, commandType);
    } catch (error) {
      if (error instanceof CommandError) continue;
      throw error;
    }
    const requiresTarget = hasChosenTarget(cardEffects(definition, state));
    const targets = requiresTarget
      ? state.players
          .filter(
            (p) =>
              !p.eliminated &&
              (definition.targetPolicy === 'ANY_LIVING_PLAYER' ||
                p.id !== playerId),
          )
          .map((p) => p.id)
      : [undefined];
    const legalTargetPlayerIds: PlayerId[] = [];
    let valid = false;
    for (const target of targets) {
      const parent = state.resolutionStack.at(-1);
      try {
        validateEffects(
          state as MutableGameState,
          {
            id: resolutionIdSchema.parse('resolution_legal_play'),
            kind: 'CARD',
            actorId: playerId,
            sourceCardId: cardId,
            sourceRevealed: true,
            targetPlayerIds: target === undefined ? [] : [target],
            effects: cardEffects(definition, state),
            nextEffectIndex: 0,
            parentId: parent?.id ?? null,
            stage: 'RESPONSES',
            canceled: false,
            ignoredPlayerIds: [],
            window: null,
            continuation: 'RESUME',
            selectedOptionId: null,
          },
          parent as MutableGameState['resolutionStack'][number] | undefined,
        );
        valid = true;
        if (target !== undefined) legalTargetPlayerIds.push(target);
      } catch (error) {
        if (!(error instanceof CommandError)) throw error;
      }
    }
    if (valid)
      legal.push({
        cardId,
        commandType,
        requiresTarget,
        legalTargetPlayerIds,
        ...(promptId === undefined ? {} : { promptId }),
      });
  }
  return legal;
}
