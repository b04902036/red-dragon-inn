import { expect } from 'vitest';
import type { CoreGameState } from '../../src/engine/types';
import type { DomainEvent } from '../../src/protocol/events';
import {
  emptyNarrationContext,
  projectPublicNarration,
} from '../../src/protocol/public-narration-projector';
import type { PublicNarrationEvent } from '../../src/protocol/public-narration';
import { play, send } from './generic-match';
import { rdi1Pass } from './rdi1-match';
export class NarrationMatch {
  sequence = 0;
  context = emptyNarrationContext();
  narration: PublicNarrationEvent[] = [];
  domain: { sequence: number; event: DomainEvent }[] = [];
  constructor(public state: CoreGameState) {}
  accept(result: ReturnType<typeof send>) {
    const batch = result.events.map((event) => ({
      sequence: ++this.sequence,
      event,
    }));
    const projected = projectPublicNarration(batch, this.context);
    this.context = projected.context;
    this.narration.push(...projected.events);
    this.domain.push(...batch);
    this.state = result.state;
    return result;
  }
  play(seat: number, cardId: string, target?: string) {
    return this.accept(play(this.state, seat, cardId, target));
  }
  send(type: string, fields: Record<string, unknown> = {}, seat?: number) {
    return this.accept(send(this.state, type, fields, seat));
  }
  until(predicate: (state: CoreGameState) => boolean) {
    for (let n = 0; n < 160 && !predicate(this.state); n++)
      this.accept(rdi1Pass(this.state));
    expect(predicate(this.state)).toBe(true);
    return this.state;
  }
  settle() {
    return this.until(
      (state) => !state.responseWindow && !state.control.phaseEnd,
    );
  }
}
