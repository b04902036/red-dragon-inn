import { exports, env } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { expect } from 'vitest';
import { decodeServerMessage } from '../../src/protocol/codec';
import { roomJoinResponseSchema } from '../../src/protocol/rooms';
import type { ServerMessage } from '../../src/protocol/messages';
import type { RoomRecord } from '../../worker/durable/room-record';

export const roomApi = (
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
) =>
  exports.default.fetch(`https://example.com/api/rooms${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
export async function newRoom(name = 'Host') {
  const response = await roomApi('', { displayName: name });
  expect(response.status).toBe(201);
  return roomJoinResponseSchema.parse(await response.json());
}
export async function joinRoom(roomId: string, name = 'Guest') {
  const response = await roomApi(`/${roomId}/join`, { displayName: name });
  expect(response.status).toBe(201);
  return roomJoinResponseSchema.parse(await response.json());
}
export const stubFor = (roomId: string) => env.ROOMS.getByName(roomId);
export const storedRoom = (roomId: string) =>
  runInDurableObject(
    stubFor(roomId),
    async (_instance, ctx) => (await ctx.storage.get<RoomRecord>('room'))!,
  );

export async function connect(roomId: string) {
  const response = await exports.default.fetch(
    `https://example.com/api/rooms/${roomId}/ws`,
    { headers: { Upgrade: 'websocket' } },
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const messages: ServerMessage[] = [];
  const waits: {
    predicate: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
  }[] = [];
  socket.addEventListener('message', (event) => {
    const message = decodeServerMessage(event.data as string);
    messages.push(message);
    for (const wait of [...waits])
      if (wait.predicate(message)) {
        waits.splice(waits.indexOf(wait), 1);
        wait.resolve(message);
      }
  });
  return {
    socket,
    messages,
    send(message: unknown) {
      socket.send(JSON.stringify(message));
    },
    next(predicate: (message: ServerMessage) => boolean) {
      return new Promise<ServerMessage>((resolve) => {
        waits.push({ predicate, resolve });
      });
    },
    async hello(credentials: {
      roomId: string;
      playerId: string;
      resumeToken: string;
    }) {
      const ready = this.next((message) => message.type === 'PRIVATE_STATE');
      this.send({ type: 'HELLO', ...credentials });
      await ready;
    },
    async ping() {
      const nonce = crypto.randomUUID();
      const ready = this.next(
        (message) =>
          (message.type === 'PONG' && message.nonce === nonce) ||
          (message.type === 'COMMAND_REJECTED' &&
            (message.code === 'RATE_LIMITED' ||
              message.code === 'PERSISTENCE_UNAVAILABLE')),
      );
      this.send({ type: 'PING', nonce });
      const result = await ready;
      if (result.type === 'COMMAND_REJECTED')
        throw new Error(`Heartbeat rejected: ${result.code}`);
    },
  };
}
export type RoomClient = Awaited<ReturnType<typeof connect>>;
export function latestPublic(client: RoomClient) {
  const message = [...client.messages]
    .reverse()
    .find((message) => message.type === 'PUBLIC_STATE');
  if (message?.type !== 'PUBLIC_STATE') throw new Error('No public state');
  return message.view;
}
export function latestPrivate(client: RoomClient) {
  const message = [...client.messages]
    .reverse()
    .find((message) => message.type === 'PRIVATE_STATE');
  if (message?.type !== 'PRIVATE_STATE') throw new Error('No private state');
  return message.view;
}
export async function sendCommand(
  client: RoomClient,
  type: string,
  fields: Record<string, unknown> = {},
) {
  const view = latestPublic(client);
  const command = {
    type,
    roomId: view.roomId,
    commandId: `command_${crypto.randomUUID().replaceAll('-', '')}`,
    expectedStateVersion: view.version,
    ...fields,
  };
  const ready = client.next(
    (message) =>
      (message.type === 'COMMAND_ACCEPTED' ||
        message.type === 'COMMAND_REJECTED') &&
      (message.commandId === command.commandId || message.commandId === null),
  );
  client.send({ type: 'COMMAND', command });
  const result = await ready;
  if (
    result.type === 'COMMAND_REJECTED' &&
    (result.code === 'RATE_LIMITED' ||
      result.code === 'PERSISTENCE_UNAVAILABLE')
  )
    return { command, result };
  await client.ping();
  return { command, result };
}
