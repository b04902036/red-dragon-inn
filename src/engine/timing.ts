import {
  cardEffects,
  hasChosenTarget,
  validateEffects,
} from './card-effects-validation';
import {
  legalResponsesForPlayer,
  reactionContext,
  timingOrder,
} from './reaction-legality';
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
  executeOperation,
  effectTargets,
  discardCards,
} from './effect-operations';
import type { MutableFrame } from './effect-operations';
import type { EmitEvent } from './event-writer';
import type { PendingChoice, ResponseKind } from './model';
import type { RandomSource } from './rng';
import type { MutableGameState } from './types';
import { buildDrinkFrame } from './drinks';
import { completePhase, legalAnytimeCards, passAnytime } from './timed-prompts';
import { cardDefinitionForPlay } from './card-play-legality';
import { nextResolutionId } from './resolution-ids';
import { addTask, finishTask } from './workflows';
import type { WorkflowTask, DrinkWork } from './workflow-state';
import { taskEvent } from './workflow-state';
import {
  activeGamblers,
  passGambling,
  leaveGambling,
  advanceGamblingPriority,
} from './gambling';

const MAX_STACK_DEPTH = 32;
function taskFrame(
  state: MutableGameState,
  parent: MutableFrame | undefined,
  task: WorkflowTask,
): MutableFrame {
  const actorId =
    task.kind === 'PAYMENT'
      ? task.payer
      : task.kind === 'SETTLEMENT'
        ? task.winner
        : task.kind === 'POST_LOSS'
          ? (task.originalPlayer ?? task.affected)
          : (parent?.actorId ?? state.activePlayerId!);
  return {
    id: resolutionIdSchema.parse('resolution_pending_work'),
    kind: 'SYSTEM',
    actorId,
    sourceCardId: null,
    sourceRevealed: false,
    targetPlayerIds: task.kind === 'POST_LOSS' ? [task.affected] : [],
    effects: [],
    nextEffectIndex: 0,
    parentId: parent?.id ?? null,
    stage: 'RESPONSES',
    canceled: false,
    ignoredPlayerIds: [],
    window: null,
    continuation: 'RESUME',
    selectedOptionId: null,
    task,
  };
}
function pushDrinkWork(
  state: MutableGameState,
  parent: MutableFrame,
  work: DrinkWork,
  emit: EmitEvent,
) {
  requireCommand(state.resolutionStack.length < MAX_STACK_DEPTH, 'STACK_LIMIT');
  const frame: MutableFrame = {
    id: work.id,
    kind: work.kind,
    actorId: work.actorId,
    sourceCardId: work.sourceCardIds[0] ?? null,
    sourceCardIds: work.sourceCardIds,
    drinkProvenance: work.provenanceCardIds,
    alcoholAsFortitude: work.alcoholAsFortitude,
    ...(work.contestScore === undefined
      ? {}
      : { contestScore: work.contestScore }),
    origin: {
      playerId: work.actorId,
      cardId: work.provenanceCardIds[0] ?? null,
    },
    sourceRevealed: true,
    targetPlayerIds: [],
    effects: work.effects,
    nextEffectIndex: 0,
    parentId: parent.id,
    stage: work.responseComplete ? 'OPERATIONS' : 'RESPONSES',
    canceled: work.canceled ?? false,
    ignoredPlayerIds: work.ignoredPlayerIds ?? [],
    ...(work.drinkRecipientId === undefined
      ? {}
      : { drinkRecipientId: work.drinkRecipientId }),
    ...(work.afterTasks === undefined ? {} : { afterTasks: work.afterTasks }),
    ...(work.responseComplete === undefined
      ? {}
      : { batchResponseComplete: work.responseComplete }),
    window: null,
    continuation: 'RESUME',
    selectedOptionId: null,
  };
  for (const id of work.sourceCardIds)
    state.cards[id]!.location = { zone: 'RESOLUTION', resolutionId: frame.id };
  state.resolutionStack.push(frame);
  if (!work.responseComplete)
    emit({
      type: 'RESOLUTION_STARTED',
      resolutionId: frame.id,
      parentId: parent.id,
      cardId: frame.sourceCardId,
      playerId: frame.actorId!,
    });
  if (!work.responseComplete) openWindow(state, frame, 'SOMETIMES', emit);
}
export function maintainPhaseOpportunity(
  state: MutableGameState,
  emit: EmitEvent,
) {
  if (
    state.lifecycle !== 'PLAYING' ||
    state.phase !== 'ORDER_DRINK' ||
    state.resolutionStack.length > 0
  )
    return false;
  const key = `${state.control.turnNumber}:${state.activePlayerId}:${state.control.normalOrderDone ? 'AFTER' : 'BEFORE'}`;
  if (state.control.phaseOpportunityKey === key) return false;
  const frame = taskFrame(state, undefined, {
    kind: 'PHASE',
    phase: 'ORDER_DRINK',
    normalOrderComplete: state.control.normalOrderDone ?? false,
  });
  if (
    legalResponsesForPlayer(
      state,
      state.activePlayerId!,
      reactionContext(state, frame),
    ).every(
      (play) =>
        state.definitions[state.cards[play.cardId]!.definitionId]!.type !==
        'SOMETIMES',
    )
  )
    return false;
  state.control.phaseOpportunityKey = key;
  frame.id = nextResolutionId(state);
  state.resolutionStack.push(frame);
  openWindow(state, frame, 'SOMETIMES', emit);
  return true;
}
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
  const order = timingOrder(state, frame.actorId!);
  const context = reactionContext(state, { ...frame, window: null });
  const eligiblePlayerIds = order.filter(
    (id) => legalResponsesForPlayer(state, id, context).length > 0,
  );
  if (eligiblePlayerIds.length === 0) {
    frame.stage = 'OPERATIONS';
    setWindow(state, frame, null);
    return;
  }
  const window = {
    id: responseWindowIdSchema.parse(
      `window_${matchNamespace(state.matchId)}_${state.version}_${state.resolutionStack.length}`,
    ),
    kind,
    resolutionId: frame.id,
    eligiblePlayerIds,
    passedPlayerIds: [],
    priorityPlayerId: eligiblePlayerIds[0]!,
    submittedResponses: frame.window?.submittedResponses ?? [],
    pendingChoice: null,
  };
  setWindow(state, frame, window);
  emit({
    type: 'RESPONSE_WINDOW_OPENED',
    responseWindowId: window.id,
    resolutionId: frame.id,
    kind,
    // Public history must not disclose the hidden eligible-hand calculation.
    eligiblePlayerIds: order,
    priorityPlayerId: window.priorityPlayerId,
  });
}
function queueCard(
  state: MutableGameState,
  command: Extract<
    StateChangingCommand,
    { type: 'PLAY_CARD' | 'PLAY_RESPONSE' | 'GAMBLING_PLAY' }
  >,
  actorId: PlayerId,
  continuation: MutableFrame['continuation'],
  emit: EmitEvent,
) {
  const definition = cardDefinitionForPlay(
    state,
    actorId,
    command.cardId,
    command.type,
  );
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
      ? target !== undefined &&
          !target.eliminated &&
          (definition.targetPolicy === 'ANY_LIVING_PLAYER' ||
            target.id !== actorId)
      : targetId === undefined,
    'INVALID_TARGET',
  );
  const frame: MutableFrame = {
    origin: { playerId: actorId, cardId: command.cardId },
    ...(parent === undefined
      ? {}
      : {
          responseToOrigin:
            parent.task?.kind === 'POST_LOSS'
              ? {
                  playerId: parent.task.originalPlayer,
                  cardId: parent.task.originalCard,
                }
              : { playerId: parent.actorId, cardId: parent.sourceCardId },
        }),
    id: resolutionIdSchema.parse(
      `resolution_${matchNamespace(state.matchId)}_${state.version}`,
    ),
    kind: 'CARD',
    actorId,
    sourceCardId: command.cardId,
    sourceRevealed: true,
    targetPlayerIds: target === undefined ? [] : [target.id],
    effects: cardEffects(definition),
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
  if (
    command.type === 'PLAY_CARD' &&
    (definition.type === 'ANYTIME' ||
      definition.phaseOpportunity !== undefined) &&
    state.control.phaseEnd !== null
  ) {
    const grace = state.control.phaseEnd;
    grace.passedPlayerIds = [];
    grace.priorityPlayerId = null;
    grace.id = responseWindowIdSchema.parse(
      `window_grace_${state.version}_${grace.phase}`,
    );
  }
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
  queueCard(state, command, actorId, 'ORDER_DRINK', emit);
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

/** Drain children first and recompute the parent's legal responses from its timing origin. */
export function drain(
  state: MutableGameState,
  emit: EmitEvent,
  rng: RandomSource,
) {
  while (state.resolutionStack.length > 0) {
    const frame = state.resolutionStack.at(-1)!;
    if (frame.pendingTasks?.length) {
      const task = frame.pendingTasks.shift()!;
      const child = taskFrame(state, frame, task);
      const context = reactionContext(state, child);
      const eligible =
        taskEvent(task) !== null &&
        state.players.some(
          (p) => legalResponsesForPlayer(state, p.id, context).length > 0,
        );
      if (eligible || task.kind === 'DRINK_BATCH') {
        requireCommand(
          state.resolutionStack.length < MAX_STACK_DEPTH,
          'STACK_LIMIT',
        );
        child.id = nextResolutionId(state);
        state.resolutionStack.push(child);
        openWindow(state, child, 'SOMETIMES', emit);
      } else {
        child.id = frame.id;
        finishTask(state, child, frame, emit, rng);
      }
      continue;
    }
    if (
      state.gambling !== null &&
      frame.id === state.gambling.suspended.resolutionId
    ) {
      const round = state.gambling;
      const closed =
        round.stage === 'SETTLING' ||
        (round.stage === 'ROUND' && round.priorityPlayerId === null);
      if (closed && !round.settlementReady) {
        round.settlementReason =
          round.winnerPlayerId === null ? 'ALL_PASSED' : 'IMMEDIATE_WIN';
        round.stage = 'SETTLING';
        round.settlementReady = true;
        round.winnerPlayerId ??= round.controlPlayerId;
        addTask(frame, {
          kind: 'SETTLEMENT',
          winner: round.winnerPlayerId,
          toInn: false,
        });
        continue;
      }
      if (round.stage === 'ROUND' && !round.checkpointReady) {
        round.checkpointReady = true;
        addTask(frame, {
          kind: 'CHECKPOINT',
          afterFinalPass: false,
          anteAvoidance: false,
          sourceEndsRound: false,
        });
        continue;
      }
      return;
    }
    if (frame.canceled && frame.window !== null) {
      emit({
        type: 'RESPONSE_WINDOW_CLOSED',
        responseWindowId: frame.window.id,
        reason: 'CANCELED',
      });
      setWindow(state, frame, null);
      frame.stage = 'OPERATIONS';
    }
    if (!frame.canceled && frame.stage !== 'OPERATIONS') {
      state.responseWindow = frame.window;
      return;
    }
    if (frame.contestScore !== undefined) {
      const batch = state.resolutionStack.find(
        (entry) => entry.id === frame.parentId,
      )?.task;
      if (batch?.kind === 'DRINK_BATCH' && batch.contestRules !== undefined) {
        const score = batch.scores.find(
          (entry) => entry.playerId === frame.actorId,
        );
        if (score) score.score = Math.max(0, frame.contestScore);
      }
    }
    if (
      (frame.kind === 'DRINK' || frame.kind === 'DRINK_EVENT') &&
      !frame.batchResponseComplete
    ) {
      const batch = [...state.resolutionStack.slice(0, -1)]
        .reverse()
        .find(
          (entry) =>
            entry.task?.kind === 'DRINK_BATCH' &&
            entry.task.deferDrinkConsumption &&
            !entry.task.consumingDrinks,
        );
      if (batch) {
        batch.pendingDrinkResolutions ??= [];
        requireCommand(
          batch.pendingDrinkResolutions.length < 32,
          'STACK_LIMIT',
        );
        batch.pendingDrinkResolutions.push({
          id: frame.id,
          actorId: frame.actorId!,
          kind: frame.kind,
          sourceCardIds: frame.sourceCardIds!,
          provenanceCardIds: frame.drinkProvenance ?? frame.sourceCardIds!,
          effects: frame.effects,
          score: 0,
          alcoholAsFortitude: frame.alcoholAsFortitude ?? false,
          responseComplete: true,
          canceled: frame.canceled,
          ignoredPlayerIds: frame.ignoredPlayerIds,
          ...(frame.drinkRecipientId === undefined
            ? {}
            : { drinkRecipientId: frame.drinkRecipientId }),
          ...(frame.contestScore === undefined
            ? {}
            : { contestScore: frame.contestScore }),
          ...(frame.afterTasks === undefined
            ? {}
            : { afterTasks: frame.afterTasks }),
        });
        batch.pendingDrinks ??= [];
        batch.pendingDrinks.unshift(...(frame.pendingDrinks ?? []));
        for (const id of [
          ...frame.sourceCardIds!,
          ...(frame.pendingDrinks ?? []).flatMap((work) => work.sourceCardIds),
        ])
          state.cards[id]!.location = {
            zone: 'RESOLUTION',
            resolutionId: batch.id,
          };
        state.resolutionStack.pop();
        state.responseWindow = batch.window;
        continue;
      }
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
        frame.pendingTasks?.length ||
        (state.gambling !== null &&
          frame.id === state.gambling.suspended.resolutionId)
      )
        break;
    }
    if (
      frame.pendingTasks?.length ||
      (state.gambling !== null &&
        frame.id === state.gambling.suspended.resolutionId)
    )
      continue;
    if (frame.afterTasks?.length) {
      finishTask(
        state,
        { ...taskFrame(state, frame, frame.afterTasks.shift()!), id: frame.id },
        frame,
        emit,
        rng,
      );
      continue;
    }
    if (frame.pendingDrinks?.length) {
      pushDrinkWork(state, frame, frame.pendingDrinks.shift()!, emit);
      continue;
    }
    if (frame.pendingDrinkResolutions?.length) {
      if (frame.task?.kind === 'DRINK_BATCH') frame.task.consumingDrinks = true;
      pushDrinkWork(state, frame, frame.pendingDrinkResolutions.shift()!, emit);
      continue;
    }
    if (
      frame.task !== undefined &&
      !finishTask(state, frame, state.resolutionStack.at(-2), emit, rng)
    )
      continue;
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
    } else if (frame.sourceCardId !== null) {
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
    if (frame.heldDrinkCardIds?.length) {
      const cards = frame.heldDrinkCardIds;
      state.innDrinkDiscard.push(...cards);
      for (const id of cards)
        state.cards[id]!.location = {
          zone: 'INN_DRINK_DISCARD',
          deckId: state.innDrinkDeck.deckId,
        };
      emit({ type: 'DRINK_DISCARDED', resolutionId: frame.id, cardIds: cards });
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
        frame.sourceCardId === null
          ? undefined
          : state.definitions[state.cards[frame.sourceCardId]!.definitionId];
      if (
        state.gambling.stage === 'ROUND' &&
        (definition?.type === 'GAMBLING' || definition?.type === 'CHEATING')
      )
        advanceGamblingPriority(state, frame.actorId!, emit);
    }
    state.responseWindow = state.resolutionStack.at(-1)?.window ?? null;
    if (
      frame.continuation === 'ORDER_DRINK' ||
      frame.continuation === 'ELIMINATION_CHECK'
    ) {
      completePhase(state, frame.continuation, emit);
    } else if (
      state.responseWindow !== null &&
      !state.resolutionStack.at(-1)!.canceled
    ) {
      const parent = state.resolutionStack.at(-1)!;
      const kind = state.responseWindow.kind;
      emit({
        type: 'RESPONSE_WINDOW_CLOSED',
        responseWindowId: state.responseWindow.id,
        reason: 'REEVALUATED',
      });
      openWindow(state, parent, kind, emit);
    }
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
  if (command.type === 'PASS_ANYTIME') {
    passAnytime(state, actorId, command.responseWindowId, emit);
    return true;
  }
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
      queueCard(state, command, actorId, 'RESUME', emit);
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
  if (
    command.type === 'PLAY_CARD' &&
    state.responseWindow !== null &&
    state.resolutionStack.at(-1)?.task?.kind !== 'PHASE'
  )
    requireCommand(false, 'RESOLUTION_PENDING');
  if (command.type === 'PLAY_CARD') {
    const player = state.players.find((player) => player.id === actorId)!;
    const card = state.cards[command.cardId];
    const definition =
      card === undefined ? undefined : state.definitions[card.definitionId];
    if (
      definition?.type !== 'ANYTIME' &&
      definition?.phaseOpportunity === undefined
    )
      return false;
    requireCommand(state.lifecycle === 'PLAYING', 'WRONG_LIFECYCLE');
    requireCommand(
      !player.eliminated &&
        !state.control.deferredContestPassOutPlayerIds?.includes(actorId),
      'NOT_ELIGIBLE',
    );
    requireCommand(player.hand.includes(command.cardId), 'CARD_NOT_IN_HAND');
    if (state.control.phaseEnd !== null && definition.type === 'ANYTIME') {
      const grace = state.control.phaseEnd;
      requireCommand(grace.priorityPlayerId === actorId, 'NOT_PRIORITY');
      const legal = legalAnytimeCards(state, actorId).find(
        (c) => c.cardId === command.cardId,
      );
      requireCommand(legal !== undefined, 'ILLEGAL_TIMING');
      requireCommand(
        legal.requiresTarget
          ? command.targetPlayerId !== undefined &&
              legal.legalTargetPlayerIds.includes(command.targetPlayerId)
          : command.targetPlayerId === undefined,
        'INVALID_TARGET',
      );
    }
    queueCard(state, command, actorId, 'RESUME', emit);
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
  const definition = cardDefinitionForPlay(
    state,
    actorId,
    command.cardId,
    command.type,
  );
  const legal = legalResponsesForPlayer(
    state,
    actorId,
    reactionContext(state, frame),
  ).find((response) => response.cardId === command.cardId);
  if (legal === undefined)
    validateEffects(
      state,
      {
        ...frame,
        actorId,
        sourceCardId: command.cardId,
        effects: JSON.parse(JSON.stringify(definition.effects)) as Effect[],
        nextEffectIndex: 0,
        parentId: frame.id,
        targetPlayerIds:
          command.targetPlayerId === undefined ? [] : [command.targetPlayerId],
      },
      frame,
    );
  requireCommand(legal !== undefined, 'ILLEGAL_TIMING');
  requireCommand(
    legal.requiresTarget
      ? command.targetPlayerId !== undefined &&
          legal.legalTargetPlayerIds.includes(command.targetPlayerId)
      : command.targetPlayerId === undefined,
    'INVALID_TARGET',
  );
  queueCard(state, command, actorId, 'RESUME', emit);
  return true;
}
