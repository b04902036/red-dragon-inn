import type { Effect } from '../content/effects';
import type { CardDefinition } from '../content/cards';
import { requireCommand } from './errors';
import { affectedPlayers, effectTargets } from './effect-operations';
import type { MutableFrame } from './effect-operations';
import type { MutableGameState } from './types';
import { drinkModifierEffects } from './drinks';
import { activeGamblers, validateGamblingStart } from './gambling';
import { validateGenericEffects } from './generic-effect-validation';
export function cardEffects(definition: CardDefinition): Effect[] {
  return [
    ...(definition.mandatoryGoldCost === undefined
      ? []
      : [
          {
            op: 'PAY_INN' as const,
            target: 'SELF' as const,
            amount: definition.mandatoryGoldCost,
            requireFullPayment: true,
          },
        ]),
    ...(JSON.parse(JSON.stringify(definition.effects)) as Effect[]),
  ];
}
export function hasChosenTarget(effects: readonly Effect[]) {
  for (const effect of effects) {
    if (effect.op === 'OPEN_CHOICE') return false;
    if ('target' in effect && effect.target === 'CHOSEN_PLAYER') return true;
  }
  return false;
}
export function validateEffects(
  state: MutableGameState,
  frame: MutableFrame,
  parent: MutableFrame | undefined,
) {
  validateGenericEffects(state, frame, parent);
  requireCommand(frame.effects.length <= 32, 'INVALID_EFFECT');
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
          (frame.parentId === state.gambling.suspended.resolutionId ||
            (effect.op === 'WIN_GAMBLING' && parent?.kind === 'CARD')) &&
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
        Number.isSafeInteger(
          alcohol.delta + (parent.alcoholAsFortitude ? 0 : effect.alcoholDelta),
        ) &&
          Number.isSafeInteger(
            fortitude.delta +
              effect.fortitudeDelta +
              (parent.alcoholAsFortitude ? effect.alcoholDelta : 0),
          ),
        'INVALID_EFFECT',
      );
      if (parent.alcoholAsFortitude) fortitude.delta += effect.alcoholDelta;
      else alcohol.delta += effect.alcoholDelta;
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
