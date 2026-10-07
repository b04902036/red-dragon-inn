import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
// Original synthetic binding of the publisher's shared Drink-change counter.
export const m27Trigger: ResponseTrigger = {
  event: 'CARD',
  alternatives: [
    [
      { kind: 'SOURCE_TYPE', types: ['SOMETIMES'] },
      { kind: 'NEGATABLE', value: true },
      {
        kind: 'SOURCE_CAPABILITY',
        capabilities: ['CHANGES_DRINK_EFFECT'],
        match: 'ANY',
      },
      {
        kind: 'SOURCE_CAPABILITY',
        capabilities: ['AFFECTS_DRINK_EVENT'],
        match: 'NONE',
      },
    ],
  ],
};
export const m27Effects: Effect[] = [{ op: 'NEGATE', scope: 'TOP_STACK' }];
export const m27Metadata = {
  counterFamily: 'rdi.negate_drink_change',
  allowedCounterFamilies: ['rdi.negate_sometimes', 'rdi_core_hard_no'],
};
