import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32, seededRng, shuffle } from '../../src/engine/rng';
import { drawFromPiles } from '../../src/engine/decks';
import { compareIds, matchNamespace } from '../../src/engine/identity';
import { cardInstanceIdSchema, matchIdSchema } from '../../src/shared/ids';
import type { RandomSource } from '../../src/engine/rng';

const cards = ['card_a', 'card_b', 'card_c', 'card_d'].map((id) =>
  cardInstanceIdSchema.parse(id),
);
describe('deterministic RNG and piles', () => {
  it('matches the versioned Mulberry32 vector and resumes from stored state', () => {
    const seed = seededRng(1);
    const first = mulberry32.next(seed);
    expect(first.value).toBe(0.6270739405881613);
    expect(first.state).toEqual({
      algorithm: 'MULBERRY32_V1',
      seed: 1,
      state: 1831565814,
      draws: 1,
    });
    expect(mulberry32.next(first.state).value).toBe(0.002735721180215478);
    expect(
      mulberry32.next(
        JSON.parse(JSON.stringify(first.state)) as typeof first.state,
      ),
    ).toEqual(mulberry32.next(first.state));
    expect(seed).toEqual(seededRng(1));
  });
  it('shuffles through the injected source without mutating inputs or dropping copies', () => {
    const rng = seededRng(42);
    const a = shuffle(cards, rng);
    const b = shuffle(cards, rng);
    expect(a).toEqual(b);
    expect(a.state.draws).toBe(3);
    expect([...a.cards].sort()).toEqual([...cards].sort());
    expect(shuffle(cards, seededRng(43)).cards).not.toEqual(a.cards);
    const source: RandomSource = {
      next: (state) => ({
        value: 0,
        state: { ...state, draws: state.draws + 1 },
      }),
    };
    expect(shuffle(cards, rng, source).cards).toEqual([
      cards[1],
      cards[2],
      cards[3],
      cards[0],
    ]);
    expect(cards.map(String)).toEqual(['card_a', 'card_b', 'card_c', 'card_d']);
    expect(rng).toEqual(seededRng(42));
    expect(shuffle([], rng)).toEqual({ cards: [], state: rng });
    expect(shuffle([cards[0]], rng).state.draws).toBe(0);
  });
  it.each([-1, 0.5, 4294967296, NaN, Infinity, '1'])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => seededRng(seed as number)).toThrow();
    },
  );
  it('rejects invalid injected output, changed seeds, broken counters, and exhausted counters', () => {
    for (const value of [-1, 1, NaN])
      expect(() =>
        shuffle(cards, seededRng(1), { next: (state) => ({ value, state }) }),
      ).toThrow();
    expect(() =>
      shuffle(cards, seededRng(1), {
        next: (state) => ({
          value: 0.5,
          state: { ...state, seed: 2, draws: 1 },
        }),
      }),
    ).toThrow('seed');
    expect(() =>
      shuffle(cards, seededRng(1), {
        next: (state) => ({ value: 0.5, state }),
      }),
    ).toThrow('draw count');
    expect(() =>
      mulberry32.next({ ...seededRng(1), draws: Number.MAX_SAFE_INTEGER }),
    ).toThrow();
  });
  it('draws existing cards first, reshuffles only discard, and preserves segment order for events', () => {
    const result = drawFromPiles(
      cards.slice(0, 1),
      cards.slice(1),
      3,
      seededRng(1),
    );
    expect(result.drawn[0]).toBe(cards[0]);
    expect(result.drawn).toHaveLength(3);
    expect(result.deck).toHaveLength(1);
    expect(result.discard).toEqual([]);
    expect(result.steps.map((s) => s.kind)).toEqual([
      'DRAW',
      'RESHUFFLE',
      'DRAW',
    ]);
    expect(result.steps[1]?.cardIds).toEqual([
      ...result.drawn.slice(1),
      ...result.deck,
    ]);
    expect([...result.drawn, ...result.deck].sort()).toEqual([...cards].sort());
    expect(result.rng.draws).toBe(2);
  });
  it('handles exhausted piles, short draws, zero draws, and a one-card discard without extra RNG', () => {
    expect(drawFromPiles([], [], 2, seededRng(1)).drawn).toEqual([]);
    expect(drawFromPiles(cards, [], 0, seededRng(1))).toMatchObject({
      deck: cards,
      drawn: [],
      steps: [],
    });
    expect(drawFromPiles([], cards.slice(0, 1), 3, seededRng(1))).toMatchObject(
      { drawn: cards.slice(0, 1), deck: [], discard: [], rng: seededRng(1) },
    );
    expect(() => drawFromPiles(cards, cards, 1, seededRng(1))).toThrow(
      'Duplicate',
    );
    expect(() => drawFromPiles(cards, [], -1, seededRng(1))).toThrow();
  });
  it('uses locale-independent identity ordering and stable match namespaces', () => {
    expect(['card_a', 'card_Z', 'card_0'].sort(compareIds)).toEqual([
      'card_0',
      'card_Z',
      'card_a',
    ]);
    expect(compareIds('x', 'x')).toBe(0);
    expect(matchNamespace(matchIdSchema.parse('match_core'))).toMatch(
      /^[0-9a-f]{16}$/,
    );
    expect(matchNamespace(matchIdSchema.parse('match_other'))).not.toBe(
      matchNamespace(matchIdSchema.parse('match_core')),
    );
  });
  it('has no ambient randomness or platform imports in the pure engine', () => {
    for (const file of readdirSync('src/engine').filter((file) =>
      file.endsWith('.ts'),
    )) {
      const source = readFileSync(`src/engine/${file}`, 'utf8');
      expect(source).not.toMatch(/Math\.random\s*\(/);
      expect(source).not.toMatch(/from\s+['"](?:react|cloudflare:|node:)/);
    }
  });
});
