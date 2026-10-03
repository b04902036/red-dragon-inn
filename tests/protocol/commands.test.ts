import { describe, expect, it } from 'vitest';
import { clientCommandSchema } from '../../src/protocol/commands';
import {
  decodeClientCommand,
  encodeClientCommand,
} from '../../src/protocol/codec';

const metadata = {
  roomId: 'room_sample',
  commandId: 'command_sample',
  expectedStateVersion: 7,
};
const commandExamples = [
  { type: 'TAKE_DRINK', ...metadata },
  { type: 'GAMBLING_LEAVE', ...metadata },
  {
    type: 'GAMBLING_PLAY',
    ...metadata,
    cardId: 'card_sample',
    targetPlayerId: 'player_1',
  },
  {
    type: 'PLAY_RESPONSE',
    ...metadata,
    responseWindowId: 'window_sample',
    cardId: 'card_sample',
  },
  {
    type: 'PLAY_RESPONSE',
    ...metadata,
    responseWindowId: 'window_sample',
    cardId: 'card_sample',
    targetPlayerId: 'player_1',
  },
  {
    type: 'CHOOSE_CARDS',
    ...metadata,
    responseWindowId: 'window_sample',
    cardIds: ['card_sample'],
  },
  {
    type: 'JOIN_ROOM',
    roomId: 'room_sample',
    commandId: 'command_join',
    displayName: 'Sample player',
  },
  { type: 'START_MATCH', ...metadata },
  { type: 'SKIP_ACTION', ...metadata },
  { type: 'ADVANCE_PHASE', ...metadata },
  { type: 'DISCARD', ...metadata, cardIds: ['card_sample'] },
  { type: 'PLAY_CARD', ...metadata, cardId: 'card_sample' },
  {
    type: 'PLAY_CARD',
    ...metadata,
    cardId: 'card_sample',
    targetPlayerId: 'player_1',
  },
  {
    type: 'CHOOSE_TARGET',
    ...metadata,
    responseWindowId: 'window_sample',
    targetPlayerIds: ['player_1'],
  },
  { type: 'PASS_RESPONSE', ...metadata, responseWindowId: 'window_sample' },
  { type: 'ORDER_DRINK', ...metadata, targetPlayerId: 'player_1' },
  { type: 'GAMBLING_PLAY', ...metadata, cardId: 'card_sample' },
  { type: 'GAMBLING_PASS', ...metadata },
  {
    type: 'CHOOSE_OPTION',
    ...metadata,
    responseWindowId: 'window_sample',
    optionId: 'sample-option',
  },
];

describe('client intent contracts', () => {
  it('accepts choosing zero discards without inventing a separate draw command', () => {
    const command = clientCommandSchema.parse({
      type: 'DISCARD',
      ...metadata,
      cardIds: [],
    });
    expect(decodeClientCommand(encodeClientCommand(command))).toEqual({
      type: 'DISCARD',
      ...metadata,
      cardIds: [],
    });
  });

  it.each(commandExamples)(
    'accepts and round-trips $type without changing its discriminator or fields',
    (example) => {
      const command = clientCommandSchema.parse(example);
      expect(command).toEqual(example);
      expect(decodeClientCommand(encodeClientCommand(command))).toEqual(
        command,
      );
    },
  );

  it.each(commandExamples.filter((example) => example.type !== 'JOIN_ROOM'))(
    'requires idempotency and version metadata for $type',
    (example) => {
      for (const field of ['commandId', 'expectedStateVersion', 'roomId']) {
        const invalid: Record<string, unknown> = { ...example };
        delete invalid[field];
        expect(clientCommandSchema.safeParse(invalid).success).toBe(false);
      }
    },
  );

  it.each([
    null,
    [],
    'START_MATCH',
    {},
    { type: 'UNKNOWN', ...metadata },
    { type: 'PLAY_RESPONSE', ...metadata, cardId: 'card_sample' },
    {
      type: 'CHOOSE_CARDS',
      ...metadata,
      responseWindowId: 'window_sample',
      cardIds: [],
    },
    {
      type: 'CHOOSE_CARDS',
      ...metadata,
      responseWindowId: 'window_sample',
      cardIds: ['card_sample', 'card_sample'],
    },
    { type: 'start_match', ...metadata },
    { type: 'START_MATCH', ...metadata, commandId: 12 },
    { type: 'START_MATCH', ...metadata, roomId: 'player_sample' },
    { type: 'PLAY_CARD', ...metadata, cardId: 'carddef_sample' },
    {
      type: 'PLAY_CARD',
      ...metadata,
      cardId: 'card_sample',
      targetPlayerId: 'room_sample',
    },
    {
      type: 'PLAY_CARD',
      ...metadata,
      cardId: 'card_sample',
      targetPlayerId: 0,
    },
    { type: 'ORDER_DRINK', ...metadata, targetPlayerId: 1 },
    { type: 'ORDER_DRINK', ...metadata, targetPlayerId: 'room_sample' },
    {
      type: 'PASS_RESPONSE',
      ...metadata,
      responseWindowId: 'resolution_sample',
    },
    { type: 'DISCARD', ...metadata, cardIds: 'card_sample' },
    { type: 'DISCARD', ...metadata, cardIds: ['card_sample', 'card_sample'] },
    {
      type: 'DISCARD',
      ...metadata,
      cardIds: Array.from({ length: 65 }, (_, i) => `card_${i}`),
    },
    {
      type: 'CHOOSE_TARGET',
      ...metadata,
      responseWindowId: 'window_sample',
      targetPlayerIds: [],
    },
    {
      type: 'CHOOSE_TARGET',
      ...metadata,
      responseWindowId: 'window_sample',
      targetPlayerIds: ['player_1', 'player_1'],
    },
    {
      type: 'CHOOSE_OPTION',
      ...metadata,
      responseWindowId: 'window_sample',
      optionId: '',
    },
    {
      type: 'JOIN_ROOM',
      roomId: 'room_sample',
      commandId: 'command_join',
      displayName: '   ',
    },
    {
      type: 'JOIN_ROOM',
      roomId: 'room_sample',
      commandId: 'command_join',
      displayName: 123,
    },
  ])('rejects malformed command %#', (input) => {
    expect(clientCommandSchema.safeParse(input).success).toBe(false);
  });

  it.each(['7', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'does not coerce invalid expected version %s',
    (version) => {
      expect(
        clientCommandSchema.safeParse({
          type: 'START_MATCH',
          ...metadata,
          expectedStateVersion: version,
        }).success,
      ).toBe(false);
    },
  );

  it.each([
    'playerId',
    'actorId',
    'fortitude',
    'alcoholContent',
    'gold',
    'hand',
    'deckOrder',
    'rng',
    'phase',
    'lifecycle',
    'state',
  ])(
    'rejects client-supplied authoritative field %s on every command',
    (field) => {
      for (const example of commandExamples) {
        expect(
          clientCommandSchema.safeParse({ ...example, [field]: 'injected' })
            .success,
        ).toBe(false);
      }
    },
  );

  it('rejects malformed JSON, oversized frames, and non-text input at the boundary', () => {
    expect(() => decodeClientCommand('{')).toThrow(SyntaxError);
    expect(() => decodeClientCommand(' '.repeat(65_537))).toThrow();
    expect(() => decodeClientCommand(123 as unknown as string)).toThrow();
    expect(() =>
      decodeClientCommand(
        JSON.stringify({
          type: 'PLAY_CARD',
          ...metadata,
          cardId: 'deck_sample',
        }),
      ),
    ).toThrow();
  });
});
