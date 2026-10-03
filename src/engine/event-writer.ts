import { domainEventSchema } from '../protocol/events';
import type { DomainEvent } from '../protocol/events';
import { eventIdSchema } from '../shared/ids';
import type { CommandId } from '../shared/ids';
import type { StateVersion } from '../shared/version';
import type { CoreGameState } from './types';
import { matchNamespace } from './identity';

type Metadata =
  | 'eventId'
  | 'commandId'
  | 'roomId'
  | 'matchId'
  | 'stateVersion'
  | 'eventIndex';
type Payload<Event> = Event extends DomainEvent ? Omit<Event, Metadata> : never;
export type EventPayload = Payload<DomainEvent>;
export type EmitEvent = (payload: EventPayload) => void;
export function eventWriter(
  state: CoreGameState,
  commandId: CommandId,
  version: StateVersion,
) {
  const events: DomainEvent[] = [];
  const emit: EmitEvent = (payload) => {
    const eventIndex = events.length;
    events.push(
      domainEventSchema.parse({
        ...payload,
        eventId: eventIdSchema.parse(
          `event_${matchNamespace(state.matchId)}_${version}_${eventIndex}`,
        ),
        commandId,
        roomId: state.roomId,
        matchId: state.matchId,
        stateVersion: version,
        eventIndex,
      }),
    );
  };
  return { events, emit };
}
