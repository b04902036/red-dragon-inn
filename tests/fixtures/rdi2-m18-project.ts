import type { Effect } from '../../src/content/effects';
import type { ResponseTrigger } from '../../src/content/reaction-triggers';
// Original synthetic runtime binding; no production card import or compiler.
export const m18Trigger: ResponseTrigger = {
  event: 'SYSTEM',
  alternatives: [
    [
      { kind: 'SYSTEM_EVENT', events: ['PHASE_OPPORTUNITY'] },
      { kind: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' },
    ],
  ],
};
export const m18Effects: Effect[] = [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }];
export const m18Metadata = {
  phaseOpportunity: 'ORDER_DRINK' as const,
  mandatoryGoldCost: 1,
  trigger: m18Trigger,
};
