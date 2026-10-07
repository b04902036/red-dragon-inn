import { readFileSync } from 'node:fs';
import { contentPackSchema } from '../../src/content/pack';
import { rdi2SourceSchema } from '../../src/content/rdi2-source';
export const rdi2Pack = contentPackSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi2/pack.json', 'utf8'),
  ) as unknown,
);
export const combinedPack = contentPackSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi2/pack-combined.json', 'utf8'),
  ) as unknown,
);
export const rdi2Source = rdi2SourceSchema.parse(
  JSON.parse(
    readFileSync('content-private/imports/rdi2/source-normalized.json', 'utf8'),
  ) as unknown,
);
export const rdi2Records = [
  ...rdi2Source.characters.flatMap((character) =>
    character.cards.map((card) => ({
      id: `carddef_${card.cardKey.replaceAll('.', '_')}`,
      deck: character.id,
      quantity: card.quantity,
      mechanic: card.mechanicId,
    })),
  ),
  ...rdi2Source.drinkDeck.cards.map((card) => ({
    id: `carddef_rdi2_drink_${card.id}`,
    deck: 'drink',
    quantity: card.quantity,
    mechanic: card.id,
  })),
];
