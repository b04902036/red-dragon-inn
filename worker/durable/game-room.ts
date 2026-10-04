import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import {
  resolveRuntimePack,
  loadRuntimePack,
  assertRuntimePack,
  ContentUnavailable,
} from '../runtime-content';
import { contentPresentation } from '../../src/content/presentation';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import type { Clock } from '../../src/engine/timed-prompts';
import { commandIdSchema } from '../../src/shared/ids';
import { createMatch } from '../../src/engine/setup';
import { DEFAULT_RULES, rulesConfigSchema } from '../../src/engine/rules';
import {
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
} from '../../src/shared/ids';
import { nextStateVersion, stateVersionSchema } from '../../src/shared/version';
import {
  decodeClientRoomMessage,
  encodeServerMessage,
} from '../../src/protocol/codec';
import type { ServerMessage } from '../../src/protocol/messages';
import type { ClientCommand } from '../../src/protocol/commands';
import {
  roomJoinResponseSchema,
  roomJoinSchema,
  roomCredentialsSchema,
  resumeTokenSchema,
} from '../../src/protocol/rooms';
import { projectPrivatePlayer } from '../../src/protocol/projections';
import { privatePlayerViewSchema } from '../../src/protocol/views';
import { apiError, requestJson } from '../http';
import {
  attachmentSchema,
  digest,
  issueToken,
  opaqueId,
  ROOM_STORAGE_KEY,
  roomRecordSchema,
} from './room-record';
import type { RoomRecord, SessionAttachment } from './room-record';
import { roomMetadata, roomPublicView } from './room-views';
import { characterSelectionSchema } from '../../src/protocol/presentation';
import type { CharacterId } from '../../src/shared/ids';
import {
  replayManifestSchema,
  replayEntrySchema,
  replaySequenceSchema,
  shouldSaveSnapshot,
} from '../../src/engine/replay';
import type { ReplayManifest } from '../../src/engine/replay';
import { commandBudget, socketBudget } from './abuse';
import {
  D1ReplayRepository,
  persistenceBatchSchema,
} from '../repositories/replay';

const createSchema = z.strictObject({
  ...roomJoinSchema.shape,
  roomId: roomIdSchema,
});
type Rejection = Extract<ServerMessage, { type: 'COMMAND_REJECTED' }>;

/** One authoritative room, persisted before acknowledgement; connections use hibernation. */
export class GameRoom extends DurableObject<Env> {
  private clock: Clock = { now: () => Date.now() };
  private historyAvailable = true;
  private async readRoom() {
    this.historyAvailable = await this.flushHistory(true);
    const value = await this.ctx.storage.get(ROOM_STORAGE_KEY);
    const room = value === undefined ? null : roomRecordSchema.parse(value);
    if (room === null || !this.historyAvailable) return room;
    const game = room.game;
    const prompt = game?.control.timedPrompt;
    const now = this.clock.now();
    if (
      !game ||
      !prompt ||
      prompt.deadlineAt === null ||
      now < prompt.deadlineAt
    )
      return room;
    const action = {
      type: 'EXPIRE_PROMPT',
      commandId: commandIdSchema.parse(
        `command_system_timeout_${game.version}`,
      ),
      roomId: room.roomId,
      expectedStateVersion: game.version,
      promptId: prompt.promptId,
      now,
    };
    const result = applyTimeout(game, action);
    if (result.status !== 'ACCEPTED') return room;
    const updated = {
      ...room,
      game: result.state,
      version: result.state.version,
    };
    const sequence = replaySequenceSchema.parse(
      (await this.ctx.storage.get<number>('history:sequence')) ?? 0,
    );
    const entry = replayEntrySchema.parse({
      actorId: prompt.priorityPlayerId,
      command: action,
      firstSequence: sequence + 1,
      lastSequence: sequence + result.events.length,
      events: result.events,
      acceptedAt: new Date(now).toISOString(),
      clockTime: now,
    });
    const outbox = persistenceBatchSchema.parse({
      manifest: null,
      entry,
      state: result.state,
      saveSnapshot: true,
    });
    await this.commitStorage(
      {
        [ROOM_STORAGE_KEY]: updated,
        [`events:${updated.version}`]: result.events,
        'history:outbox': outbox,
        'history:sequence': entry.lastSequence,
        [`history:command:${updated.version}`]: entry,
      },
      updated,
    );
    this.historyAvailable = await this.flushHistory();
    if (this.historyAvailable) await this.broadcast(updated);
    else await this.ctx.storage.setAlarm(now + 1000);
    return updated;
  }
  private async commitStorage(
    values: Record<string, unknown>,
    room: RoomRecord,
  ) {
    await this.ctx.storage.transaction(async (tx) => {
      await tx.put(values);
      const prompt = room.game?.control.timedPrompt;
      if (prompt?.deadlineAt != null) await tx.setAlarm(prompt.deadlineAt);
      else await tx.deleteAlarm();
    });
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.readRoom();
      if (!this.historyAvailable) {
        await this.ctx.storage.setAlarm(this.clock.now() + 1000);
        return;
      }
      const prompt = room?.game?.control.timedPrompt;
      if (prompt?.deadlineAt != null)
        await this.ctx.storage.setAlarm(prompt.deadlineAt);
    });
  }
  private async flushHistory(recover = false) {
    const pending = await this.ctx.storage.get('history:outbox');
    if (pending === undefined) return true;
    const batch = persistenceBatchSchema.parse(pending);
    try {
      await new D1ReplayRepository(this.env.DB).commit(batch);
    } catch {
      return false;
    }
    await this.ctx.storage.delete('history:outbox');
    if (recover) {
      const room = roomRecordSchema.parse(
        await this.ctx.storage.get(ROOM_STORAGE_KEY),
      );
      await this.broadcast(room);
    }
    return true;
  }
  /** Trusted Worker binding RPC for explicit credential renewal/revocation; no public HTTP route. */
  async renewResumeToken(input: string) {
    const parsed = resumeTokenSchema.safeParse(input);
    if (!parsed.success) return null;
    const hash = await digest(parsed.data);
    const credentials = await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.readRoom();
      const actor = room?.players.find((player) => player.tokenHash === hash);
      if (!this.historyAvailable || room === null || actor === undefined)
        return null;
      const resumeToken = issueToken();
      const tokenHash = await digest(resumeToken);
      const updated = {
        ...room,
        players: room.players.map((player) =>
          player.id === actor.id
            ? { ...player, tokenHash, activeSessionId: null }
            : player,
        ),
      };
      await this.ctx.storage.put(ROOM_STORAGE_KEY, updated);
      for (const ws of this.ctx.getWebSockets())
        if (this.attachment(ws)?.playerId === actor.id) {
          ws.serializeAttachment(null);
          ws.close(1008, 'Credential renewed');
        }
      this.broadcastPresence(updated);
      return roomCredentialsSchema.parse({
        roomId: room.roomId,
        playerId: actor.id,
        resumeToken,
      });
    });
    return credentials;
  }

  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(request.url).pathname;
      const room = await this.readRoom();
      if (!this.historyAvailable)
        return apiError('PERSISTENCE_UNAVAILABLE', 503);
      if (path === '/create' && request.method === 'POST') {
        if (room !== null) return apiError('ROOM_EXISTS', 409);
        let input: z.infer<typeof createSchema>;
        try {
          input = createSchema.parse(await requestJson(request));
        } catch {
          return apiError('INVALID_REQUEST', 400);
        }
        if (!this.ctx.id.equals(this.env.ROOMS.idFromName(input.roomId)))
          return apiError('INVALID_REQUEST', 400);
        let pack;
        try {
          pack = await resolveRuntimePack(this.env);
        } catch (error) {
          if (error instanceof ContentUnavailable)
            return apiError('CONTENT_UNAVAILABLE', 503);
          return apiError('CONTENT_INVALID', 503);
        }
        const token = issueToken();
        const host = await this.member(
          input.displayName,
          0,
          token,
          assertRuntimePack(pack, this.env.CONTENT_MODE === 'fixture')[0]!.id,
        );
        const created: RoomRecord = {
          schemaVersion: 1,
          roomId: input.roomId,
          contentVersionId: pack.version.id,
          version: stateVersionSchema.parse(0),
          hostPlayerId: host.id,
          seed: crypto.getRandomValues(new Uint32Array(1))[0]!,
          players: [host],
          game: null,
        };
        await this.ctx.storage.put(ROOM_STORAGE_KEY, created);
        return this.joinResponse(created, host.id, token, 201);
      }
      if (room === null) return apiError('NOT_FOUND', 404);
      if (path === '/presentation' && request.method === 'GET') {
        const locale =
          new URL(request.url).searchParams.get('locale') ?? 'en-US';
        if (locale !== 'en-US' && locale !== 'zh-TW')
          return apiError('INVALID_LOCALE', 400);
        try {
          const pack = await loadRuntimePack(this.env, room.contentVersionId);
          const presentation = contentPresentation(
            pack,
            this.env.CONTENT_MODE === 'fixture',
            locale,
          );
          const playable = new Set(
            assertRuntimePack(pack, this.env.CONTENT_MODE === 'fixture').map(
              (character) => character.id,
            ),
          );
          return Response.json(
            {
              ...presentation,
              characters: presentation.characters.filter((character) =>
                playable.has(character.id),
              ),
            },
            { headers: { 'Cache-Control': 'no-store' } },
          );
        } catch {
          return apiError('CONTENT_UNAVAILABLE', 503);
        }
      }
      if (path === '/metadata' && request.method === 'GET')
        return Response.json(roomMetadata(room), {
          headers: { 'Cache-Control': 'no-store' },
        });
      if (path === '/join' && request.method === 'POST') {
        if (room.game !== null) return apiError('MATCH_STARTED', 409);
        if (room.players.length >= 4) return apiError('ROOM_FULL', 409);
        let input: z.infer<typeof roomJoinSchema>;
        try {
          input = roomJoinSchema.parse(await requestJson(request));
        } catch {
          return apiError('INVALID_REQUEST', 400);
        }
        let pack;
        try {
          pack = await loadRuntimePack(this.env, room.contentVersionId);
        } catch {
          return apiError('CONTENT_UNAVAILABLE', 503);
        }
        const available = assertRuntimePack(
          pack,
          this.env.CONTENT_MODE === 'fixture',
        ).find(
          (character) =>
            !room.players.some((player) => player.characterId === character.id),
        );
        if (!available) return apiError('NO_AVAILABLE_CHARACTER', 409);
        const token = issueToken();
        const player = await this.member(
          input.displayName,
          room.players.length as 0 | 1 | 2 | 3,
          token,
          available.id,
        );
        const joined = {
          ...room,
          players: [...room.players, player],
          version: nextStateVersion(room.version),
        };
        await this.ctx.storage.put(ROOM_STORAGE_KEY, joined);
        await this.broadcast(joined);
        this.broadcastPresence(joined);
        return this.joinResponse(joined, player.id, token, 201);
      }
      if (path === '/character' && request.method === 'PATCH') {
        const authorization = request.headers.get('authorization');
        const token = authorization?.startsWith('Bearer ')
          ? authorization.slice(7)
          : null;
        if (token === null) return apiError('AUTH_REQUIRED', 401);
        const hash = await digest(token);
        const actor = room.players.find((player) => player.tokenHash === hash);
        if (actor === undefined) return apiError('INVALID_SESSION', 403);
        if (room.game !== null) return apiError('MATCH_STARTED', 409);
        let selection;
        try {
          selection = characterSelectionSchema.parse(
            await requestJson(request),
          );
        } catch {
          return apiError('INVALID_REQUEST', 400);
        }
        if (selection.expectedStateVersion !== room.version)
          return apiError('VERSION_CONFLICT', 409);
        let pack;
        try {
          pack = await loadRuntimePack(this.env, room.contentVersionId);
        } catch {
          return apiError('CONTENT_UNAVAILABLE', 503);
        }
        if (
          !assertRuntimePack(pack, this.env.CONTENT_MODE === 'fixture').some(
            (character) => character.id === selection.characterId,
          )
        )
          return apiError('INVALID_CHARACTER', 400);
        if (
          room.players.some(
            (player) =>
              player.id !== actor.id &&
              player.characterId === selection.characterId,
          )
        )
          return apiError('CHARACTER_TAKEN', 409);
        const selected = {
          ...room,
          version: nextStateVersion(room.version),
          players: room.players.map((player) =>
            player.id === actor.id
              ? { ...player, characterId: selection.characterId }
              : player,
          ),
        };
        await this.ctx.storage.put(ROOM_STORAGE_KEY, selected);
        await this.broadcast(selected);
        return Response.json(roomMetadata(selected), {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      if (path === '/ws' && request.method === 'GET') {
        if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
          return apiError('UPGRADE_REQUIRED', 426, 'GET');
        if (this.ctx.getWebSockets().length >= 16)
          return apiError('TOO_MANY_CONNECTIONS', 429);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);
        pair[1].serializeAttachment(null);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      return apiError('NOT_FOUND', 404);
    });
  }

  private async member(
    displayName: string,
    seat: 0 | 1 | 2 | 3,
    token: string,
    characterId: CharacterId,
  ): Promise<RoomRecord['players'][number]> {
    return {
      id: playerIdSchema.parse(opaqueId('player')),
      seat,
      displayName,
      characterId,
      tokenHash: await digest(token),
      activeSessionId: null,
    };
  }
  private joinResponse(
    room: RoomRecord,
    playerId: RoomRecord['hostPlayerId'],
    resumeToken: string,
    status: number,
  ) {
    return Response.json(
      roomJoinResponseSchema.parse({
        ...roomMetadata(room),
        credentials: { roomId: room.roomId, playerId, resumeToken },
      }),
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  private attachment(ws: WebSocket): SessionAttachment | null {
    const parsed = attachmentSchema.safeParse(ws.deserializeAttachment());
    return parsed.success ? parsed.data : null;
  }
  private send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(encodeServerMessage(message));
    } catch {
      /* A closing peer must not interrupt delivery to other players. */
    }
  }
  private reject(
    ws: WebSocket,
    room: RoomRecord | null,
    code: Rejection['code'],
    commandId: Rejection['commandId'] = null,
    reason?: string,
  ) {
    this.send(ws, {
      type: 'COMMAND_REJECTED',
      commandId,
      stateVersion: room?.version ?? stateVersionSchema.parse(0),
      code,
      ...(reason === undefined ? {} : { reason }),
    });
  }

  async webSocketMessage(ws: WebSocket, frame: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.readRoom();
      if (!this.historyAvailable) {
        this.reject(ws, room, 'PERSISTENCE_UNAVAILABLE');
        ws.close(1013, 'History temporarily unavailable');
        return;
      }
      if (room === null) {
        this.reject(ws, room, 'NOT_ALLOWED');
        return;
      }
      const rawAttachment = ws.deserializeAttachment() as {
        abuse?: unknown;
      } | null;
      const abuse = socketBudget(rawAttachment?.abuse, Date.now());
      ws.serializeAttachment({ ...(this.attachment(ws) ?? {}), abuse });
      if (abuse.frames > 240) {
        this.reject(ws, room, 'RATE_LIMITED');
        ws.close(1008, 'Message rate exceeded');
        return;
      }
      let message;
      try {
        if (
          typeof frame !== 'string' ||
          new TextEncoder().encode(frame).byteLength > 65_536
        )
          throw new TypeError('Invalid frame');
        message = decodeClientRoomMessage(frame);
      } catch {
        this.reject(ws, room, 'INVALID_COMMAND');
        const invalid = socketBudget(abuse, Date.now(), true);
        ws.serializeAttachment({
          ...(this.attachment(ws) ?? {}),
          abuse: invalid,
        });
        if (invalid.malformed >= 8) ws.close(1008, 'Repeated invalid messages');
        return;
      }
      const attachment = this.attachment(ws);
      if (message.type === 'HELLO') {
        if (attachment !== null || message.roomId !== room.roomId) {
          this.reject(ws, room, 'INVALID_SESSION');
          return;
        }
        const player = room.players.find(
          (player) => player.id === message.playerId,
        );
        if (
          player === undefined ||
          player.tokenHash !== (await digest(message.resumeToken))
        ) {
          this.reject(ws, room, 'INVALID_SESSION');
          return;
        }
        const sessionId = opaqueId('session');
        const accepted = {
          ...room,
          players: room.players.map((member) =>
            member.id === player.id
              ? { ...member, activeSessionId: sessionId }
              : member,
          ),
        };
        await this.ctx.storage.put(ROOM_STORAGE_KEY, accepted);
        for (const peer of this.ctx.getWebSockets()) {
          if (peer !== ws && this.attachment(peer)?.playerId === player.id) {
            peer.serializeAttachment(null);
            peer.close(1008, 'Session replaced');
          }
        }
        ws.serializeAttachment({
          abuse,
          playerId: player.id,
          sessionId,
          privateSignature: null,
        });
        this.send(ws, {
          type: 'SESSION_ACCEPTED',
          roomId: room.roomId,
          playerId: player.id,
          hostPlayerId: room.hostPlayerId,
          sessionId,
          stateVersion: room.version,
        });
        await this.snapshot(ws, accepted, true);
        this.broadcastPresence(accepted);
        return;
      }
      const player = room.players.find(
        (player) =>
          player.id === attachment?.playerId &&
          player.activeSessionId === attachment.sessionId,
      );
      if (attachment === null || player === undefined) {
        this.reject(
          ws,
          room,
          'AUTH_REQUIRED',
          message.type === 'COMMAND' ? message.command.commandId : null,
        );
        return;
      }
      if (message.type === 'PING') {
        this.send(ws, { type: 'PONG', nonce: message.nonce });
        return;
      }
      const key = `abuse:command:${player.id}`;
      const budget = commandBudget(await this.ctx.storage.get(key), Date.now());
      await this.ctx.storage.put(key, budget);
      if (budget.count > 60) {
        this.reject(ws, room, 'RATE_LIMITED', message.command.commandId);
        ws.close(1008, 'Command rate exceeded');
        return;
      }
      await this.command(ws, room, attachment, message.command);
    });
  }

  private async command(
    ws: WebSocket,
    room: RoomRecord,
    session: SessionAttachment,
    command: ClientCommand,
  ) {
    if (command.type === 'JOIN_ROOM' || command.roomId !== room.roomId) {
      this.reject(ws, room, 'NOT_ALLOWED', command.commandId);
      return;
    }
    let game = room.game;
    let manifest: ReplayManifest | null = null;
    if (game === null) {
      if (
        command.type !== 'START_MATCH' ||
        session.playerId !== room.hostPlayerId
      ) {
        this.reject(ws, room, 'NOT_ALLOWED', command.commandId);
        return;
      }
      if (command.expectedStateVersion !== room.version) {
        this.reject(ws, room, 'VERSION_CONFLICT', command.commandId);
        await this.snapshot(ws, room, true);
        return;
      }
      if (room.players.length < 2) {
        this.reject(ws, room, 'NOT_ENOUGH_PLAYERS', command.commandId);
        return;
      }
      let content;
      try {
        content = await loadRuntimePack(this.env, room.contentVersionId);
      } catch {
        this.reject(ws, room, 'NOT_ALLOWED', command.commandId);
        return;
      }
      manifest = replayManifestSchema.parse({
        schemaVersion: 1,
        setup: {
          roomId: room.roomId,
          matchId: matchIdSchema.parse(opaqueId('match')),
          hostPlayerId: room.hostPlayerId,
          seed: room.seed,
          version: room.version,
          content,
          rules:
            this.env.CONTENT_MODE === 'fixture' && this.env.FIXTURE_TIMING_MS
              ? rulesConfigSchema.parse({
                  ...DEFAULT_RULES,
                  timing: {
                    ...DEFAULT_RULES.timing,
                    responseMs: Number(
                      this.env.FIXTURE_TIMING_MS.split(',')[0],
                    ),
                    phaseEndMs: Number(
                      this.env.FIXTURE_TIMING_MS.split(',')[1],
                    ),
                  },
                })
              : DEFAULT_RULES,
          players: room.players.map(
            ({ id, seat, displayName, characterId }) => ({
              id,
              seat,
              displayName,
              characterId,
            }),
          ),
        },
      });
      game = createMatch(manifest.setup);
    }
    const clockTime = this.clock.now();
    const result = applyCommand(game, command, {
      actorId: session.playerId,
      clock: { now: () => clockTime },
    });
    if (result.status === 'REJECTED') {
      this.reject(
        ws,
        room,
        result.code === 'VERSION_CONFLICT'
          ? 'VERSION_CONFLICT'
          : result.code === 'INVALID_COMMAND'
            ? 'INVALID_COMMAND'
            : 'NOT_ALLOWED',
        command.commandId,
        result.code,
      );
      if (result.code === 'VERSION_CONFLICT')
        await this.snapshot(ws, room, true);
      return;
    }
    if (result.status === 'DUPLICATE') {
      this.send(ws, {
        type: 'COMMAND_ACCEPTED',
        commandId: command.commandId,
        stateVersion: result.acceptedVersion,
      });
      await this.snapshot(ws, room, true);
      return;
    }
    const updated = {
      ...room,
      game: result.state,
      version: result.state.version,
    };
    const sequence = replaySequenceSchema.parse(
      (await this.ctx.storage.get<number>('history:sequence')) ?? 0,
    );
    const entry = replayEntrySchema.parse({
      actorId: session.playerId,
      command,
      firstSequence: sequence + 1,
      lastSequence: sequence + result.events.length,
      events: result.events,
      acceptedAt: new Date().toISOString(),
      clockTime,
    });
    const outbox = persistenceBatchSchema.parse({
      manifest,
      entry,
      state: result.state,
      saveSnapshot: shouldSaveSnapshot(game, result.state),
    });
    // Durable storage atomically commits the snapshot and append-only accepted batch together.
    await this.commitStorage(
      {
        [ROOM_STORAGE_KEY]: updated,
        [`events:${updated.version}`]: result.events,
        'history:outbox': outbox,
        'history:sequence': entry.lastSequence,
        [`history:command:${updated.version}`]: entry,
        ...(manifest === null ? {} : { 'history:manifest': manifest }),
      },
      updated,
    );
    if (!(await this.flushHistory())) {
      this.reject(ws, updated, 'PERSISTENCE_UNAVAILABLE', command.commandId);
      ws.close(1013, 'History temporarily unavailable');
      return;
    }
    this.send(ws, {
      type: 'COMMAND_ACCEPTED',
      commandId: command.commandId,
      stateVersion: result.acceptedVersion,
    });
    await this.broadcast(updated);
  }

  private async snapshot(
    ws: WebSocket,
    room: RoomRecord,
    forcePrivate = false,
  ) {
    const session = this.attachment(ws);
    if (
      session === null ||
      !room.players.some(
        (player) =>
          player.id === session.playerId &&
          player.activeSessionId === session.sessionId,
      )
    )
      return;
    this.send(ws, { type: 'PUBLIC_STATE', view: roomPublicView(room) });
    const privateView =
      room.game !== null
        ? projectPrivatePlayer(room.game, session.playerId)
        : privatePlayerViewSchema.parse({
            schemaVersion: 1,
            roomId: room.roomId,
            matchId: null,
            version: room.version,
            playerId: session.playerId,
            hand: [],
            resources: {},
            sideDecks: {},
            pendingChoice: null,
          });
    const signature = await digest(
      JSON.stringify({ ...privateView, version: 0 }),
    );
    if (forcePrivate || session.privateSignature !== signature) {
      this.send(ws, { type: 'PRIVATE_STATE', view: privateView });
      ws.serializeAttachment({ ...session, privateSignature: signature });
    }
  }
  private async broadcast(room: RoomRecord) {
    for (const ws of this.ctx.getWebSockets()) await this.snapshot(ws, room);
  }
  private broadcastPresence(room: RoomRecord) {
    const players = room.players.map((player) => ({
      playerId: player.id,
      connected: player.activeSessionId !== null,
    }));
    for (const ws of this.ctx.getWebSockets()) {
      const session = this.attachment(ws);
      if (
        session !== null &&
        room.players.some(
          (player) =>
            player.id === session.playerId &&
            player.activeSessionId === session.sessionId,
        )
      )
        this.send(ws, { type: 'ROOM_PRESENCE', roomId: room.roomId, players });
    }
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const session = this.attachment(ws);
      ws.serializeAttachment(null);
      const room = await this.readRoom();
      if (session !== null && room !== null) {
        const cleaned = {
          ...room,
          players: room.players.map((player) =>
            player.activeSessionId === session.sessionId
              ? { ...player, activeSessionId: null }
              : player,
          ),
        };
        await this.ctx.storage.put(ROOM_STORAGE_KEY, cleaned);
        this.broadcastPresence(cleaned);
      }
      // Missing/abnormal close statuses cannot be sent back in a close frame.
      ws.close([1005, 1006, 1015].includes(code) ? 1000 : code, reason);
    });
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011, 'Connection error');
  }
}
