import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  assetIdSchema,
  contentVersionIdSchema,
  productIdSchema,
  ruleModuleIdSchema,
  cardDefinitionIdSchema,
  cardInstanceIdSchema,
  characterIdSchema,
  commandIdSchema,
  deckIdSchema,
  eventIdSchema,
  matchIdSchema,
  playerIdSchema,
  resolutionIdSchema,
  responseWindowIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import type {
  AssetId,
  ContentVersionId,
  ProductId,
  RuleModuleId,
  CardDefinitionId,
  CardInstanceId,
  CharacterId,
  CommandId,
  DeckId,
  EventId,
  MatchId,
  PlayerId,
  ResolutionId,
  ResponseWindowId,
  RoomId,
} from '../../src/shared/ids';
import { nextStateVersion, stateVersionSchema } from '../../src/shared/version';
import { clientCommandSchema } from '../../src/protocol/commands';
import type { StateChangingCommand } from '../../src/protocol/commands';
import type { StateVersion } from '../../src/shared/version';

const identities = [
  ['asset', assetIdSchema],
  ['content', contentVersionIdSchema],
  ['product', productIdSchema],
  ['rule', ruleModuleIdSchema],
  ['player', playerIdSchema],
  ['room', roomIdSchema],
  ['match', matchIdSchema],
  ['carddef', cardDefinitionIdSchema],
  ['card', cardInstanceIdSchema],
  ['character', characterIdSchema],
  ['deck', deckIdSchema],
  ['command', commandIdSchema],
  ['event', eventIdSchema],
  ['resolution', resolutionIdSchema],
  ['window', responseWindowIdSchema],
] as const;

describe('identity boundaries', () => {
  it.each(identities)(
    'validates %s IDs without coercion or normalization',
    (prefix, schema) => {
      const valid = `${prefix}_Sample-123`;
      expect(schema.parse(valid)).toBe(valid);
      for (const invalid of [
        null,
        123,
        '',
        prefix,
        `${prefix}_`,
        ` ${valid}`,
        `${valid} `,
        `${prefix}_a/b`,
        `${prefix}_a.b`,
        `${prefix}_${'a'.repeat(65)}`,
        `${prefix}_☃`,
      ]) {
        expect(schema.safeParse(invalid).success).toBe(false);
      }
      for (const [otherPrefix] of identities) {
        if (otherPrefix !== prefix)
          expect(schema.safeParse(`${otherPrefix}_Sample-123`).success).toBe(
            false,
          );
      }
    },
  );

  it('makes domain namespaces incompatible in TypeScript', () => {
    expectTypeOf<ContentVersionId>().not.toEqualTypeOf<MatchId>();
    expectTypeOf<ProductId>().not.toEqualTypeOf<CharacterId>();
    expectTypeOf<RuleModuleId>().not.toEqualTypeOf<AssetId>();
    expectTypeOf<PlayerId>().not.toEqualTypeOf<RoomId>();
    expectTypeOf<PlayerId>().not.toEqualTypeOf<MatchId>();
    expectTypeOf<CardInstanceId>().not.toEqualTypeOf<CardDefinitionId>();
    expectTypeOf<CharacterId>().not.toEqualTypeOf<DeckId>();
    expectTypeOf<CommandId>().not.toEqualTypeOf<EventId>();
    expectTypeOf<ResolutionId>().not.toEqualTypeOf<ResponseWindowId>();
    expectTypeOf<
      StateChangingCommand['commandId']
    >().toEqualTypeOf<CommandId>();
    expectTypeOf<
      StateChangingCommand['expectedStateVersion']
    >().toEqualTypeOf<StateVersion>();
    expectTypeOf<string>().not.toMatchTypeOf<PlayerId>();
  });
});

describe('monotonic state version contract', () => {
  it('supports zero and exactly increments safe integer versions', () => {
    let version = stateVersionSchema.parse(0);
    for (let i = 1; i <= 100; i += 1) {
      const previous = version;
      version = nextStateVersion(version);
      expect(version).toBe(i);
      expect(version).toBeGreaterThan(previous);
    }
    expect(
      nextStateVersion(stateVersionSchema.parse(Number.MAX_SAFE_INTEGER - 1)),
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(() =>
      nextStateVersion(stateVersionSchema.parse(Number.MAX_SAFE_INTEGER)),
    ).toThrow();
  });

  it('rejects invalid counter representations even if the TypeScript brand was bypassed', () => {
    for (const invalid of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '1',
    ]) {
      expect(stateVersionSchema.safeParse(invalid).success).toBe(false);
      expect(() => nextStateVersion(invalid as StateVersion)).toThrow();
    }
  });

  it('keeps the client expected version separate from the authoritative next version', () => {
    const current = stateVersionSchema.parse(7);
    const command = clientCommandSchema.parse({
      type: 'START_MATCH',
      commandId: 'command_sample',
      roomId: 'room_sample',
      expectedStateVersion: current,
    });
    expect(
      'expectedStateVersion' in command && command.expectedStateVersion,
    ).toBe(current);
    expect(nextStateVersion(current)).toBe(8);
    expect(current).toBe(7);
  });
});
