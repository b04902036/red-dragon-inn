import type { CardDefinition } from '../content/cards';
import type { Effect } from '../content/effects';
import type { StateChangingCommand } from '../protocol/commands';
import {
  resolutionIdSchema,
  responseWindowIdSchema,
  cardInstanceIdSchema,
} from '../shared/ids';
import type { PlayerId } from '../shared/ids';
import { matchNamespace } from './identity';
import { requireCommand } from './errors';
import {
  affectedPlayers,
  effectTargets,
  executeOperation,
  discardCards,
} from './effect-operations';
import type { MutableFrame } from './effect-operations';
import type { EmitEvent } from './event-writer';
import type { PendingChoice, ResponseKind } from './model';
import type { RandomSource } from './rng';
import type { MutableGameState } from './types';
import { buildDrinkFrame, drinkModifierEffects } from './drinks';
import {
  activeGamblers,
  validateGamblingStart,
  settleGambling,
  passGambling,
  leaveGambling,
  advanceGamblingPriority,
} from './gambling';

const MAX_STACK_DEPTH = 32;
function seatsAfter(state: MutableGameState, actorId: PlayerId): PlayerId[] {
  const players = state.players
    .filter((player) => !player.eliminated)
    .sort((a, b) => a.seat - b.seat);
  const index = players.findIndex((player) => player.id === actorId);
  return [...players.slice(index + 1), ...players.slice(0, index + 1)].map(
    (player) => player.id,
  );
}
function setWindow(
  state: MutableGameState,
  frame: MutableFrame,
  window: MutableFrame['window'],
) {
  frame.window = window;
  state.responseWindow = window;
}
function openWindow(
  state: MutableGameState,
  frame: MutableFrame,
  kind: ResponseKind,
  emit: EmitEvent,
) {
  const eligiblePlayerIds = seatsAfter(state, frame.actorId!);
  const window = {
    id: responseWindowIdSchema.parse(
      `window_${matchNamespace(state.matchId)}_${state.version}`,
    ),
    kind,
    resolutionId: frame.id,
    eligiblePlayerIds,
    passedPlayerIds: [],
    priorityPlayerId: eligiblePlayerIds[0]!,
    submittedResponses: [],
    pendingChoice: null,
  };
  setWindow(state, frame, window);
  emit({
    type: 'RESPONSE_WINDOW_OPENED',
    responseWindowId: window.id,
    resolutionId: frame.id,
    kind,
    eligiblePlayerIds,
    priorityPlayerId: window.priorityPlayerId,
  });
}
export function hasChosenTarget(effects: readonly Effect[]) {
  for (const effect of effects) {
    if (effect.op === 'OPEN_CHOICE') return false;
    if ('target' in effect && effect.target === 'CHOSEN_PLAYER') return true;
  }
  return false;
}
function validateEffects(
  state: MutableGameState,
  frame: MutableFrame,
  parent: MutableFrame | undefined,
) {
  requireCommand(
    frame.effects.filter((effect) => effect.op === 'START_GAMBLING').length <=
      1,
    'INVALID_EFFECT',
  );
  for (const [index, effect] of frame.effects.entries()) {
    if (effect.op === 'START_GAMBLING') validateGamblingStart(state, frame);
    if (effect.op === 'TAKE_GAMBLING_CONTROL' || effect.op === 'WIN_GAMBLING') {
      requireCommand(
        state.gambling !== null &&
          frame.parentId === state.gambling.suspended.resolutionId &&
          activeGamblers(state).includes(frame.actorId!),
        'ILLEGAL_TIMING',
      );
      if (effect.op === 'WIN_GAMBLING')
        requireCommand(index === frame.effects.length - 1, 'INVALID_EFFECT');
    }
    if (effect.op === 'LEAVE_GAMBLING') {
      requireCommand(
        state.gambling !== null &&
          activeGamblers(state).includes(frame.actorId!) &&
          activeGamblers(state).length > 1,
        'NOT_ELIGIBLE',
      );
      requireCommand(state.rules.gambling.allowLeave, 'LEAVE_NOT_ALLOWED');
    }
  }
  const pendingEffects =
    parent === undefined
      ? []
      : (JSON.parse(JSON.stringify(parent.effects)) as Effect[]);
  for (const effect of frame.effects) {
    if (effect.op === 'IGNORE')
      requireCommand(
        parent !== undefined &&
          affectedPlayers(state, parent).includes(frame.actorId!),
        'ILLEGAL_TIMING',
      );
    if (effect.op === 'NEGATE')
      requireCommand(parent !== undefined, 'ILLEGAL_TIMING');
    if (effect.op === 'MODIFY_PENDING_EFFECT') {
      const pending = pendingEffects[effect.effectIndex];
      requireCommand(
        parent !== undefined &&
          (parent.kind !== 'DRINK_EVENT' || effect.allowDrinkEvents === true) &&
          pending?.op === 'CHANGE_STAT' &&
          effect.effectIndex >= parent.nextEffectIndex &&
          Number.isSafeInteger(pending.delta + effect.delta),
        'INVALID_EFFECT',
      );
      pending.delta += effect.delta;
    }
    if (effect.op === 'MODIFY_DRINK') {
      requireCommand(parent !== undefined, 'ILLEGAL_TIMING');
      const { alcohol, fortitude } = drinkModifierEffects(
        { ...parent, effects: pendingEffects },
        effect.allowDrinkEvents,
      );
      requireCommand(
        Number.isSafeInteger(alcohol.delta + effect.alcoholDelta) &&
          Number.isSafeInteger(fortitude.delta + effect.fortitudeDelta),
        'INVALID_EFFECT',
      );
      alcohol.delta += effect.alcoholDelta;
      fortitude.delta += effect.fortitudeDelta;
    }
    if (
      effect.op === 'OPEN_CHOICE' ||
      effect.op === 'OPEN_OPTION' ||
      effect.op === 'DISCARD_CARDS'
    ) {
      // A single choice owner per operation; multi-owner choices require separate operations.
      requireCommand(
        effectTargets(state, frame, effect.target).length <= 1,
        'INVALID_EFFECT',
      );
      if (effect.op === 'OPEN_CHOICE')
        requireCommand(
          state.players.some(
            (player) =>
              !player.eliminated &&
              player.id !== effectTargets(state, frame, effect.target)[0]?.id,
          ),
          'INVALID_EFFECT',
        );
    }
    if (effect.op === 'CUSTOM')
      for (const player of effectTargets(state, frame, effect.target)) {
        const resource = player.special.resources[effect.params.resource];
        requireCommand(
          resource !== undefined && Number.isSafeInteger(resource.value),
          'INVALID_EFFECT',
        );
      }
  }
}
function queueCard(
  state: MutableGameState,
  command: Extract<
    StateChangingCommand,
    { type: 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY' }
  >,
  actorId: PlayerId,
  definition: CardDefinition,
  continuation: MutableFrame['continuation'],
  emit: EmitEvent,
) {
  const player = state.players.find((player) => player.id === actorId)!;
  const parent = state.resolutionStack.at(-1);
  requireCommand(definition.effects.length <= 32, 'INVALID_EFFECT');
  requireCommand(state.resolutionStack.length < MAX_STACK_DEPTH, 'STACK_LIMIT');
  const chosen = hasChosenTarget(definition.effects);
  const targetId =
    'targetPlayerId' in command ? command.targetPlayerId : undefined;
  const target = state.players.find((player) => player.id === targetId);
  requireCommand(
    chosen
      ? target !== undefined && !target.eliminated && target.id !== actorId
      : targetId === undefined,
    'INVALID_TARGET',
  );
  const frame: MutableFrame = {
    id: resolutionIdSchema.parse(
      `resolution_${matchNamespace(state.matchId)}_${state.version}`,
    ),
    kind: 'CARD',
    actorId,
    sourceCardId: command.cardId,
    sourceRevealed: true,
    targetPlayerIds: target === undefined ? [] : [target.id],
    effects: JSON.parse(JSON.stringify(definition.effects)) as Effect[],
    nextEffectIndex: 0,
    parentId: parent?.id ?? null,
    stage: 'RESPONSES',
    canceled: false,
    ignoredPlayerIds: [],
    window: null,
    continuation,
    selectedOptionId: null,
  };
  validateEffects(state, frame, parent);
  player.hand.splice(player.hand.indexOf(command.cardId), 1);
  state.cards[command.cardId]!.location = {
    zone: 'RESOLUTION',
    resolutionId: frame.id,
  };
  emit({
    type: 'CARD_PLAYED',
    playerId: actorId,
    cardId: command.cardId,
    definitionId: definition.id,
  });
  if (parent?.window != null) {
    const window = parent.window;
    requireCommand(window.submittedResponses.length < 256, 'STACK_LIMIT');
    window.submittedResponses.push(frame.id);
    window.passedPlayerIds = [];
    window.priorityPlayerId = seatsAfter(state, actorId)[0]!;
    emit({
      type: 'RESPONSE_SUBMITTED',
      responseWindowId: window.id,
      playerId: actorId,
      resolutionId: frame.id,
    });
  } else if (continuation === 'ORDER_DRINK')
    emit({
      type: 'ACTION_QUEUED',
      playerId: actorId,
      cardId: command.cardId,
      resolutionId: frame.id,
      targetPlayerIds: frame.targetPlayerIds,
    });
  state.resolutionStack.push(frame);
  emit({
    type: 'RESOLUTION_STARTED',
    resolutionId: frame.id,
    parentId: frame.parentId,
    cardId: command.cardId,
    playerId: actorId,
  });
  const kind =
    definition.type === 'SOMETIMES'
      ? definition.responseKind
      : definition.type === 'ANYTIME'
        ? 'ANYTIME'
        : 'SOMETIMES';
  openWindow(state, frame, kind, emit);
}

export function startDrink(
  state: MutableGameState,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
) {
  const frame = buildDrinkFrame(state, actorId, emit, rng);
  requireCommand(!hasChosenTarget(frame.effects), 'INVALID_TARGET');
  validateEffects(state, frame, undefined);
  state.resolutionStack.push(frame);
  emit({
    type: 'RESOLUTION_STARTED',
    resolutionId: frame.id,
    parentId: null,
    cardId: frame.sourceCardId,
    playerId: actorId,
  });
  openWindow(state, frame, 'SOMETIMES', emit);
}

export function playAction(
  state: MutableGameState,
  command: Extract<StateChangingCommand, { type: 'PLAY_CARD' }>,
  actorId: PlayerId,
  emit: EmitEvent,
) {
  requireCommand(state.phase === 'ACTION', 'WRONG_PHASE');
  const player = state.players.find((player) => player.id === actorId)!;
  requireCommand(player.hand.includes(command.cardId), 'CARD_NOT_IN_HAND');
  const definition =
    state.definitions[state.cards[command.cardId]!.definitionId]!;
  requireCommand(
    definition.type === 'ACTION' || definition.type === 'GAMBLING',
    'UNSUPPORTED_CARD',
  );
  queueCard(
    state,
    command,
    actorId,
    definition.type === 'GAMBLING'
      ? {
          ...definition,
          effects: [{ op: 'START_GAMBLING' }, ...definition.effects],
        }
      : definition,
    'ORDER_DRINK',
    emit,
  );
}

function openChoice(
  state: MutableGameState,
  frame: MutableFrame,
  choice: PendingChoice,
  emit: EmitEvent,
) {
  const window = {
    id: responseWindowIdSchema.parse(
      `window_${matchNamespace(state.matchId)}_${state.version}_choice_${frame.nextEffectIndex}`,
    ),
    kind: 'SOMETIMES' as const,
    resolutionId: frame.id,
    eligiblePlayerIds: [],
    passedPlayerIds: [],
    priorityPlayerId: null,
    submittedResponses: [],
    pendingChoice: JSON.parse(JSON.stringify(choice)) as NonNullable<
      MutableFrame['window']
    >['pendingChoice'],
  };
  frame.stage = 'CHOICE';
  setWindow(state, frame, window);
  emit({
    type: 'CHOICE_OPENED',
    resolutionId: frame.id,
    responseWindowId: window.id,
    playerId: choice.playerId,
    kind: choice.kind,
  });
}

function choiceForEffect(
  state: MutableGameState,
  frame: MutableFrame,
  effect: Extract<
    Effect,
    { op: 'OPEN_CHOICE' | 'OPEN_OPTION' | 'DISCARD_CARDS' }
  >,
): PendingChoice | null {
  const player = effectTargets(state, frame, effect.target)[0];
  if (player === undefined) return null;
  if (effect.op === 'DISCARD_CARDS') {
    if (player.hand.length === 0) return null;
    const count = Math.min(effect.count, player.hand.length);
    return {
      playerId: player.id,
      kind: 'CARD',
      options: player.hand.map((id) => ({
        id,
        label: state.definitions[state.cards[id]!.definitionId]!.name,
      })),
      min: count,
      max: count,
    };
  }
  return {
    playerId: player.id,
    kind: effect.op === 'OPEN_CHOICE' ? 'TARGET' : 'OPTION',
    options:
      effect.op === 'OPEN_OPTION'
        ? effect.options
        : state.players
            .filter((target) => !target.eliminated && target.id !== player.id)
            .map((target) => ({ id: target.id, label: target.displayName })),
    min: 1,
    max: 1,
  };
}

/** Drain ready operations, pop children first, then restore the parent's saved priority. */
function drain(state: MutableGameState, emit: EmitEvent, rng: RandomSource) {
  while (state.resolutionStack.length > 0) {
    const frame = state.resolutionStack.at(-1)!;
    if (
      state.gambling !== null &&
      frame.id === state.gambling.suspended.resolutionId &&
      !settleGambling(state, emit)
    )
      return;
    if (frame.canceled && frame.window !== null) {
      emit({
        type: 'RESPONSE_WINDOW_CLOSED',
        responseWindowId: frame.window.id,
        reason: 'CANCELED',
      });
      setWindow(state, frame, null);
    }
    if (!frame.canceled && frame.stage !== 'OPERATIONS') {
      state.responseWindow = frame.window;
      return;
    }
    while (!frame.canceled && frame.nextEffectIndex < frame.effects.length) {
      const effect = frame.effects[frame.nextEffectIndex]!;
      if (
        effect.op === 'OPEN_CHOICE' ||
        effect.op === 'OPEN_OPTION' ||
        effect.op === 'DISCARD_CARDS'
      ) {
        const choice = choiceForEffect(state, frame, effect);
        if (choice !== null) {
          openChoice(state, frame, choice, emit);
          return;
        }
      } else executeOperation(state, frame, effect, emit, rng);
      emit({
        type: 'EFFECT_RESOLVED',
        resolutionId: frame.id,
        effectIndex: frame.nextEffectIndex,
      });
      frame.nextEffectIndex += 1;
      if (
        state.gambling !== null &&
        frame.id === state.gambling.suspended.resolutionId &&
        !settleGambling(state, emit)
      )
        return;
    }
    const player = state.players.find((player) => player.id === frame.actorId)!;
    if (frame.kind === 'DRINK' || frame.kind === 'DRINK_EVENT') {
      const cards = frame.sourceCardIds!;
      state.innDrinkDiscard.push(...cards);
      for (const id of cards)
        state.cards[id]!.location = {
          zone: 'INN_DRINK_DISCARD',
          deckId: state.innDrinkDeck.deckId,
        };
      emit({ type: 'DRINK_DISCARDED', resolutionId: frame.id, cardIds: cards });
    } else {
      player.characterDiscard.push(frame.sourceCardId!);
      state.cards[frame.sourceCardId!]!.location = {
        zone: 'CHARACTER_DISCARD',
        playerId: player.id,
        deckId: player.characterDeck.deckId,
      };
      emit({
        type: 'CARDS_DISCARDED',
        playerId: player.id,
        cardIds: [frame.sourceCardId!],
      });
    }
    emit({
      type: 'RESOLUTION_COMPLETED',
      resolutionId: frame.id,
      canceled: frame.canceled,
    });
    state.resolutionStack.pop();
    if (
      state.gambling !== null &&
      frame.parentId === state.gambling.suspended.resolutionId
    ) {
      const definition =
        state.definitions[state.cards[frame.sourceCardId!]!.definitionId]!;
      if (definition.type === 'GAMBLING' || definition.type === 'CHEATING')
        advanceGamblingPriority(state, frame.actorId!, emit);
    }
    state.responseWindow = state.resolutionStack.at(-1)?.window ?? null;
    if (
      frame.continuation === 'ORDER_DRINK' ||
      frame.continuation === 'ELIMINATION_CHECK'
    ) {
      state.phase = frame.continuation;
      emit({
        type: 'PHASE_CHANGED',
        phase: frame.continuation,
        activePlayerId: state.activePlayerId!,
      });
    } else if (
      state.responseWindow !== null &&
      !state.resolutionStack.at(-1)!.canceled
    )
      emit({
        type: 'RESPONSE_PRIORITY_CHANGED',
        responseWindowId: state.responseWindow.id,
        priorityPlayerId: state.responseWindow.priorityPlayerId!,
      });
  }
}

function choose(
  state: MutableGameState,
  command: Extract<
    StateChangingCommand,
    { type: 'CHOOSE_TARGET' | 'CHOOSE_OPTION' | 'CHOOSE_CARDS' }
  >,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
) {
  const window = state.responseWindow!;
  const choice = window.pendingChoice;
  requireCommand(
    choice !== null && choice.playerId === actorId,
    'INVALID_CHOICE',
  );
  const selections =
    command.type === 'CHOOSE_OPTION'
      ? [command.optionId]
      : command.type === 'CHOOSE_TARGET'
        ? command.targetPlayerIds
        : command.cardIds;
  requireCommand(
    (command.type === 'CHOOSE_OPTION' && choice.kind === 'OPTION') ||
      (command.type === 'CHOOSE_TARGET' && choice.kind === 'TARGET') ||
      (command.type === 'CHOOSE_CARDS' && choice.kind === 'CARD'),
    'INVALID_CHOICE',
  );
  requireCommand(
    selections.length >= choice.min &&
      selections.length <= choice.max &&
      selections.every((id) =>
        choice.options.some((option) => option.id === id),
      ),
    'INVALID_CHOICE',
  );
  const frame = state.resolutionStack.at(-1)!;
  if (command.type === 'CHOOSE_TARGET')
    frame.targetPlayerIds = command.targetPlayerIds;
  else if (command.type === 'CHOOSE_OPTION')
    frame.selectedOptionId = command.optionId;
  else
    discardCards(
      state,
      state.players.find((player) => player.id === actorId)!,
      command.cardIds.map((id) => cardInstanceIdSchema.parse(id)),
      emit,
    );
  validateEffects(
    state,
    { ...frame, effects: frame.effects.slice(frame.nextEffectIndex + 1) },
    state.resolutionStack.at(-2),
  );
  emit({
    type: 'CHOICE_SELECTED',
    resolutionId: frame.id,
    playerId: actorId,
    selections,
  });
  emit({
    type: 'RESPONSE_WINDOW_CLOSED',
    responseWindowId: window.id,
    reason: 'CHOICE_COMPLETED',
  });
  emit({
    type: 'EFFECT_RESOLVED',
    resolutionId: frame.id,
    effectIndex: frame.nextEffectIndex,
  });
  frame.nextEffectIndex += 1;
  frame.stage = 'OPERATIONS';
  setWindow(state, frame, null);
  drain(state, emit, rng);
}

export function executeTimingCommand(
  state: MutableGameState,
  command: StateChangingCommand,
  actorId: PlayerId,
  emit: EmitEvent,
  rng: RandomSource,
): boolean {
  if (
    command.type === 'GAMBLING_PLAY' ||
    command.type === 'GAMBLING_PASS' ||
    command.type === 'GAMBLING_LEAVE'
  ) {
    requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
    requireCommand(state.gambling !== null, 'NO_GAMBLING');
    requireCommand(
      state.responseWindow === null &&
        state.resolutionStack.at(-1)?.id ===
          state.gambling.suspended.resolutionId,
      'RESOLUTION_PENDING',
    );
    requireCommand(activeGamblers(state).includes(actorId), 'NOT_ELIGIBLE');
    requireCommand(state.gambling.priorityPlayerId === actorId, 'NOT_PRIORITY');
    if (command.type === 'GAMBLING_PLAY') {
      const player = state.players.find((player) => player.id === actorId)!;
      requireCommand(player.hand.includes(command.cardId), 'CARD_NOT_IN_HAND');
      const definition =
        state.definitions[state.cards[command.cardId]!.definitionId]!;
      requireCommand(
        definition.type === 'GAMBLING' || definition.type === 'CHEATING',
        'UNSUPPORTED_CARD',
      );
      requireCommand(
        state.gambling.allowedControlCategories.includes(definition.type),
        'CONTROL_RESTRICTED',
      );
      const effects: Effect[] = [
        {
          op: 'TAKE_GAMBLING_CONTROL',
          allowedNextCategories: definition.gambling?.allowedNextCategories ?? [
            'GAMBLING',
            'CHEATING',
          ],
        },
        ...definition.effects,
      ];
      if (definition.gambling?.immediateWin)
        effects.push({ op: 'WIN_GAMBLING' });
      queueCard(
        state,
        command,
        actorId,
        { ...definition, effects },
        'RESUME',
        emit,
      );
    } else {
      if (command.type === 'GAMBLING_PASS') passGambling(state, actorId, emit);
      else leaveGambling(state, actorId, emit);
      drain(state, emit, rng);
    }
    return true;
  }
  const timing =
    command.type === 'PLAY_RESPONSE' ||
    command.type === 'PASS_RESPONSE' ||
    command.type === 'CHOOSE_TARGET' ||
    command.type === 'CHOOSE_OPTION' ||
    command.type === 'CHOOSE_CARDS';
  if (!timing && command.type !== 'PLAY_CARD') return false;
  if (command.type === 'PLAY_CARD' && state.responseWindow !== null)
    requireCommand(false, 'RESOLUTION_PENDING');
  if (command.type === 'PLAY_CARD') {
    const player = state.players.find((player) => player.id === actorId)!;
    const card = state.cards[command.cardId];
    const definition =
      card === undefined ? undefined : state.definitions[card.definitionId];
    if (definition?.type !== 'ANYTIME') return false;
    requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
    requireCommand(
      state.gambling === null && state.resolutionStack.length === 0,
      'RESOLUTION_PENDING',
    );
    requireCommand(!player.eliminated, 'NOT_ELIGIBLE');
    requireCommand(player.hand.includes(command.cardId), 'CARD_NOT_IN_HAND');
    queueCard(state, command, actorId, definition, 'RESUME', emit);
    return true;
  }
  requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
  const window = state.responseWindow;
  requireCommand(
    window !== null &&
      'responseWindowId' in command &&
      command.responseWindowId === window.id,
    'WRONG_WINDOW',
  );
  // JSON round-trips remove aliases. Attach the authoritative active window back to its frame.
  const frame = state.resolutionStack.at(-1)!;
  frame.window = window;
  if (
    command.type === 'CHOOSE_TARGET' ||
    command.type === 'CHOOSE_OPTION' ||
    command.type === 'CHOOSE_CARDS'
  ) {
    choose(state, command, actorId, emit, rng);
    return true;
  }
  requireCommand(window.pendingChoice === null, 'ILLEGAL_TIMING');
  requireCommand(window.eligiblePlayerIds.includes(actorId), 'NOT_ELIGIBLE');
  requireCommand(!window.passedPlayerIds.includes(actorId), 'ALREADY_PASSED');
  requireCommand(window.priorityPlayerId === actorId, 'NOT_PRIORITY');
  if (command.type === 'PASS_RESPONSE') {
    window.passedPlayerIds.push(actorId);
    emit({
      type: 'RESPONSE_PASSED',
      playerId: actorId,
      responseWindowId: window.id,
    });
    if (window.passedPlayerIds.length === window.eligiblePlayerIds.length) {
      emit({
        type: 'RESPONSE_WINDOW_CLOSED',
        responseWindowId: window.id,
        reason: 'ALL_PASSED',
      });
      frame.stage = 'OPERATIONS';
      setWindow(state, frame, null);
      drain(state, emit, rng);
    } else {
      window.priorityPlayerId = seatsAfter(state, actorId).find(
        (id) =>
          window.eligiblePlayerIds.includes(id) &&
          !window.passedPlayerIds.includes(id),
      )!;
      emit({
        type: 'RESPONSE_PRIORITY_CHANGED',
        responseWindowId: window.id,
        priorityPlayerId: window.priorityPlayerId,
      });
    }
    return true;
  }
  requireCommand(command.type === 'PLAY_RESPONSE', 'UNSUPPORTED_COMMAND');
  const player = state.players.find((player) => player.id === actorId)!;
  requireCommand(player.hand.includes(command.cardId), 'CARD_NOT_IN_HAND');
  const definition =
    state.definitions[state.cards[command.cardId]!.definitionId]!;
  requireCommand(
    definition.type === 'SOMETIMES' || definition.type === 'ANYTIME',
    'ILLEGAL_TIMING',
  );
  if (definition.type === 'SOMETIMES' && definition.responseKind === 'IGNORE')
    requireCommand(
      affectedPlayers(state, frame).includes(actorId),
      'ILLEGAL_TIMING',
    );
  queueCard(state, command, actorId, definition, 'RESUME', emit);
  return true;
}
