import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';

// Synthetic user-authorized mechanics only. No official Gog wording or
// production RDI2 content is imported by these fixtures.
const anteConditions: ResponseTrigger['alternatives'][number] = [
  { kind: 'SYSTEM_EVENT', events: ['ANTE_REQUIRED'] },
  { kind: 'PAYMENT_CONTEXT', payer: 'SELF', purpose: 'ANTE', minAmount: 1 },
  { kind: 'GAMBLING', fact: 'PARTICIPANT' },
];
export const m12AnteTrigger: ResponseTrigger = {
  event: 'SYSTEM',
  alternatives: [anteConditions],
};
export const m12AnteEffects: Effect[] = [
  { op: 'CANCEL_CURRENT_ANTE_FOR_SELF' },
  { op: 'LEAVE_GAMBLING', target: 'SELF' },
];
export const m12DualTrigger: ResponseTrigger = {
  event: 'ANY',
  alternatives: [
    anteConditions,
    [
      { kind: 'SOURCE_KIND', kinds: ['DRINK'] },
      { kind: 'AFFECTS', relation: 'SELF' },
    ],
  ],
};
export const m12DualEffects: Effect[] = [
  {
    op: 'CONTEXT_BRANCH',
    branches: ['CANCEL_ANTE_AND_LEAVE', 'IGNORE_CURRENT_DRINK'],
  },
];
