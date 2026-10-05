import type { Effect } from '../content/effects';
import type { PlayerId } from '../shared/ids';
import { requireCommand } from './errors';
import { drawHand } from './card-moves';
import { applyCustomEffect } from './effect-handlers';
import { changeStat } from './stats';
import { drinkModifierEffects } from './drinks';
import {
  startGambling,
  takeGamblingControl,
  requestImmediateWin,
  leaveGambling,
} from './gambling';
import type { EmitEvent } from './event-writer';
import type { RandomSource } from './rng';
import type { MutableGameState } from './types';
import { executeGenericOperation, queuePostLoss } from './workflows';
export type MutableFrame = MutableGameState['resolutionStack'][number];

export function effectTargets(
  state: MutableGameState,
  frame: MutableFrame,
  target: Extract<Effect, { target: unknown }>['target'],
) {
  return state.players.filter(
    (player) =>
      !player.eliminated &&
      !state.control.deferredContestPassOutPlayerIds?.includes(player.id) &&
      !frame.ignoredPlayerIds.includes(player.id) &&
      (target === 'ALL_PLAYERS' ||
        (target === 'SELF' &&
          player.id === (frame.drinkRecipientId ?? frame.actorId)) ||
        (target === 'ORIGINAL_SOURCE_PLAYER' &&
          player.id === frame.responseToOrigin?.playerId) ||
        (target === 'SOURCE_ACTOR' &&
          player.id === frame.responseToOrigin?.playerId) ||
        (target === 'CHOSEN_PLAYER' &&
          frame.targetPlayerIds.includes(player.id)) ||
        (target === 'EACH_OTHER_PLAYER' && player.id !== frame.actorId)),
  );
}
export function affectedPlayers(
  state: MutableGameState,
  frame: MutableFrame,
): PlayerId[] {
  return state.players
    .filter(
      (player) =>
        !frame.ignoredPlayerIds.includes(player.id) &&
        frame.effects
          .slice(frame.nextEffectIndex)
          .some(
            (effect) =>
              'target' in effect &&
              ((effect.op === 'CHANGE_STAT' &&
              effect.stat === 'FORTITUDE' &&
              effect.delta < 0 &&
              frame.redirectedFortitudePlayerId !== undefined
                ? state.players.filter(
                    (p) =>
                      p.id === frame.redirectedFortitudePlayerId &&
                      !p.eliminated &&
                      !frame.ignoredPlayerIds.includes(p.id),
                  )
                : effectTargets(state, frame, effect.target)
              ).some((target) => target.id === player.id) ||
                ((effect.op === 'TRANSFER_GOLD' ||
                  effect.op === 'COLLECT_GOLD') &&
                  player.id === frame.actorId &&
                  effectTargets(state, frame, effect.target).some(
                    (target) => target.id !== frame.actorId,
                  ))),
          ),
    )
    .map((player) => player.id);
}
export function discardCards(
  state: MutableGameState,
  player: MutableGameState['players'][number],
  cardIds: readonly import('../shared/ids').CardInstanceId[],
  emit: EmitEvent,
) {
  for (const id of cardIds) {
    player.hand.splice(player.hand.indexOf(id), 1);
    player.characterDiscard.push(id);
    state.cards[id]!.location = {
      zone: 'CHARACTER_DISCARD',
      playerId: player.id,
      deckId: player.characterDeck.deckId,
    };
  }
  emit({ type: 'CARDS_DISCARDED', playerId: player.id, cardIds: [...cardIds] });
}

/** Executes synchronous operations; choices are suspended by the timing dispatcher. */
export function executeOperation(
  state: MutableGameState,
  frame: MutableFrame,
  effect: Exclude<
    Effect,
    { op: 'OPEN_CHOICE' | 'OPEN_OPTION' | 'DISCARD_CARDS' }
  >,
  emit: EmitEvent,
  rng: RandomSource,
) {
  if (executeGenericOperation(state, frame, effect, emit, rng)) return;
  const targets =
    'target' in effect ? effectTargets(state, frame, effect.target) : [];
  const parent = state.resolutionStack.at(-2);
  switch (effect.op) {
    case 'CHANGE_STAT':
      for (const player of effect.stat === 'FORTITUDE' &&
      effect.delta < 0 &&
      frame.redirectedFortitudePlayerId !== undefined
        ? state.players.filter(
            (p) =>
              p.id === frame.redirectedFortitudePlayerId &&
              !p.eliminated &&
              !frame.ignoredPlayerIds.includes(p.id),
          )
        : targets) {
        const previous = player.fortitude;
        changeStat(state, player, effect.stat, effect.delta, emit);
        if (effect.stat === 'FORTITUDE' && player.fortitude < previous)
          queuePostLoss(frame, player.id, previous - player.fortitude);
      }
      return;
    case 'DRAW_CARDS':
      for (const player of targets)
        drawHand(state, player, emit, rng, effect.count);
      return;
    case 'IGNORE':
      requireCommand(
        parent !== undefined && frame.actorId !== null,
        'INVALID_EFFECT',
      );
      if (!parent.ignoredPlayerIds.includes(frame.actorId))
        parent.ignoredPlayerIds.push(frame.actorId);
      emit({
        type: 'SOURCE_IGNORED',
        resolutionId: parent.id,
        playerId: frame.actorId,
      });
      return;
    case 'NEGATE':
      requireCommand(parent !== undefined, 'INVALID_EFFECT');
      parent.canceled = true;
      emit({
        type: 'SOURCE_NEGATED',
        resolutionId: parent.id,
        byResolutionId: frame.id,
      });
      return;
    case 'MODIFY_PENDING_EFFECT': {
      const pending = parent?.effects[effect.effectIndex];
      requireCommand(
        parent !== undefined &&
          pending?.op === 'CHANGE_STAT' &&
          effect.effectIndex >= parent.nextEffectIndex,
        'INVALID_EFFECT',
      );
      requireCommand(
        Number.isSafeInteger(pending.delta + effect.delta),
        'INVALID_EFFECT',
      );
      pending.delta += effect.delta;
      if (pending.stat === 'ALCOHOL' && parent.contestScore !== undefined)
        parent.contestScore += effect.delta;
      emit({
        type: 'PENDING_EFFECT_MODIFIED',
        resolutionId: parent.id,
        effectIndex: effect.effectIndex,
        delta: effect.delta,
      });
      return;
    }
    case 'MODIFY_DRINK': {
      const { alcohol, fortitude } = drinkModifierEffects(
        parent!,
        effect.allowDrinkEvents,
      );
      if (parent!.alcoholAsFortitude) fortitude.delta += effect.alcoholDelta;
      else alcohol.delta += effect.alcoholDelta;
      fortitude.delta += effect.fortitudeDelta;
      if (parent!.contestScore !== undefined)
        parent!.contestScore += effect.alcoholDelta;
      emit({
        type: 'DRINK_MODIFIED',
        resolutionId: parent!.id,
        alcoholDelta: effect.alcoholDelta,
        fortitudeDelta: effect.fortitudeDelta,
      });
      return;
    }
    case 'CUSTOM':
      for (const player of targets) applyCustomEffect(effect, player, emit);
      return;
    case 'START_GAMBLING':
      emit({
        type: 'GAMBLING_REQUESTED',
        playerId: frame.actorId!,
        resolutionId: frame.id,
      });
      startGambling(state, frame, emit);
      return;
    case 'TAKE_GAMBLING_CONTROL':
      takeGamblingControl(state, frame, effect.allowedNextCategories, emit);
      return;
    case 'WIN_GAMBLING':
      requestImmediateWin(state, frame, emit);
      return;
    case 'LEAVE_GAMBLING':
      for (const player of targets) leaveGambling(state, player.id, emit);
      return;
  }
}
