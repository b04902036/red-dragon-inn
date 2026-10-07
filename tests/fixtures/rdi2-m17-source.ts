import type { ResponseTrigger } from '../../src/content/reaction-triggers';
import type { Effect } from '../../src/content/effects';
export const m17Trigger: ResponseTrigger = {
  event: 'DRINK',
  alternatives: [[{ kind: 'AFFECTS', relation: 'SELF' }]],
};
export const m17Effects: Effect[] = [{ op: 'IGNORE', scope: 'CURRENT_EFFECT' }];
