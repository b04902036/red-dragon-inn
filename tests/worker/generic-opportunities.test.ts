import { env } from 'cloudflare:workers';
import {
  runInDurableObject,
  runDurableObjectAlarm,
  evictDurableObject,
} from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { contentPackSchema } from '../../src/content/pack';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import { taskEvent } from '../../src/engine/workflow-state';
import { D1ContentRepository } from '../../worker/repositories/content';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import type { GameRoom } from '../../worker/durable/game-room';
import { freshDatabase } from './database-helpers';
import {
  newRoom,
  joinRoom,
  connect,
  sendCommand,
  latestPrivate,
  latestPublic,
  storedRoom,
  stubFor,
} from './room-helpers';

beforeEach(freshDatabase);
it.each([
  'ANTE_REQUIRED',
  'PAYMENT_REQUIRED',
  'GAMBLING_CHECKPOINT',
  'GAMBLING_WIN_BEFORE_PAYOUT',
  'FORTITUDE_LOSS_RESOLVED',
  'PHASE_OPPORTUNITY',
] as const)(
  'persists %s through WebSocket, hibernation, real alarms, and verified D1 replay',
  async (event) => {
    const pack = structuredClone(localizedFixturePack);
    const index = pack.cards.findIndex(
      (c) => c.id === 'carddef_sample_breather',
    );
    const effects =
      event === 'ANTE_REQUIRED' || event === 'PAYMENT_REQUIRED'
        ? [{ op: 'SUBSTITUTE_PAYMENT_FROM_INN', amount: 1 }]
        : event === 'GAMBLING_WIN_BEFORE_PAYOUT'
          ? [{ op: 'REPLACE_GAMBLING_WINNER', target: 'SELF' }]
          : event === 'PHASE_OPPORTUNITY'
            ? [{ op: 'ORDER_EXTRA_DRINKS', count: 2 }]
            : [
                {
                  op: 'CHANGE_STAT',
                  stat: 'FORTITUDE',
                  target: 'SELF',
                  delta: 1,
                },
              ];
    pack.cards[index] = contentPackSchema.shape.cards.element.parse({
      ...pack.cards[index],
      type: 'SOMETIMES',
      responseKind: 'SOMETIMES',
      effects,
      ...(event === 'PHASE_OPPORTUNITY'
        ? { phaseOpportunity: 'ORDER_DRINK' }
        : {
            responseTrigger: {
              event: 'SYSTEM',
              alternatives: [
                [
                  { kind: 'SYSTEM_EVENT', events: [event] },
                  ...(event === 'FORTITUDE_LOSS_RESOLVED'
                    ? [
                        {
                          kind: 'ACTUAL_STAT_LOSS',
                          stat: 'FORTITUDE',
                          relation: 'SELF',
                          minAmount: 1,
                        },
                      ]
                    : []),
                ],
              ],
            },
          }),
    });
    if (event === 'PAYMENT_REQUIRED') {
      const source = pack.cards.findIndex(
        (c) => c.id === 'carddef_sample_shove',
      );
      pack.cards[source] = contentPackSchema.shape.cards.element.parse({
        ...pack.cards[source],
        effects: [{ op: 'PAY_INN', target: 'CHOSEN_PLAYER', amount: 2 }],
      });
    }
    const content = new D1ContentRepository(env.DB);
    await content.saveDraft(pack);
    await content.publishVersion(pack.version.id);
    const host = await newRoom(),
      guest = await joinRoom(host.roomId),
      stub = stubFor(host.roomId);
    const now = Date.now() + 3600000;
    const clock = async (value: number) =>
      runInDurableObject(stub, (instance: GameRoom) => {
        (instance as unknown as { clock: { now(): number } }).clock = {
          now: () => value,
        };
      });
    await clock(now);
    const peers = [await connect(host.roomId), await connect(host.roomId)];
    try {
      await peers[0]!.hello(host.credentials);
      await peers[1]!.hello(guest.credentials);
      const execute = async (
        seat: number,
        type: string,
        fields: Record<string, unknown> = {},
      ) => {
        expect(
          (await sendCommand(peers[seat]!, type, fields)).result.type,
        ).toBe('COMMAND_ACCEPTED');
        await Promise.all(peers.map((p) => p.ping()));
      };
      await execute(0, 'START_MATCH');
      await execute(0, 'DISCARD', { cardIds: [] });
      if (event === 'PHASE_OPPORTUNITY') await execute(0, 'SKIP_ACTION');
      else {
        const source = latestPrivate(peers[0]!).hand.find(
          (c) =>
            c.definitionId ===
            (event === 'PAYMENT_REQUIRED' || event === 'FORTITUDE_LOSS_RESOLVED'
              ? 'carddef_sample_shove'
              : 'carddef_sample_gamble'),
        )!;
        await execute(0, 'PLAY_CARD', {
          cardId: source.id,
          ...(source.definitionId === 'carddef_sample_shove'
            ? { targetPlayerId: guest.credentials.playerId }
            : {}),
        });
      }
      for (let i = 0; i < 32; i++) {
        const game = (await storedRoom(host.roomId)).game!;
        if (taskEvent(game.resolutionStack.at(-1)?.task) === event) break;
        const priority =
          game.responseWindow?.priorityPlayerId ??
          game.control.phaseEnd?.priorityPlayerId ??
          game.gambling?.priorityPlayerId;
        const seat = priority === host.credentials.playerId ? 0 : 1;
        await execute(
          seat,
          game.responseWindow
            ? 'PASS_RESPONSE'
            : game.control.phaseEnd
              ? 'PASS_ANYTIME'
              : 'GAMBLING_PASS',
          game.responseWindow
            ? { responseWindowId: game.responseWindow.id }
            : game.control.phaseEnd
              ? { responseWindowId: game.control.phaseEnd.id }
              : {},
        );
      }
      const game = (await storedRoom(host.roomId)).game!;
      expect(taskEvent(game.resolutionStack.at(-1)?.task)).toBe(event);
      const prompt = game.control.timedPrompt!;
      expect(prompt.deadlineAt - prompt.openedAt).toBe(30000);
      expect(
        await runInDurableObject(stub, (_instance, ctx) =>
          ctx.storage.getAlarm(),
        ),
      ).toBe(prompt.deadlineAt);
      const seat =
        prompt.priorityPlayerId === host.credentials.playerId ? 0 : 1;
      expect(
        latestPrivate(peers[seat]!).legalPlays.some(
          (c) => c.promptId === prompt.promptId,
        ),
      ).toBe(true);
      expect(latestPrivate(peers[1 - seat]!).legalPlays).toEqual([]);
      for (const foreign of game.players[1 - seat]!.hand)
        expect(JSON.stringify(latestPrivate(peers[seat]!))).not.toContain(
          JSON.stringify(foreign),
        );
      expect(JSON.stringify(latestPublic(peers[seat]!))).not.toContain(
        'pendingTasks',
      );
      await evictDurableObject(stub);
      await clock(now);
      const resumed = await connect(host.roomId);
      await resumed.hello(seat === 0 ? host.credentials : guest.credentials);
      expect(latestPublic(resumed).timedPrompt).toEqual(prompt);
      peers.push(resumed);
      await clock(prompt.deadlineAt);
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      const expired = (await storedRoom(host.roomId)).game!;
      expect(expired.control.timedPrompt?.promptId).not.toBe(prompt.promptId);
      const replay = new D1ReplayRepository(env.DB);
      expect(
        (await replay.commands(game.matchId)).filter(
          (c) => c.command.type === 'EXPIRE_PROMPT',
        ),
      ).toHaveLength(1);
      expect((await replay.restore(game.matchId, true)).state).toEqual(expired);
    } finally {
      peers.forEach((p) => p.socket.close());
    }
  },
  30000,
);
