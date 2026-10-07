import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
// Synthetic binding of the verified counter family; no character/title checks.
export const m16Trigger: ResponseTrigger = {
  event: 'CARD',
  alternatives: [
    [
      { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
      { kind: 'NEGATABLE', value: true },
    ],
  ],
};
export const m16Effects: Effect[] = [{ op: 'NEGATE', scope: 'TOP_STACK' }];
export const m16Metadata = {
  counterFamily: 'rdi.negate_sometimes',
  counterPolicy: 'SAME_FAMILY_ONLY' as const,
};
