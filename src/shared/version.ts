import { z } from 'zod';

export const stateVersionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .brand<'StateVersion'>();
export type StateVersion = z.infer<typeof stateVersionSchema>;

// A pure counter contract, not a command handler or phase transition.
export function nextStateVersion(current: StateVersion): StateVersion {
  return stateVersionSchema.parse(stateVersionSchema.parse(current) + 1);
}
