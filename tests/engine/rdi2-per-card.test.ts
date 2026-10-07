import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/engine/commands';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import type { CoreGameState } from '../../src/engine/types';
import type { CardDefinition } from '../../src/content/cards';
import { rdi2Pack, rdi2Records } from '../fixtures/rdi2-content';
import {
  match,
  sometimesContext,
  definitionCard,
  play,
  settle,
  keep,
  card,
  activate,
  until,
  send,
} from '../fixtures/rdi2-match';
import { intent, mutable } from '../fixtures/core-match';
import { verifyOpportunity } from '../fixtures/step24b';

export function replay(state: CoreGameState, result: ReturnType<typeof play>) {
  expect(
    replayFromSnapshot(
      coreStateSchema.parse(JSON.parse(JSON.stringify(state))),
      0,
      [
        {
          actorId: result.actorId,
          command: result.command,
          firstSequence: 1,
          lastSequence: result.events.length,
          events: result.events,
          acceptedAt: new Date(result.now).toISOString(),
          clockTime: result.now,
        },
      ],
    ).state,
  ).toEqual(result.state);
}
for (const definition of rdi2Pack.cards.filter((c) => c.type === 'SOMETIMES'))
  describe(definition.id, () => {
    it('positive legalPlays, owner-aware 30s, voice predicate, hidden IDs, stale prompt, snapshot and timeout/replay', () => {
      const { state, cardId, seat } = sometimesContext(rdi2Pack, definition);
      expect(
        projectPrivatePlayer(state, state.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === cardId,
        ),
      ).toBe(true);
      expect(
        projectPrivatePlayer(state, state.players[seat]!.id).responsePrompt
          ?.hasLegalSometimes,
      ).toBe(true);
      verifyOpportunity(state, seat, cardId);
    });
    it('negative legality and illegal server command do not mutate state', () => {
      const state = match(rdi2Pack),
        cardId = definitionCard(state, definition.id);
      const seat = state.players.findIndex((p) => p.hand.includes(cardId));
      keep(state, [cardId]);
      expect(
        projectPrivatePlayer(state, state.players[seat]!.id).legalPlays.some(
          (p) => p.cardId === cardId,
        ),
      ).toBe(false);
      expect(
        applyCommand(state, intent(state, 'PLAY_CARD', { cardId }), {
          actorId: state.players[seat]!.id,
        }),
      ).toMatchObject({ status: 'REJECTED', state, events: [] });
    });
    it('exact compiled effect resolves, old prompt is invalidated, and remaining Anytime gets a fresh silent 30s decision', () => {
      const { state, cardId, seat } = sometimesContext(rdi2Pack, definition);
      const old = state.control.timedPrompt!;
      const result = play(state, cardId, undefined, old.openedAt + 100);
      expect(result.state.control.timedPrompt?.promptId).not.toBe(old.promptId);
      replay(state, result);
      expect(
        applyCommand(
          result.state,
          intent(result.state, 'PLAY_RESPONSE', {
            cardId,
            responseWindowId: old.windowId,
            promptId: old.promptId,
          }),
          { actorId: result.actorId },
        ),
      ).toMatchObject({ status: 'REJECTED', events: [] });
      const final = settle(result.state);
      expect(final.players[seat]!.characterDiscard).toContain(cardId);
      assertResponseEffect(definition, state, final, seat);
      const withAnytime = mutable(state),
        anytime = card(withAnytime, 'tip_wench', seat);
      const owner = withAnytime.players.find(
        (p) => p.id === withAnytime.cards[anytime]!.ownerId,
      )!;
      owner.characterDeck.cardIds.splice(
        owner.characterDeck.cardIds.indexOf(anytime),
        1,
      );
      owner.hand.push(anytime);
      withAnytime.cards[anytime]!.location = {
        zone: 'HAND',
        playerId: owner.id,
      };
      const refreshed = play(
        withAnytime,
        cardId,
        undefined,
        old.openedAt + 500,
      );
      expect(refreshed.state.control.timedPrompt).toMatchObject({
        openedAt: old.openedAt + 500,
      });
      const fresh = refreshed.state.control.timedPrompt!;
      expect(fresh.promptId).not.toBe(old.promptId);
      expect(fresh.deadlineAt).toBe(
        fresh.priorityPlayerId === refreshed.state.activePlayerId
          ? null
          : fresh.openedAt + 30000,
      );
      const response = projectPrivatePlayer(refreshed.state, owner.id);
      expect(response.legalPlays.some((p) => p.cardId === anytime)).toBe(true);
      expect(response.responsePrompt?.hasLegalSometimes).toBe(false);
    });
  });
function assertResponseEffect(
  definition: CardDefinition,
  before: CoreGameState,
  after: CoreGameState,
  seat: number,
) {
  if (definition.type !== 'SOMETIMES')
    throw new Error('Expected Sometimes assertion');
  const actor = before.players[seat]!,
    final = after.players[seat]!,
    parent = before.resolutionStack.at(-1)!;
  const op = definition.effects[0]!.op;
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
        ).toBe(2);
      }
      break;
    case 'END_GAMBLING':
      expect(after.gambling).toBeNull();
      expect(after.players.map((p) => p.gold)).toEqual(
        before.players.map((p) => p.gold),
      );
      break;
    case 'RESTART_GAMBLING_ROUND':
      expect(after.gambling).toMatchObject({
        pot: before.gambling!.pot + 4,
        controlPlayerId: actor.id,
        stage: 'ROUND',
      });
      break;
    case 'TAKE_FROM_GAMBLING_POT':
      expect(after.gambling!.pot).toBe(before.gambling!.pot - 1);
      expect(final.gold).toBe(actor.gold + 1);
      break;
    case 'SUBSTITUTE_PAYMENT_FROM_INN':
      expect(final.gold).toBe(actor.gold);
      expect(after.gambling!.pot).toBe(4);
      break;
    case 'PREVENT_CURRENT_GOLD_LOSS':
      expect(final.gold).toBe(actor.gold);
      expect(after.gambling!.pot).toBe(3);
      expect(after.gambling!.participants).toContain(actor.id);
      break;
    case 'CANCEL_CURRENT_ANTE_FOR_SELF':
    case 'CONTEXT_BRANCH':
      expect(after.gambling!.leftPlayerIds).toContain(actor.id);
      expect(final.gold).toBe(actor.gold);
      break;
    case 'ORDER_EXTRA_DRINKS':
    case 'ORDER_EXTRA_OR_WAIVE_REFILL':
      expect(after.players.reduce((n, p) => n + p.drinkPile.length, 0)).toBe(
        before.players.reduce((n, p) => n + p.drinkPile.length, 0) + 2,
      );
      expect(final.gold).toBe(actor.gold - (definition.mandatoryGoldCost ?? 0));
      break;
    case 'QUEUE_EXTRA_DRINK':
      expect(
        after.players.find((p) => p.id === parent.actorId)!.alcoholContent,
      ).toBe(definition.responseTrigger!.event === 'SYSTEM' ? 2 : 3);
      break;
    case 'PASS_CURRENT_DRINK':
      expect(final.alcoholContent).toBe(0);
      expect(
        after.players.some((p) => p.id !== actor.id && p.alcoholContent === 2),
      ).toBe(true);
      break;
    case 'SPLIT_CURRENT_DRINK':
      expect(final.alcoholContent).toBe(1);
      expect(
        after.players.some((p) => p.id !== actor.id && p.alcoholContent === 1),
      ).toBe(true);
      break;
    case 'REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE':
      expect(final.alcoholContent).toBe(0);
      expect(final.fortitude).toBe(20);
      break;
    case 'MODIFY_DRINK':
    case 'REPLACE_DRINK_BASE':
      expect(
        after.players.find((p) => p.id === parent.actorId)!.alcoholContent,
      ).toBe(4);
      break;
    case 'CHANGE_STAT': {
      const task = parent.task;
      if (task?.kind !== 'POST_LOSS') throw new Error('Missing post-loss task');
      const source = before.players.find((p) => p.id === task.originalPlayer)!;
      expect(after.players[source.seat]!.fortitude).toBe(source.fortitude - 2);
      break;
    }
    case 'SHARE_FORTITUDE_LOSS':
      expect(final.fortitude).toBe(actor.fortitude - 1);
      expect(
        after.players.find((p) => p.id === parent.origin!.playerId)!.fortitude,
      ).toBe(17);
      break;
    case 'REDIRECT_FORTITUDE_LOSS':
      expect(final.fortitude).toBe(actor.fortitude);
      expect(after.players.filter((p) => p.fortitude === 16)).toHaveLength(1);
      break;
    default:
      throw new Error(`Missing independent effect assertion ${definition.id}`);
  }
}
for (const definition of rdi2Pack.cards.filter((c) => c.type === 'ANYTIME'))
  it(`${definition.id}: Anytime ordinary/response/gambling/grace, negative ownership, resolution and replay`, () => {
    const base = match(rdi2Pack),
      cardId = definitionCard(base, definition.id),
      seat = base.players.findIndex((p) => p.hand.includes(cardId));
    base.players[seat]!.fortitude = 18;
    const damage = card(base, 'damage_two', seat),
      start = card(base, 'gambling_start_or_control', seat);
    keep(base, [cardId, damage, start]);
    expect(
      projectPrivatePlayer(base, base.players[seat]!.id).legalPlays.some(
        (p) => p.cardId === cardId,
      ),
    ).toBe(true);
    expect(
      applyCommand(base, intent(base, 'PLAY_CARD', { cardId }), {
        actorId: base.players[(seat + 1) % 4]!.id,
      }),
    ).toMatchObject({ status: 'REJECTED', state: base, events: [] });
    const result = play(base, cardId);
    replay(base, result);
    const final = settle(result.state);
    if (definition.effects[0]!.op === 'CHANGE_STAT')
      expect(final.players[seat]!.fortitude).toBe(20);
    else if (definition.effects[0]!.op === 'COLLECT_GOLD') {
      expect(final.players.reduce((n, p) => n + p.gold, 0)).toBe(40);
      expect(final.players[seat]!.gold).toBe(11);
    } else expect(final.players.reduce((n, p) => n + p.gold, 0)).toBe(39);
    activate(base, damage);
    const response = until(
      play(base, damage, base.players[seat]!.id).state,
      (s) => s.responseWindow?.priorityPlayerId === base.players[seat]!.id,
    );
    expect(
      projectPrivatePlayer(response, response.players[seat]!.id).responsePrompt
        ?.hasLegalSometimes,
    ).toBe(false);
    verifyOpportunity(response, seat, cardId);
    replay(response, play(response, cardId));
    activate(base, start);
    const round = settle(play(base, start).state);
    expect(settle(play(round, cardId).state).gambling).toEqual(round.gambling);
    const graceBase = mutable(base);
    keep(graceBase, [cardId]);
    graceBase.activePlayerId = graceBase.players[(seat + 1) % 4]!.id;
    const grace = send(graceBase, (seat + 1) % 4, 'SKIP_ACTION').state;
    expect(grace.control.timedPrompt!.deadlineAt).toBe(
      grace.control.timedPrompt!.openedAt + 15000,
    );
    expect(
      projectPrivatePlayer(grace, grace.players[seat]!.id).legalPlays.some(
        (p) => p.cardId === cardId,
      ),
    ).toBe(true);
    replay(grace, play(grace, cardId));
  });
it('the per-definition suites cover exactly the source-locked 116 definitions and all 190 physical RDI2 cards', () => {
  expect(rdi2Records).toHaveLength(116);
  expect(new Set(rdi2Records.map((r) => r.id))).toEqual(
    new Set(rdi2Pack.cards.map((c) => c.id)),
  );
  expect(
    rdi2Records
      .filter((r) => r.deck !== 'drink')
      .reduce((n, r) => n + r.quantity, 0),
  ).toBe(160);
  expect(JSON.stringify(projectPublicGame(match(rdi2Pack)))).not.toContain(
    'definitionId',
  );
});
