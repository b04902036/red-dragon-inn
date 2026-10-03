import { contentVersionIdSchema } from '../src/shared/ids';
import type { ContentPack } from '../src/content/pack';
import { D1ContentRepository } from './repositories/content';

export class ContentUnavailable extends Error {}

export function assertRuntimePack(pack: ContentPack, fixture: boolean) {
  if (
    !fixture &&
    pack.cards.some(
      (card) => card.source !== 'USER_OWNED' && card.source !== 'LICENSED',
    )
  )
    throw new ContentUnavailable(
      'Production playable content has invalid provenance',
    );
  if (
    !fixture &&
    pack.cards.some(
      (card) =>
        card.effects.length === 0 &&
        !['DRINK', 'GAMBLING', 'CHEATING'].includes(card.type),
    )
  )
    throw new ContentUnavailable(
      'Production card has no executable effect representation',
    );
  const inn = pack.decks.filter((deck) => deck.type === 'INN_DRINK');
  if (
    inn.length !== 1 ||
    pack.deckCards
      .filter((row) => row.deckId === inn[0]!.id)
      .reduce((sum, row) => sum + row.quantity, 0) < 4
  )
    throw new ContentUnavailable('Content cannot supply an Inn deck');
  const playable = pack.characters.filter((character) => {
    if (
      !fixture &&
      (character.rules.sideDeckKeys.length > 0 ||
        pack.requirements?.some(
          (requirement) =>
            requirement.characterId === character.id &&
            requirement.sideDecks.length > 0,
        ))
    )
      return false;
    const primary = pack.decks.filter(
      (deck) => deck.characterId === character.id && deck.type === 'CHARACTER',
    );
    return (
      primary.length === 1 &&
      pack.deckCards
        .filter((row) => row.deckId === primary[0]!.id)
        .reduce((sum, row) => sum + row.quantity, 0) >= 7
    );
  });
  if (playable.length < 2)
    throw new ContentUnavailable('Content requires two playable characters');
  // Do not offer incomplete characters that the engine cannot instantiate.
  return playable;
}

export async function loadRuntimePack(env: Env, id: string) {
  const pack = await new D1ContentRepository(env.DB).loadPack(
    contentVersionIdSchema.parse(id),
  );
  if (pack === null)
    throw new ContentUnavailable('Pinned content version is unavailable');
  assertRuntimePack(pack, env.CONTENT_MODE === 'fixture');
  return pack;
}

export async function resolveRuntimePack(env: Env) {
  const repository = new D1ContentRepository(env.DB);
  const id =
    env.CONTENT_MODE === 'fixture'
      ? contentVersionIdSchema.parse(env.FIXTURE_CONTENT_VERSION)
      : await repository.productionVersion();
  if (id === null)
    throw new ContentUnavailable('No production content version is configured');
  return loadRuntimePack(env, id);
}
