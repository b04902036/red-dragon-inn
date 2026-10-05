/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { contentPackSchema } from '../../src/content/pack';
import { rdi1SourceSchema } from '../../src/content/rdi1-source';
import { compileRdi1Source } from '../../src/content/rdi1-compiler';
export const rdi1Source = rdi1SourceSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
  ) as unknown,
);
// Exercise the candidate before a new immutable artifact is authorized by the
// per-item audit. Published v1 remains a separate compatibility fixture.
export const rdi1Pack = compileRdi1Source(rdi1Source);
export const rdi1PublishedV1 = contentPackSchema.parse(
  JSON.parse(
    readFileSync(
      'content-private/imports/rdi1/versions/content_rdi1_mechanics_v1/pack.json',
      'utf8',
    ),
  ) as unknown,
);
export const rdi1Records = [
  ...rdi1Source.characters.flatMap((character) =>
    character.cards.map((card) => ({
      id: `carddef_rdi1_${card.cardKey.replaceAll('.', '_').replaceAll('-', '_')}`,
      deck: character.id,
      quantity: card.quantity,
      mechanic: card.mechanicId,
    })),
  ),
  ...rdi1Source.drinkDeck.cards.map((card) => ({
    id: `carddef_rdi1_drink_${card.drinkKey}`,
    deck: 'drink',
    quantity: card.quantity,
    mechanic: card.drinkKey,
  })),
];
