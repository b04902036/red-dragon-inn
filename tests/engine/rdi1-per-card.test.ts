import { describe, expect, it } from 'vitest';
import { applyCommand, applyTimeout } from '../../src/engine/commands';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { rdi1Pack, rdi1Records } from '../fixtures/rdi1-content';
import {
  rdi1Match,
  rdi1SometimesContext,
  rdi1Play,
  rdi1Settle,
  rdi1Keep,
  rdi1Card,
  rdi1Activate,
  rdi1Send,
  rdi1Until,
  rdi1Pass,
} from '../fixtures/rdi1-match';
import { intent, mutable } from '../fixtures/core-match';
import type { CoreGameState } from '../../src/engine/types';
import type { CardDefinition } from '../../src/content/cards';

const sometimes = rdi1Pack.cards.filter((c) => c.type === 'SOMETIMES');
const definitionCard = (state: CoreGameState, definition: CardDefinition) =>
  Object.values(state.cards).find((c) => c.definitionId === definition.id)!.id;
function replay(state: CoreGameState, result: ReturnType<typeof rdi1Play>) {
  const entry = {
    actorId: result.actorId,
    command: result.command,
    firstSequence: 1,
    lastSequence: result.events.length,
    events: result.events,
    acceptedAt: new Date(result.now).toISOString(),
    clockTime: result.now,
  };
  expect(
    replayFromSnapshot(
      coreStateSchema.parse(JSON.parse(JSON.stringify(state)) as unknown),
      0,
      [entry],
    ).state,
  ).toEqual(result.state);
}

describe('every compiled RDI1 Sometimes definition', () => {
  for (const definition of sometimes) {
    describe(definition.id, () => {
      it('playing this response recomputes remaining Anytime legality with a fresh silent 30s decision', () => {
        const context = rdi1SometimesContext(rdi1Pack, definition);
        const state = mutable(context.state);
        const anytime = rdi1Card(state, 'tip_wench', context.seat);
        const owner = state.players.find(
          (p) => p.id === state.cards[anytime]!.ownerId,
        )!;
        owner.characterDeck.cardIds.splice(
          owner.characterDeck.cardIds.indexOf(anytime),
          1,
        );
        owner.hand.push(anytime);
        state.cards[anytime]!.location = { zone: 'HAND', playerId: owner.id };
        const old = state.control.timedPrompt!;
        const played = rdi1Play(
          state,
          context.cardId,
          undefined,
          old.openedAt + 500,
        );
        const fresh = played.state.control.timedPrompt!;
        expect(fresh.promptId).not.toBe(old.promptId);
        expect(fresh.deadlineAt).toBe(
          fresh.priorityPlayerId === played.state.activePlayerId
            ? null
            : fresh.openedAt + 30_000,
        );
        expect(fresh.openedAt).toBe(old.openedAt + 500);
        const view = projectPrivatePlayer(played.state, owner.id);
        expect(view.legalPlays.some((p) => p.cardId === anytime)).toBe(true);
        expect(view.responsePrompt?.hasLegalSometimes).toBe(false);
        replay(state, played);
      });
      it('positive legality creates the private 30s prompt; pass/timeout/reconnect replay identically', () => {
        const { state, cardId, seat } = rdi1SometimesContext(
          rdi1Pack,
          definition,
        );
        const view = projectPrivatePlayer(state, state.players[seat]!.id);
        expect(view.legalPlays.find((p) => p.cardId === cardId)).toBeDefined();
        expect(view.responsePrompt).toMatchObject({ hasLegalSometimes: true });
        const prompt = state.control.timedPrompt!;
        expect(prompt.deadlineAt).toBe(
          prompt.priorityPlayerId === state.activePlayerId
            ? null
            : prompt.openedAt + 30_000,
        );
        for (const player of state.players.filter(
          (p) => p.id !== state.players[seat]!.id,
        )) {
          expect(
            JSON.stringify(projectPrivatePlayer(state, player.id)),
          ).not.toContain(cardId);
        }
        expect(JSON.stringify(projectPublicGame(state))).not.toContain(cardId);
        const restored = coreStateSchema.parse(
          JSON.parse(JSON.stringify(state)) as unknown,
        );
        expect(
          projectPrivatePlayer(restored, restored.players[seat]!.id),
        ).toEqual(view);
        const pass = rdi1Pass(state);
        expect(pass.state.control.timedPrompt?.promptId).not.toBe(
          prompt.promptId,
        );
        replay(state, pass);
        const command = {
          type: 'EXPIRE_PROMPT',
          commandId: `command_expire_${state.version}`,
          roomId: state.roomId,
          expectedStateVersion: state.version,
          promptId: prompt.promptId,
          now: prompt.deadlineAt ?? prompt.openedAt + 60000,
        };
        const expired = applyTimeout(state, command);
        expect(applyTimeout(restored, command)).toEqual(expired);
        if (prompt.deadlineAt === null) {
          expect(expired).toMatchObject({
            status: 'REJECTED',
            code: 'WRONG_WINDOW',
            state,
            events: [],
          });
          return;
        }
        expect(expired.status).toBe('ACCEPTED');
        expect(expired.state.control.timedPrompt?.promptId).not.toBe(
          prompt.promptId,
        );
        expect(
          replayFromSnapshot(restored, 0, [
            {
              actorId: prompt.priorityPlayerId,
              command,
              firstSequence: 1,
              lastSequence: expired.events.length,
              events: expired.events,
              acceptedAt: new Date(prompt.deadlineAt).toISOString(),
              clockTime: prompt.deadlineAt,
            },
          ]).state,
        ).toEqual(expired.state);
      });
      it('negative context excludes legalPlays and server rejects forged play without mutation', () => {
        const state = rdi1Match(rdi1Pack);
        const cardId = definitionCard(state, definition);
        const seat = state.players.findIndex((p) => p.hand.includes(cardId));
        rdi1Keep(state, [cardId]);
        expect(
          projectPrivatePlayer(state, state.players[seat]!.id).legalPlays.some(
            (p) => p.cardId === cardId,
          ),
        ).toBe(false);
        const result = applyCommand(
          state,
          intent(state, 'PLAY_CARD', { cardId }),
          { actorId: state.players[seat]!.id, clock: { now: () => 1000 } },
        );
        expect(result).toMatchObject({ status: 'REJECTED', state, events: [] });
      });
      it('resolves the compiled effects, invalidates the old prompt and rejects stale window/version', () => {
        const { state, cardId, seat } = rdi1SometimesContext(
          rdi1Pack,
          definition,
        );
        const old = state.control.timedPrompt!;
        const result = rdi1Play(state, cardId, undefined, old.openedAt + 100);
        expect(result.state.control.timedPrompt?.promptId).not.toBe(
          old.promptId,
        );
        replay(state, result);
        const finished = rdi1Settle(result.state);
        expect(finished.players[seat]!.characterDiscard).toContain(cardId);
        expect(
          finished.resolutionStack.some((f) => f.sourceCardId === cardId),
        ).toBe(false);
        expect(
          applyCommand(
            result.state,
            { ...result.command, commandId: 'command_stale_version' },
            { actorId: result.actorId, clock: { now: () => result.now } },
          ),
        ).toMatchObject({ status: 'REJECTED', events: [] });
        expect(
          applyCommand(
            result.state,
            intent(result.state, 'PLAY_RESPONSE', {
              cardId,
              responseWindowId: old.windowId,
              promptId: old.promptId,
            }),
            { actorId: result.actorId, clock: { now: () => result.now } },
          ),
        ).toMatchObject({ status: 'REJECTED', events: [] });
        assertSometimesEffect(definition, state, finished, seat);
      });
    });
  }
});

function assertSometimesEffect(
  definition: CardDefinition,
  before: CoreGameState,
  after: CoreGameState,
  seat: number,
) {
  const op = definition.effects[0]!.op;
  const actor = before.players[seat]!;
  const final = after.players[seat]!;
  const parent = before.resolutionStack.at(-1)!;
  switch (op) {
    case 'IGNORE':
      expect(final.fortitude).toBe(actor.fortitude);
      expect(final.alcoholContent).toBe(actor.alcoholContent);
      break;
    case 'NEGATE':
      if (definition.effects.some((e) => e.op === 'WIN_GAMBLING')) {
        expect(after.gambling).toBeNull();
        expect(final.gold).toBe(actor.gold + before.gambling!.pot);
      } else {
        const drinker = before.resolutionStack.find(
          (f) => f.kind === 'DRINK',
        )!.actorId;
        expect(
          after.players.find((p) => p.id === drinker)!.alcoholContent,
        ).toBe(
          before.players.find((p) => p.id === drinker)!.alcoholContent + 2,
        );
      }
      break;
    case 'END_GAMBLING':
      expect(after.gambling).toBeNull();
      expect(after.players.map((p) => p.gold)).toEqual(
        before.players.map((p) => p.gold),
      );
      break;
    case 'REPLACE_GAMBLING_WINNER':
      expect(after.gambling).toBeNull();
      expect(final.gold).toBe(actor.gold + before.gambling!.pot);
      break;
    case 'TAKE_FROM_GAMBLING_POT':
      expect(after.gambling!.pot).toBe(before.gambling!.pot - 1);
      expect(final.gold).toBe(actor.gold + 1);
      break;
    case 'SUBSTITUTE_PAYMENT_FROM_INN':
      expect(final.gold).toBe(actor.gold);
      expect(after.gambling!.pot).toBe(4);
      break;
    case 'CANCEL_CURRENT_ANTE_FOR_SELF':
    case 'CONTEXT_BRANCH':
      expect(after.gambling!.leftPlayerIds).toContain(actor.id);
      expect(final.gold).toBe(actor.gold);
      break;
    case 'ORDER_EXTRA_DRINKS':
      expect(after.players.reduce((n, p) => n + p.drinkPile.length, 0)).toBe(
        before.players.reduce((n, p) => n + p.drinkPile.length, 0) + 2,
      );
      expect(final.gold).toBe(actor.gold - (definition.mandatoryGoldCost ?? 0));
      break;
    case 'QUEUE_EXTRA_DRINK':
      expect(
        after.players.find((p) => p.id === parent.actorId)!.alcoholContent,
      ).toBe(
        before.players.find((p) => p.id === parent.actorId)!.alcoholContent + 3,
      );
      break;
    case 'PASS_CURRENT_DRINK':
      expect(final.alcoholContent).toBe(actor.alcoholContent);
      expect(
        after.players
          .filter((p) => p.id !== actor.id)
          .some(
            (p) =>
              p.alcoholContent === before.players[p.seat]!.alcoholContent + 2,
          ),
      ).toBe(true);
      break;
    case 'SPLIT_CURRENT_DRINK':
      expect(final.alcoholContent).toBe(actor.alcoholContent + 1);
      expect(
        after.players
          .filter((p) => p.id !== actor.id)
          .some(
            (p) =>
              p.alcoholContent === before.players[p.seat]!.alcoholContent + 1,
          ),
      ).toBe(true);
      break;
    case 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE':
      expect(final.alcoholContent).toBe(actor.alcoholContent);
      expect(final.fortitude).toBe(actor.fortitude + 2);
      break;
    case 'MODIFY_DRINK': {
      const e = definition.effects[0]!;
      if (e.op !== 'MODIFY_DRINK') throw new Error('Bad modifier');
      const drinker = before.players.find((p) => p.id === parent.actorId)!;
      expect(after.players[drinker.seat]!.alcoholContent).toBe(
        Math.max(0, drinker.alcoholContent + 2 + e.alcoholDelta),
      );
      break;
    }
    case 'CHANGE_STAT': {
      const task = parent.task;
      if (task?.kind !== 'POST_LOSS') throw new Error('Missing loss');
      const source = before.players.find((p) => p.id === task.originalPlayer)!;
      expect(after.players[source.seat]!.fortitude).toBe(source.fortitude - 2);
      break;
    }
    default:
      throw new Error(`Missing effect assertion ${definition.id}`);
  }
}

describe('every compiled RDI1 Anytime definition', () => {
  for (const definition of rdi1Pack.cards.filter((c) => c.type === 'ANYTIME')) {
    it(`${definition.id}: ordinary, response, gambling, 15s grace, stale rejection and re-evaluation`, () => {
      const base = rdi1Match(rdi1Pack);
      const cardId = definitionCard(base, definition);
      const seat = base.players.findIndex((p) => p.hand.includes(cardId));
      const start = rdi1Card(base, 'gambling_start_or_control', seat);
      const damage = rdi1Card(base, 'damage_two', seat);
      rdi1Keep(base, [cardId, start, damage]);
      expect(
        projectPrivatePlayer(base, base.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === cardId,
        ),
      ).toBe(true);
      const normal = rdi1Play(base, cardId);
      replay(base, normal);
      const completed = rdi1Settle(normal.state);
      expect(completed.players[seat]!.characterDiscard).toContain(cardId);
      if (definition.effects[0]!.op === 'CHANGE_STAT')
        expect(completed.players[seat]!.fortitude).toBe(
          base.players[seat]!.fortitude + 2,
        );
      if (definition.effects[0]!.op === 'PAY_INN')
        expect(completed.players.reduce((n, p) => n + p.gold, 0)).toBe(
          base.players.reduce((n, p) => n + p.gold, 0) - 1,
        );
      if (definition.effects[0]!.op === 'COLLECT_GOLD') {
        const target = projectPrivatePlayer(
          base,
          base.players[seat]!.id,
        ).legalPlays.find((p) => p.cardId === cardId)!.legalTargetPlayerIds[0]!;
        const source = base.players.find((p) => p.id === target)!;
        expect(completed.players[seat]!.gold).toBe(
          base.players[seat]!.gold +
            (source.id === base.players[seat]!.id ? 0 : 1),
        );
        expect(completed.players[source.seat]!.gold).toBe(
          source.gold - (source.id === base.players[seat]!.id ? 0 : 1),
        );
      }
      rdi1Activate(base, damage);
      const response = rdi1Until(
        rdi1Play(base, damage, base.players[seat]!.id).state,
        (s) => s.responseWindow?.priorityPlayerId === base.players[seat]!.id,
      );
      expect(
        projectPrivatePlayer(response, base.players[seat]!.id).responsePrompt,
      ).toMatchObject({ hasLegalSometimes: false });
      const responsePrompt = response.control.timedPrompt!;
      expect(responsePrompt.deadlineAt).toBe(
        responsePrompt.priorityPlayerId === response.activePlayerId
          ? null
          : responsePrompt.openedAt + 30_000,
      );
      const played = rdi1Play(response, cardId);
      expect(played.state.control.timedPrompt?.promptId).not.toBe(
        response.control.timedPrompt!.promptId,
      );
      replay(response, played);
      rdi1Activate(base, start);
      const round = rdi1Settle(rdi1Play(base, start).state);
      expect(round.gambling).not.toBeNull();
      expect(
        projectPrivatePlayer(round, round.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === cardId,
        ),
      ).toBe(true);
      const old = round.gambling;
      expect(rdi1Settle(rdi1Play(round, cardId).state).gambling).toEqual(old);
      const graceBase = mutable(base);
      rdi1Keep(graceBase, [cardId]);
      graceBase.phase = 'ACTION';
      const grace = rdi1Send(
        graceBase,
        graceBase.players.findIndex((p) => p.id === graceBase.activePlayerId),
        'SKIP_ACTION',
      ).state;
      const gracePrompt = grace.control.timedPrompt!;
      expect(gracePrompt.deadlineAt).toBe(
        gracePrompt.priorityPlayerId === grace.activePlayerId
          ? null
          : gracePrompt.openedAt + 15_000,
      );
      expect(
        projectPrivatePlayer(grace, grace.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === cardId,
        ),
      ).toBe(true);
      const end = rdi1Play(grace, cardId);
      replay(grace, end);
      expect(
        applyCommand(
          end.state,
          { ...end.command, commandId: 'command_old_anytime' },
          { actorId: end.actorId, clock: { now: () => end.now } },
        ),
      ).toMatchObject({ status: 'REJECTED', events: [] });
    });
  }
});

it('covers every physical character copy and all unique compiled definitions without missing records', () => {
  expect(rdi1Records).toHaveLength(110);
  expect(
    rdi1Records
      .filter((r) => r.deck !== 'drink')
      .reduce((n, r) => n + r.quantity, 0),
  ).toBe(160);
  expect(new Set(rdi1Records.map((r) => r.id))).toEqual(
    new Set(rdi1Pack.cards.map((c) => c.id)),
  );
});
