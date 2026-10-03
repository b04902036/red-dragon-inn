import type { Effect } from '../content/effects';
import type { EmitEvent } from './event-writer';
import type { MutableGameState } from './types';
import { effectHandlers } from './effects/registry';

export function applyCustomEffect(
  effect: Extract<Effect, { op: 'CUSTOM' }>,
  player: MutableGameState['players'][number],
  emit: EmitEvent,
) {
  const handler = effectHandlers[effect.effect_key];
  handler.params.parse(effect.params);
  handler.apply(player, effect.params, emit);
}
