import { z } from 'zod';
import { clientCommandSchema, type ClientCommand } from './commands';
import { domainEventSchema, type DomainEvent } from './events';
import { serverMessageSchema, type ServerMessage } from './messages';
import { clientRoomMessageSchema, type ClientRoomMessage } from './rooms';

const jsonFrameSchema = z.string().max(65_536);

function decodeJson(frame: string): unknown {
  return JSON.parse(jsonFrameSchema.parse(frame)) as unknown;
}

export function decodeClientCommand(frame: string): ClientCommand {
  return clientCommandSchema.parse(decodeJson(frame));
}

export function decodeClientRoomMessage(frame: string): ClientRoomMessage {
  return clientRoomMessageSchema.parse(decodeJson(frame));
}

export function encodeClientRoomMessage(message: ClientRoomMessage): string {
  return jsonFrameSchema.parse(
    JSON.stringify(clientRoomMessageSchema.parse(message)),
  );
}

export function decodeDomainEvent(frame: string): DomainEvent {
  return domainEventSchema.parse(decodeJson(frame));
}

export function decodeServerMessage(frame: string): ServerMessage {
  return serverMessageSchema.parse(decodeJson(frame));
}

export function encodeClientCommand(command: ClientCommand): string {
  return jsonFrameSchema.parse(
    JSON.stringify(clientCommandSchema.parse(command)),
  );
}

export function encodeDomainEvent(event: DomainEvent): string {
  return jsonFrameSchema.parse(JSON.stringify(domainEventSchema.parse(event)));
}

export function encodeServerMessage(message: ServerMessage): string {
  return jsonFrameSchema.parse(
    JSON.stringify(serverMessageSchema.parse(message)),
  );
}
