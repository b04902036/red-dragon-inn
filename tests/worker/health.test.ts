import { env, exports } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index';

describe('Worker API in the Workers runtime', () => {
  it('delegates non-API requests unchanged to the assets binding', async () => {
    const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
    const request = new IncomingRequest('https://example.com/welcome');
    const assetResponse = new Response('Sample application shell', {
      headers: { 'Content-Type': 'text/html' },
    });
    const assetFetch = vi.fn().mockResolvedValue(assetResponse);
    const assetEnv: Env = {
      ...env,
      ASSETS: { ...env.ASSETS, fetch: assetFetch },
    };

    const response = await worker.fetch(request, assetEnv);
    expect(assetFetch).toHaveBeenCalledExactlyOnceWith(request);
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(await response.text()).toBe('Sample application shell');
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('returns a stable JSON health response with no caching', async () => {
    const response = await exports.default.fetch(
      'https://example.com/api/health',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      ok: true,
      service: 'red-dragon-inn',
    });
  });

  it('accepts query parameters without changing the response shape', async () => {
    const response = await exports.default.fetch(
      'https://example.com/api/health?check=1',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: 'red-dragon-inn',
    });
  });

  it.each(['/api', '/api/missing', '/api/health/extra'])(
    'returns an intentional JSON 404 for %s',
    async (path) => {
      const response = await exports.default.fetch(
        `https://example.com${path}`,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain(
        'application/json',
      );
      expect(await response.json()).toEqual({
        ok: false,
        error: { code: 'NOT_FOUND' },
      });
    },
  );

  it.each(['POST', 'PUT', 'DELETE'])(
    'rejects %s on the read-only health endpoint',
    async (method) => {
      const response = await exports.default.fetch(
        'https://example.com/api/health',
        { method },
      );
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET');
      expect(await response.json()).toEqual({
        ok: false,
        error: { code: 'METHOD_NOT_ALLOWED' },
      });
    },
  );
});
