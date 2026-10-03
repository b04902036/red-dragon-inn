import { describe, expect, it } from 'vitest';
import { roomRecordSchema } from '../../worker/durable/room-record';
import { newRoom, storedRoom } from './room-helpers';
import { joinRoom } from './room-helpers';
import { createMatch } from '../../src/engine/setup';
import { sampleContentPack } from '../../src/content/sample';
import { matchIdSchema } from '../../src/shared/ids';

describe('trusted room storage validation', () => {
  it('binds restored engine snapshots to the stored room, version, host, and roster', async () => {
    const created = await newRoom();
    await joinRoom(created.roomId);
    const room = await storedRoom(created.roomId);
    const game = createMatch({
      roomId: room.roomId,
      matchId: matchIdSchema.parse('match_record'),
      hostPlayerId: room.hostPlayerId,
      seed: room.seed,
      version: room.version,
      content: sampleContentPack,
      players: room.players.map(({ id, seat, displayName, characterId }) => ({
        id,
        seat,
        displayName,
        characterId,
      })),
    });
    const record = { ...room, game };
    expect(roomRecordSchema.parse(record)).toEqual(record);
    for (const corrupt of [
      { ...record, roomId: 'room_wrong' },
      { ...record, version: room.version + 1 },
      { ...record, hostPlayerId: room.players[1]!.id },
      { ...record, players: [...room.players].reverse() },
      {
        ...record,
        players: room.players.map((player) => ({ ...player, seat: 0 })),
      },
    ])
      expect(roomRecordSchema.safeParse(corrupt).success).toBe(false);
  });
  it('accepts a real persisted room and fails closed for corrupt membership or state', async () => {
    const room = await newRoom();
    const record = await storedRoom(room.roomId);
    expect(roomRecordSchema.parse(record)).toEqual(record);
    for (const corrupt of [
      { ...record, players: [record.players[0], record.players[0]] },
      { ...record, hostPlayerId: 'player_missing' },
      { ...record, game: {} },
      {
        ...record,
        players: [
          {
            ...record.players[0],
            tokenHash: room.credentials.resumeToken,
            activeSessionId: 'not-a-session',
          },
        ],
      },
    ])
      expect(roomRecordSchema.safeParse(corrupt).success).toBe(false);
  });
});
