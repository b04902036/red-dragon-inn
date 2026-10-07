import type { Effect } from '../../src/content/effects';
import { m18Trigger } from './rdi2-m18-project';
// Synthetic binding only for the existing shared free-order branch.
// Refill waiver requires a future shared capability; no simulated resolver here.
export const m19OrderEffects: Effect[] = [
  { op: 'ORDER_EXTRA_DRINKS', count: 2 },
];
export const m19OrderMetadata = {
  phaseOpportunity: 'ORDER_DRINK' as const,
  trigger: m18Trigger,
};
