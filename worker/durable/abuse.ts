import { z } from 'zod';

export const socketAbuseSchema = z.strictObject({
  since: z.number().nonnegative(),
  frames: z.number().int().nonnegative(),
  malformed: z.number().int().nonnegative(),
});
export const commandBudgetSchema = z.strictObject({
  since: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
});
export function commandBudget(previous: unknown, now: number) {
  const parsed = commandBudgetSchema.safeParse(previous);
  const state =
    parsed.success &&
    now >= parsed.data.since &&
    now - parsed.data.since < 10_000
      ? parsed.data
      : { since: now, count: 0 };
  return { ...state, count: state.count + 1 };
}
export function socketBudget(
  previous: unknown,
  now: number,
  malformed = false,
) {
  const parsed = socketAbuseSchema.safeParse(previous);
  const state =
    parsed.success &&
    now >= parsed.data.since &&
    now - parsed.data.since < 10_000
      ? parsed.data
      : { since: now, frames: 0, malformed: 0 };
  return {
    ...state,
    frames: state.frames + (malformed ? 0 : 1),
    malformed: state.malformed + (malformed ? 1 : 0),
  };
}
