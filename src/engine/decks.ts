import { z } from 'zod';
import { cardInstanceIdSchema } from '../shared/ids';
import type { CardInstanceId } from '../shared/ids';
import type { DeterministicRngState } from './model';
import { mulberry32, rngStateSchema, shuffle } from './rng';
import type { RandomSource } from './rng';

export type DrawStep = {
  kind: 'DRAW' | 'RESHUFFLE';
  cardIds: CardInstanceId[];
};
/** Draw top-first; exhaust the deck before recycling discard. Drawn cards never recycle. */
export function drawFromPiles(
  inputDeck: readonly CardInstanceId[],
  inputDiscard: readonly CardInstanceId[],
  inputCount: number,
  inputRng: DeterministicRngState,
  source: RandomSource = mulberry32,
) {
  let deck = z.array(cardInstanceIdSchema).parse(inputDeck);
  let discard = z.array(cardInstanceIdSchema).parse(inputDiscard);
  const count = z.number().int().min(0).max(64).parse(inputCount);
  if (new Set([...deck, ...discard]).size !== deck.length + discard.length)
    throw new RangeError('Duplicate card across draw piles');
  let rng = rngStateSchema.parse(inputRng);
  const drawn: CardInstanceId[] = [];
  const steps: DrawStep[] = [];
  while (drawn.length < count) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      const result = shuffle(discard, rng, source);
      deck = result.cards;
      rng = result.state;
      discard = [];
      steps.push({ kind: 'RESHUFFLE', cardIds: [...deck] });
    }
    const chunk = deck.splice(0, count - drawn.length);
    drawn.push(...chunk);
    steps.push({ kind: 'DRAW', cardIds: chunk });
  }
  return { deck, discard, drawn, steps, rng };
}
