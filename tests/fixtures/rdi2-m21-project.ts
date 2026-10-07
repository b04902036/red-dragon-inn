import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
// Original synthetic fixture for the explicitly authorized Gog template only.
export const m21Trigger: ResponseTrigger = {
  event: 'DRINK',
  alternatives: [
    [
      { kind: 'SOURCE_ACTOR', relation: 'OTHER' },
      { kind: 'SOURCE_TYPE', types: ['DRINK'] },
    ],
  ],
};
export const m21Effects: Effect[] = [
  { op: 'QUEUE_EXTRA_DRINK', target: 'SOURCE_ACTOR' },
];
