import { resolutionIdSchema } from '../shared/ids';
import { matchNamespace } from './identity';
import type { MutableGameState } from './types';
export function nextResolutionId(state: MutableGameState) {
  const ordinal = (state.control.resolutionOrdinal ?? 0) + 1;
  if (!Number.isSafeInteger(ordinal))
    throw new RangeError('Resolution ID counter exhausted');
  state.control.resolutionOrdinal = ordinal;
  return resolutionIdSchema.parse(
    `resolution_${matchNamespace(state.matchId)}_${state.version}_work_${ordinal}`,
  );
}
