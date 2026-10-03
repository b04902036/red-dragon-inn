import type { HealthResponse } from '../src/shared/health';
import { roomJoinSchema } from '../src/protocol/rooms';
import { roomIdSchema } from '../src/shared/ids';
import { opaqueId } from './durable/room-record';
import { apiError, requestJson } from './http';
import { allowRoomRequest, secureResponse } from './security';
export { GameRoom } from './durable/game-room';

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname, origin } = new URL(request.url);
  if (pathname === '/api/health') {
    if (request.method !== 'GET') {
      return Response.json(
        { ok: false, error: { code: 'METHOD_NOT_ALLOWED' } },
        { status: 405, headers: { Allow: 'GET' } },
      );
    }
    const health: HealthResponse = { ok: true, service: 'red-dragon-inn' };
    return Response.json(health, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (pathname === '/api/rooms' || pathname.startsWith('/api/rooms/')) {
    const incomingOrigin = request.headers.get('origin');
    if (incomingOrigin !== null && incomingOrigin !== origin)
      return apiError('ORIGIN_NOT_ALLOWED', 403);
    if (pathname === '/api/rooms') {
      if (request.method !== 'POST')
        return apiError('METHOD_NOT_ALLOWED', 405, 'POST');
      if (!(await allowRoomRequest(request, env, 'CREATE')))
        return apiError('RATE_LIMITED', 429);
      let input;
      try {
        input = roomJoinSchema.parse(await requestJson(request));
      } catch {
        return apiError('INVALID_REQUEST', 400);
      }
      const roomId = roomIdSchema.parse(opaqueId('room'));
      return env.ROOMS.getByName(roomId).fetch(
        new Request('https://room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, roomId }),
        }),
      );
    }
    const match =
      /^\/api\/rooms\/([^/]+)(?:\/(join|ws|character|presentation))?$/.exec(
        pathname,
      );
    if (match === null) return apiError('NOT_FOUND', 404);
    const parsed = roomIdSchema.safeParse(match[1]);
    if (!parsed.success) return apiError('NOT_FOUND', 404);
    const action = match[2] ?? 'metadata';
    const method =
      action === 'join' ? 'POST' : action === 'character' ? 'PATCH' : 'GET';
    if (request.method !== method)
      return apiError('METHOD_NOT_ALLOWED', 405, method);
    if (
      action !== 'metadata' &&
      action !== 'presentation' &&
      !(await allowRoomRequest(
        request,
        env,
        action === 'join' ? 'JOIN' : action === 'ws' ? 'CONNECT' : 'CHARACTER',
      ))
    )
      return apiError('RATE_LIMITED', 429);
    const forwarded = new Request(
      `https://room/${action}${new URL(request.url).search}`,
      request,
    );
    return env.ROOMS.getByName(parsed.data).fetch(forwarded);
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND' } },
      { status: 404 },
    );
  }

  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request, env): Promise<Response> {
    return secureResponse(await route(request, env));
  },
} satisfies ExportedHandler<Env>;
