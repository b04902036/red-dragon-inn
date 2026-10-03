export function apiError(code: string, status: number, allow?: string) {
  return Response.json(
    { ok: false, error: { code } },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(allow ? { Allow: allow } : {}),
        ...(status === 429 ? { 'Retry-After': '60' } : {}),
      },
    },
  );
}
export async function requestJson(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  )
    throw new TypeError('JSON required');
  if (Number(request.headers.get('content-length')) > 65_536)
    throw new RangeError('Request too large');
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError('JSON body required');
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  let text = '';
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 65_536) {
        await reader.cancel();
        throw new RangeError('Request too large');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text) as unknown;
}
