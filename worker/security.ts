import { digest } from './durable/room-record';

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
export function secureResponse(response: Response) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders))
    headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export async function allowRoomRequest(
  request: Request,
  env: Env,
  kind: 'CREATE' | 'JOIN' | 'CONNECT' | 'CHARACTER',
) {
  // Cloudflare supplies this header at the edge. Missing local IPs share one local bucket.
  const key = await digest(request.headers.get('CF-Connecting-IP') ?? 'local');
  const binding = kind === 'CREATE' ? env.CREATE_LIMIT : env.ENTRY_LIMIT;
  return (await binding.limit({ key: `${kind}:${key}` })).success;
}
