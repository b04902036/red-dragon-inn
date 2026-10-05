import type { CardDefinition } from '../content/cards';
import type { z } from 'zod';
import type { sourceCapabilitySchema } from '../content/mechanics';
import type { ResolutionFrame } from './model';
type Capability = z.infer<typeof sourceCapabilitySchema>;
export function sourceCapabilities(
  definition: CardDefinition | undefined,
  parent?: ResolutionFrame,
): Capability[] {
  const facts = new Set<Capability>(definition?.capabilities ?? []);
  for (const effect of definition?.effects ?? []) {
    if (
      [
        'MODIFY_DRINK',
        'SPLIT_CURRENT_DRINK',
        'PASS_CURRENT_DRINK',
        'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE',
      ].includes(effect.op) ||
      ((effect.op === 'IGNORE' ||
        effect.op === 'NEGATE' ||
        effect.op === 'CONTEXT_BRANCH') &&
        parent?.kind === 'DRINK')
    )
      facts.add('CHANGES_DRINK_EFFECT');
    if (['ORDER_EXTRA_DRINKS', 'DEAL_DRINKS'].includes(effect.op))
      facts.add('ORDERS_DRINK');
    if (
      ['FORCE_DRINK', 'QUEUE_EXTRA_DRINK', 'FORCE_SIMULTANEOUS_DRINK'].includes(
        effect.op,
      )
    )
      facts.add('FORCES_DRINK');
    if (effect.op === 'CHANGE_STAT' && effect.stat === 'ALCOHOL')
      facts.add('DIRECT_ALCOHOL_STAT');
    if (
      effect.op === 'CANCEL_CURRENT_ANTE_FOR_SELF' ||
      (effect.op === 'CONTEXT_BRANCH' &&
        parent?.task?.kind === 'PAYMENT' &&
        parent.task.purpose === 'ANTE')
    )
      facts.add('AVOIDS_ANTE');
    if (
      (effect.op === 'MODIFY_DRINK' || effect.op === 'MODIFY_PENDING_EFFECT') &&
      effect.allowDrinkEvents
    )
      facts.add('AFFECTS_DRINK_EVENT');
  }
  return [...facts].sort();
}
