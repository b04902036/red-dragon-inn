/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { contentPackSchema } from '../../src/content/pack';
import { rdi1SourceSchema } from '../../src/content/rdi1-source';
export const rdi1Pack = contentPackSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/pack.json', 'utf8'),
  ) as unknown,
);
export const rdi1Source = rdi1SourceSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi1/source-normalized.json', 'utf8'),
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
