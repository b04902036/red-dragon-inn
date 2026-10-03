import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { sampleContentPack } from '../../src/content/sample';
import { contentPackSchema } from '../../src/content/pack';
import {
  matchCreateSchema,
  storedEventSchema,
  snapshotInputSchema,
} from '../../worker/repositories/schemas';

export async function freshDatabase() {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
export async function seedDatabase() {
  await env.DB.batch(
    env.TEST_SAMPLE_SEED.flatMap((migration) =>
      migration.queries.map((sql) => env.DB.prepare(sql)),
    ),
  );
}
export function draftPack(id = 'content_draft') {
  return contentPackSchema.parse({
    ...structuredClone(sampleContentPack),
    version: { ...sampleContentPack.version, id },
  });
}
export function matchInput(
  id = 'match_sample',
  contentVersionId = sampleContentPack.version.id as string,
) {
  return matchCreateSchema.parse({
    id,
    roomId: 'room_sample',
    contentVersionId,
    rngSeed: 4294967295,
    players: [0, 1].map((seat) => ({
      playerId: `player_${seat}`,
      characterId: `character_sample_${seat}`,
      seat,
      displayName: `Sample player ${seat}`,
    })),
  });
}
export function storedEvent(
  sequence = 1,
  overrides: Record<string, unknown> = {},
) {
  return storedEventSchema.parse({
    sequence,
    event: {
      eventId: `event_${sequence}`,
      commandId: `command_${sequence}`,
      roomId: 'room_sample',
      matchId: 'match_sample',
      stateVersion: sequence,
      eventIndex: 0,
      type: 'CARDS_DRAWN',
      playerId: 'player_0',
      cardIds: ['card_hidden'],
      ...overrides,
    },
  });
}
export function snapshot(
  sequence = 0,
  overrides: Record<string, unknown> = {},
) {
  return snapshotInputSchema.parse({
    sequence,
    stateVersion: sequence,
    snapshot: {
      schemaVersion: 1,
      roomId: 'room_sample',
      matchId: 'match_sample',
      version: sequence,
      hidden: { hand: ['card_hidden'], rng: { seed: 123, state: 456 } },
      ...overrides,
    },
  });
}
export async function sql(query: string, ...values: unknown[]) {
  return env.DB.prepare(query)
    .bind(...values)
    .run();
}
