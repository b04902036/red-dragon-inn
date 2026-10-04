import { createServer as createHttpServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import config from '../../vite.config';

let vite: ViteDevServer;
const http = createHttpServer();

beforeAll(async () => {
  // Exercise Vite's actual Host middleware with the repository allowlist.
  // Cloudflare runtime behavior is covered by the separate Workers suites.
  vite = await createServer({
    configFile: false,
    plugins: [],
    appType: 'custom',
    server: {
      ...config.server,
      middlewareMode: true,
      hmr: false,
      ws: false,
      forwardConsole: false,
    },
  });
  vite.middlewares.use((_req, res) => res.end('Host accepted'));
  http.on('request', vite.middlewares);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  if (http.listening)
    await new Promise<void>((resolve, reject) =>
      http.close((error) => (error ? reject(error) : resolve())),
    );
  await vite?.close();
});

it.each([
  ['significant-patrol-iowa-legendary.trycloudflare.com', 200],
  ['parental-officially-prescribed-compensation.trycloudflare.com', 200],
  ['another-tunnel.trycloudflare.com', 200],
  ['parental-officially-prescribed-compensation.trycloudflare.com:443', 200],
  ['localhost', 200],
  ['unrelated.example', 403],
  ['nottrycloudflare.com', 403],
  ['significant-patrol-iowa-legendary.trycloudflare.com.attacker.example', 403],
])(
  'Host %s returns %i through the real Vite middleware',
  async (host, status) => {
    const result = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = request(
          {
            hostname: '127.0.0.1',
            port: (http.address() as AddressInfo).port,
            path: '/',
            headers: { Host: host },
          },
          (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode!, body }));
          },
        );
        req.on('error', reject);
        req.end();
      },
    );
    expect(result.status).toBe(status);
    expect(result.body).toContain(
      status === 200 ? 'Host accepted' : 'Blocked request',
    );
  },
);
