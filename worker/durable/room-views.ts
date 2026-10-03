import type { RoomRecord } from './room-record';
import { projectPublicGame } from '../../src/protocol/projections';
import { publicGameViewSchema } from '../../src/protocol/views';
import { roomMetadataSchema } from '../../src/protocol/rooms';

export function roomPublicView(room: RoomRecord) {
  if (room.game !== null) return projectPublicGame(room.game);
  return publicGameViewSchema.parse({
    schemaVersion: 1,
    roomId: room.roomId,
    matchId: null,
    version: room.version,
    lifecycle: 'LOBBY',
    phase: null,
    activePlayerId: null,
    players: room.players.map((player) => ({
      id: player.id,
      seat: player.seat,
      displayName: player.displayName,
      characterId: player.characterId,
      fortitude: 20,
      alcoholContent: 0,
      gold: 10,
      eliminated: false,
      handCount: 0,
      characterDeckCount: 0,
      characterDiscardCount: 0,
      drinkPileCount: 0,
      resources: {},
      sideDecks: {},
    })),
    innDrinkDeckCount: 0,
    innDrinkDiscardCount: 0,
    gambling: null,
    resolutionStack: [],
    responseWindow: null,
    winners: [],
  });
}
export function roomMetadata(room: RoomRecord) {
  return roomMetadataSchema.parse({
    roomId: room.roomId,
    hostPlayerId: room.hostPlayerId,
    maxPlayers: 4,
    view: roomPublicView(room),
  });
}
