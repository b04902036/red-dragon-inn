import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { sampleContentPack } from '../../src/content/sample';
import { matchIdSchema } from '../../src/shared/ids';
import type { MatchCreate } from '../../worker/repositories/contracts';
import { D1ContentRepository } from '../../worker/repositories/content';
import { D1MatchRepository } from '../../worker/repositories/matches';
import {
  draftPack,
  freshDatabase,
  matchInput,
  seedDatabase,
  sql,
} from './database-helpers';

describe('D1 match repository and fixed content version', () => {
  const matches = new D1MatchRepository(env.DB);
  const content = new D1ContentRepository(env.DB);
  beforeEach(async () => {
    await freshDatabase();
    await seedDatabase();
  });
  it('keeps an existing match on its published edition when the same card identities change in a later version', async () => {
    const input = matchInput();
    input.players.reverse();
    await matches.create(input);
    const original = await matches.get(input.id);
    expect(original).toMatchObject({
      ...input,
      players: [...input.players].reverse(),
      lifecycle: 'SETUP',
      version: 0,
      finishedAt: null,
    });
    expect(original?.createdAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    const newer = contentPackSchema.parse({
      ...draftPack('content_sample_v2'),
      cards: sampleContentPack.cards.map((card) => ({
        ...card,
        name: `${card.name} revised`,
      })),
    });
    await content.saveDraft(newer);
    await content.publishVersion(newer.version.id);
    await matches.create({
      ...matchInput('match_new'),
      contentVersionId: newer.version.id,
      rngSeed: 0,
    });
    const oldDeck = await content.loadDeck(
      original!.contentVersionId,
      sampleContentPack.decks[0]!.id,
    );
    const newDeck = await content.loadDeck(
      newer.version.id,
      sampleContentPack.decks[0]!.id,
    );
    expect(
      oldDeck?.cards.every((card) => !card.definition.name.endsWith('revised')),
    ).toBe(true);
    expect(
      newDeck?.cards.every((card) => card.definition.name.endsWith('revised')),
    ).toBe(true);
    expect(await matches.get(input.id)).toEqual(original);
    await expect(
      sql(
        'UPDATE matches SET content_version_id = ? WHERE id = ?',
        newer.version.id,
        input.id,
      ),
    ).rejects.toThrow('locked');
    await expect(
      sql('UPDATE matches SET rng_seed = 1 WHERE id = ?', input.id),
    ).rejects.toThrow('locked');
    await expect(
      sql("UPDATE matches SET room_id = 'room_other' WHERE id = ?", input.id),
    ).rejects.toThrow('locked');
    await sql(
      "UPDATE matches SET lifecycle = 'PLAYING', state_version = 2 WHERE id = ?",
      input.id,
    );
    await expect(
      sql('UPDATE matches SET state_version = 1 WHERE id = ?', input.id),
    ).rejects.toThrow('decrease');
    expect((await matches.get(input.id))?.version).toBe(2);
    expect(await matches.get(matchIdSchema.parse('match_missing'))).toBeNull();
    await expect(matches.create(input)).rejects.toThrow('UNIQUE');
  });
  it.each([
    { rngSeed: -1 },
    { rngSeed: 4294967296 },
    { rngSeed: 0.5 },
    { rngSeed: '123' },
    { players: [] },
    { players: [matchInput().players[0], matchInput().players[0]] },
    { players: matchInput().players.map((player) => ({ ...player, seat: 0 })) },
    { id: "match_bad' OR 1=1" },
  ])('rejects invalid server persistence input %j', async (change) => {
    await expect(
      matches.create({ ...matchInput(), ...change } as unknown as MatchCreate),
    ).rejects.toThrow();
    expect(await matches.get(matchInput().id)).toBeNull();
  });
});
