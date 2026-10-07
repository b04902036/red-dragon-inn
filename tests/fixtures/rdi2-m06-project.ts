import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';

// Synthetic acceptance fixture for user-authorized project rules. This is not
// an RDI2 compiler, imported production card, or verified original card text.
export const m06ProjectEffects: Effect[] = [
  { op: 'NEGATE', scope: 'TOP_STACK' },
  { op: 'WIN_GAMBLING' },
];
export const m06ProjectTrigger: ResponseTrigger = {
  event: 'CARD',
  alternatives: [
    [
      { kind: 'SOURCE_TYPE', types: ['CHEATING'] },
      { kind: 'GAMBLING', fact: 'ACTIVE' },
      { kind: 'GAMBLING', fact: 'PARTICIPANT' },
    ],
  ],
};
