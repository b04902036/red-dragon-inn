import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
// Synthetic generic binding for the independently verified M22 source plan.
export const m22Effects: Effect[] = [
  { op: 'PASS_CURRENT_DRINK', target: 'CHOSEN_PLAYER' },
];
export const m22Trigger: ResponseTrigger = {
  event: 'DRINK',
  alternatives: [
    [
      { kind: 'AFFECTS', relation: 'SELF' },
      { kind: 'SOURCE_TYPE', types: ['DRINK'] },
    ],
  ],
};
