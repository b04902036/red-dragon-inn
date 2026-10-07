// Test-only entry point, typechecked with Worker globals. Never imported by production.
import productionWorker from '../../worker/index';
import { GameRoom as ProductionGameRoom } from '../../worker/durable/game-room';
import { roomRecordSchema } from '../../worker/durable/room-record';
import type { RoomRecord } from '../../worker/durable/room-record';
import { loadRuntimePack } from '../../worker/runtime-content';
import { D1ReplayRepository } from '../../worker/repositories/replay';
import { coreStateSchema, replayFromSnapshot } from '../../src/engine/replay';
import { verificationScenario } from '../fixtures/rdi2-verification';
import { synchronizePrompt } from '../../src/engine/timed-prompts';
import { assertCoreInvariants } from '../../src/engine/invariants';
import type { CoreGameState } from '../../src/engine/types';

/** Real production room code with isolated server-side checkpoint/clock injection. */
export class GameRoom extends ProductionGameRoom {
  override async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/__test/')) return super.fetch(request);
    return this.ctx
      .blockConcurrencyWhile(async () => {
        const room = roomRecordSchema.parse(await this.ctx.storage.get('room'));
        if (path === '/__test/stage') {
          const { scenario } = (await request.json()) as { scenario: string };
          const pack = await loadRuntimePack(this.env, room.contentVersionId);
          const staged = verificationScenario(pack, scenario);
          staged.control.acceptedCommands = {};
          for (const player of staged.players)
            player.displayName = room.players[player.seat]!.displayName;
          const replacements = new Map<string, string>([
            [staged.roomId, room.roomId],
            [staged.matchId, room.game!.matchId],
            ...staged.players.map(
              (p, seat) => [p.id, room.players[seat]!.id] as [string, string],
            ),
          ]);
          const remap = (value: unknown): unknown =>
            typeof value === 'string'
              ? (replacements.get(value) ?? value)
              : Array.isArray(value)
                ? value.map(remap)
                : value && typeof value === 'object'
                  ? Object.fromEntries(
                      Object.entries(value).map(([key, item]) => [
                        key,
                        remap(item),
                      ]),
                    )
                  : value;
          const remapped = remap(staged) as CoreGameState;
          assertCoreInvariants(remapped);
          const state = coreStateSchema.parse(
            JSON.parse(JSON.stringify(remapped)) as unknown,
          );
          // Keep versions monotonically increasing so clients reject stale projections.
          const game = structuredClone(state);
          (game as { version: number }).version = room.version + 1;
          const now = Date.now();
          (this as unknown as { clock: { now(): number } }).clock = {
            now: () => Date.now(),
          };
          synchronizePrompt(
            game as Parameters<typeof synchronizePrompt>[0],
            now,
            () => {},
          );
          assertCoreInvariants(game);
          await this.env.DB.prepare(
            'UPDATE matches SET state_version=? WHERE id=?',
          )
            .bind(game.version, game.matchId)
            .run();
          const updated = {
            ...room,
            game,
            version: game.version,
          };
          await this.ctx.storage.put('room', updated);
          await this.ctx.storage.put('verification:baseline', {
            state: game,
            sequence:
              (await this.ctx.storage.get<number>('history:sequence')) ?? 0,
          });
          await this.ctx.storage.deleteAlarm();
          await (
            this as unknown as { broadcast(value: RoomRecord): Promise<void> }
          ).broadcast(updated);
          return Response.json({ ok: true });
        }
        if (path === '/__test/replay') {
          const baseline = (await this.ctx.storage.get<{
            state: CoreGameState;
            sequence: number;
          }>('verification:baseline'))!;
          const entries = await new D1ReplayRepository(this.env.DB).commands(
            room.game!.matchId,
            baseline.sequence,
          );
          const replayed = replayFromSnapshot(
            baseline.state,
            baseline.sequence,
            entries,
          );
          return Response.json({
            identical:
              JSON.stringify(replayed.state) === JSON.stringify(room.game),
            commands: entries.length,
            lifecycle: room.game!.lifecycle,
          });
        }
        if (path === '/__test/result') {
          return Response.json(
            await new D1ReplayRepository(this.env.DB).result(
              room.game!.matchId,
            ),
          );
        }
        if (path === '/__test/shorten') {
          const prompt = room.game!.control.timedPrompt;
          if (!prompt || prompt.deadlineAt === null)
            throw new Error('No deadline to inject');
          const offset = prompt.deadlineAt - Date.now() - 1500;
          (this as unknown as { clock: { now(): number } }).clock = {
            now: () => Date.now() + offset,
          };
          await this.ctx.storage.setAlarm(Date.now() + 1500);
          return Response.json({ ok: true });
        }
        return new Response('Not found', { status: 404 });
      })
      .catch((error: unknown) =>
        Response.json(
          { error: error instanceof Error ? error.message : String(error) },
          { status: 500 },
        ),
      );
  }
}
export default {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties>,
    env: Env,
  ) {
    const match =
      /^\/__test\/rooms\/(room_[a-z0-9_]+)\/(stage|replay|shorten|result)$/.exec(
        new URL(request.url).pathname,
      );
    if (match)
      return env.ROOMS.getByName(match[1]!).fetch(
        new Request(`https://room/__test/${match[2]}`, request),
      );
    return productionWorker.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;
