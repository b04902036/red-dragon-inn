import { describe, expect, it } from 'vitest';
import {
  clientRoomMessageSchema,
  roomJoinSchema,
  roomJoinResponseSchema,
} from '../../src/protocol/rooms';
import {
  decodeClientRoomMessage,
  encodeClientRoomMessage,
  decodeServerMessage,
  encodeServerMessage,
} from '../../src/protocol/codec';
import { serverMessageSchema } from '../../src/protocol/messages';
import type { ClientRoomMessage } from '../../src/protocol/rooms';

const hello = {
  type: 'HELLO',
  roomId: 'room_sample',
  playerId: 'player_0',
  resumeToken: 'a'.repeat(64),
};
describe('room connection contracts', () => {
  it.each([
    hello,
    { type: 'PING', nonce: 'heartbeat' },
    {
      type: 'COMMAND',
      command: {
        type: 'TAKE_DRINK',
        roomId: 'room_sample',
        commandId: 'command_sample',
        expectedStateVersion: 4,
      },
    },
  ])('round-trips validated room envelope %#', (input) => {
    const parsed = clientRoomMessageSchema.parse(input);
    expect(decodeClientRoomMessage(encodeClientRoomMessage(parsed))).toEqual(
      input,
    );
  });
  it.each([
    { ...hello, resumeToken: 'a'.repeat(63) },
    { ...hello, resumeToken: 'G'.repeat(64) },
    { ...hello, playerId: 'room_other' },
    { ...hello, actorId: 'player_other' },
    { type: 'PING', nonce: '' },
    { type: 'PING', nonce: 'x'.repeat(65) },
    {
      type: 'COMMAND',
      command: {
        type: 'TAKE_DRINK',
        roomId: 'room_sample',
        commandId: 'command_sample',
        expectedStateVersion: 4,
        gold: 99,
      },
    },
    { type: 'COMMAND', command: null },
    { type: 'DOMAIN_EVENT', event: {} },
  ])('rejects unsafe connection input %#', (input) => {
    expect(clientRoomMessageSchema.safeParse(input).success).toBe(false);
    expect(() => decodeClientRoomMessage(JSON.stringify(input))).toThrow();
  });
  it('rejects oversized encodings and does not trust TypeScript casts', () => {
    expect(() =>
      encodeClientRoomMessage({ type: 'HELLO' } as ClientRoomMessage),
    ).toThrow();
    expect(() => decodeClientRoomMessage(' '.repeat(65_537))).toThrow();
    expect(() => decodeClientRoomMessage('{')).toThrow();
    expect(roomJoinSchema.parse({ displayName: ' Host ' })).toEqual({
      displayName: 'Host',
    });
    expect(
      roomJoinResponseSchema.safeParse({ credentials: hello }).success,
    ).toBe(false);
  });
  it('round-trips safe accepted-session, heartbeat, and authorization errors', () => {
    for (const message of [
      {
        type: 'SESSION_ACCEPTED',
        roomId: 'room_sample',
        playerId: 'player_0',
        hostPlayerId: 'player_0',
        sessionId: `session_${'a'.repeat(32)}`,
        stateVersion: 0,
      },
      { type: 'PONG', nonce: 'heartbeat' },
      {
        type: 'COMMAND_REJECTED',
        commandId: null,
        stateVersion: 0,
        code: 'AUTH_REQUIRED',
      },
      {
        type: 'COMMAND_REJECTED',
        commandId: 'command_sample',
        stateVersion: 4,
        code: 'NOT_ALLOWED',
        reason: 'WRONG_PHASE',
      },
    ])
      expect(
        decodeServerMessage(
          encodeServerMessage(serverMessageSchema.parse(message)),
        ),
      ).toEqual(message);
    expect(
      serverMessageSchema.safeParse({ ...hello, type: 'SESSION_ACCEPTED' })
        .success,
    ).toBe(false);
    expect(
      serverMessageSchema.safeParse({
        type: 'PONG',
        nonce: '',
        resumeToken: hello.resumeToken,
      }).success,
    ).toBe(false);
  });
});
