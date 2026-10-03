import { env } from 'cloudflare:workers';
import { beforeEach, expect, it } from 'vitest';
import { importContent } from '../../src/content/import';
import { createMatch } from '../../src/engine/setup';
import { applyCommand } from '../../src/engine/commands';
import { D1ContentRepository } from '../../worker/repositories/content';
import { draftPack, freshDatabase, sql } from './database-helpers';
import { setupInput } from '../fixtures/core-match';
import { clientCommandSchema } from '../../src/protocol/commands';

beforeEach(freshDatabase);
const repository = new D1ContentRepository(env.DB);
it('imports a private-marked original fixture as a new version and pins its definitions for the engine', async () => {
  const pack = draftPack();
  for (const card of pack.cards) card.source = 'PRIVATE';
  const report = await importContent(JSON.stringify(pack), repository, {
    dryRun: false,
  });
  expect(report).toMatchObject({
    valid: true,
    written: true,
    uniqueCards: 10,
    physicalCards: 37,
  });
  expect(await repository.getVersion(pack.version.id)).toEqual({
    ...pack.version,
    publishedAt: null,
  });
  await repository.publishVersion(pack.version.id);
  const graph = await repository.loadDeck(pack.version.id, pack.decks[0]!.id);
  expect(
    graph!.cards.find((card) => card.definition.id === 'carddef_sample_shove')!
      .quantity,
  ).toBe(2);
  expect(graph!.totalQuantity).toBe(7);
  const input = { ...setupInput(1, 7), content: pack };
  const match = createMatch(input);
  const result = applyCommand(
    match,
    clientCommandSchema.parse({
      type: 'START_MATCH',
      roomId: match.roomId,
      commandId: 'command_import_start',
      expectedStateVersion: match.version,
    }),
    { actorId: match.players[0]!.id },
  );
  expect(result.status).toBe('ACCEPTED');
  expect(result.state.contentVersionId).toBe(pack.version.id);
  expect(result.state.players[0]!.hand).toHaveLength(7);
});
it('dry run and invalid input leave actual D1 empty', async () => {
  const pack = draftPack();
  await importContent(JSON.stringify(pack), repository);
  pack.deckCards[0]!.quantity = -1;
  expect(
    (await importContent(JSON.stringify(pack), repository, { dryRun: false }))
      .valid,
  ).toBe(false);
  expect((await sql('SELECT id FROM content_versions')).results).toEqual([]);
  expect((await sql('SELECT id FROM cards')).results).toEqual([]);
});
it('rolls back every earlier insert if a late SQL statement fails', async () => {
  await sql(
    "CREATE TRIGGER fail_import_card BEFORE INSERT ON cards BEGIN SELECT RAISE(ABORT,'forced import failure'); END",
  );
  await expect(
    importContent(JSON.stringify(draftPack()), repository, { dryRun: false }),
  ).rejects.toThrow('forced import failure');
  for (const table of [
    'content_versions',
    'products',
    'characters',
    'decks',
    'cards',
    'deck_cards',
  ])
    expect((await sql(`SELECT * FROM ${table}`)).results).toEqual([]);
});
it('rejects an existing version without partially adding or changing its graph', async () => {
  const pack = draftPack();
  await importContent(JSON.stringify(pack), repository, { dryRun: false });
  const before = (await sql('SELECT * FROM cards')).results;
  await expect(
    importContent(JSON.stringify(pack), repository, { dryRun: false }),
  ).rejects.toThrow();
  expect((await sql('SELECT * FROM cards')).results).toEqual(before);
  expect((await sql('SELECT id FROM content_versions')).results).toHaveLength(
    1,
  );
});
