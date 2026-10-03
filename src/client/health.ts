import type { HealthResponse } from '../shared/health';

export type HealthState =
  | { status: 'checking' }
  | { status: 'healthy'; health: HealthResponse }
  | { status: 'unavailable' };

export async function fetchHealth(
  signal: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('Health request failed');

  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('ok' in body) ||
    body.ok !== true ||
    !('service' in body) ||
    body.service !== 'red-dragon-inn'
  ) {
    throw new Error('Invalid health response');
  }

  return { ok: body.ok, service: body.service };
}
