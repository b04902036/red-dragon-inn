import type { Effect } from '../../src/content/effects';
// Synthetic existing-engine subset; the leading-Event skip capability is pending.
export const m20SupportedEffects: Effect[] = [
  {
    op: 'FORCE_SIMULTANEOUS_DRINK',
    targets: 'ALL_PLAYERS',
    source: 'INN',
  },
];
