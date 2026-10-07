import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';

// Synthetic binding of the user-authorized M15 template to the shared engine.
export const m15Trigger: ResponseTrigger = {
  event: 'CARD',
  alternatives: [
    [
      { kind: 'SOURCE_TYPE', types: ['ACTION', 'SOMETIMES', 'ANYTIME'] },
      {
        kind: 'PENDING_STAT',
        stat: 'FORTITUDE',
        direction: 'ANY',
        relation: 'SELF',
      },
    ],
  ],
};
export const m15Effects: Effect[] = [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }];
