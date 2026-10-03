import { resourceAdjustmentParamsSchema } from '../../../content/effects';
import type { EmitEvent } from '../../event-writer';
import { requireCommand } from '../../errors';
import type { MutableGameState } from '../../types';
export const sampleResourceHandler = {
  params: resourceAdjustmentParamsSchema,
  apply(
    player: MutableGameState['players'][number],
    input: unknown,
    emit: EmitEvent,
  ) {
    const params = resourceAdjustmentParamsSchema.parse(input);
    const resource = player.special.resources[params.resource];
    requireCommand(resource !== undefined, 'INVALID_EFFECT');
    requireCommand(Number.isSafeInteger(resource.value), 'INVALID_EFFECT');
    const requested = BigInt(resource.value) + BigInt(params.delta);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    const value = Number(
      requested > max ? max : requested < -max ? -max : requested,
    );
    const delta = value - resource.value;
    resource.value = value;
    emit({
      type: 'RESOURCE_CHANGED',
      playerId: player.id,
      resource: params.resource,
      delta,
      value,
    });
  },
};
