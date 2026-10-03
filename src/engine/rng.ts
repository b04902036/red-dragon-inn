import { z } from 'zod';
import type { DeterministicRngState } from './model';

const uint32 = z.number().int().min(0).max(0xffffffff);
export const rngStateSchema = z.strictObject({
  algorithm: z.literal('MULBERRY32_V1'),
  seed: uint32,
  state: uint32,
  draws: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export interface RandomSource {
  next(state: DeterministicRngState): {
    value: number;
    state: DeterministicRngState;
  };
}
export function seededRng(seed: number): DeterministicRngState {
  return rngStateSchema.parse({
    algorithm: 'MULBERRY32_V1',
    seed,
    state: seed,
    draws: 0,
  });
}
/** Versioned, portable unsigned 32-bit Mulberry32. Never uses ambient randomness. */
export const mulberry32: RandomSource = {
  next(input) {
    const state = rngStateSchema.parse(input);
    const nextState = (state.state + 0x6d2b79f5) >>> 0;
    let bits = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return {
      value: ((bits ^ (bits >>> 14)) >>> 0) / 0x100000000,
      state: rngStateSchema.parse({
        ...state,
        state: nextState,
        draws: state.draws + 1,
      }),
    };
  },
};
export function shuffle<T>(
  input: readonly T[],
  inputState: DeterministicRngState,
  source: RandomSource = mulberry32,
) {
  const cards = [...input];
  let state = rngStateSchema.parse(inputState);
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const next = source.next({ ...state });
    const value = z.number().min(0).lt(1).parse(next.value);
    const updated = rngStateSchema.parse(next.state);
    if (updated.seed !== state.seed || updated.draws !== state.draws + 1)
      throw new RangeError('Random source changed seed or draw count');
    state = updated;
    const j = Math.floor(value * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return { cards, state };
}
