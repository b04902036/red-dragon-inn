import { expect, it } from 'vitest';
import { contentPresentation } from '../../src/content/presentation';
import { productionFixture } from '../fixtures/production-pack';

it('preserves supplied canonical production presentation without inventing card text or exposing effects', () => {
  const pack = productionFixture();
  const presentation = contentPresentation(pack);
  expect(presentation.contentVersionId).toBe(pack.version.id);
  for (const definition of pack.cards)
    expect(
      presentation.cards.find((card) => card.id === definition.id)!.rulesText,
    ).toBe(definition.rulesText);
  expect(JSON.stringify(presentation)).not.toMatch(
    /"(?:effects|deckCards|ownerId|rng|seed)":/,
  );
});

it('derives original fixture stat guidance for Gold/Alcohol and zero/positive/negative changes without changing definitions', () => {
  const pack = productionFixture();
  const original = structuredClone(pack);
  pack.cards[0]!.effects = [
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'GOLD', delta: 0 },
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'ALCOHOL', delta: 2 },
    { op: 'CHANGE_STAT', target: 'SELF', stat: 'FORTITUDE', delta: -1 },
  ];
  const presentation = contentPresentation(pack, true);
  expect(presentation.cards[0]!.rulesText).toContain(
    'Gold +0. Alcohol +2. Fortitude -1.',
  );
  expect(presentation.cards[0]!.affectsSelf).toBe(true);
  expect(pack.cards[0]!.rulesText).toBe(original.cards[0]!.rulesText);
});
