import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Best-effort per-instance protection; use an edge or shared-store limiter for
// limits that must survive restarts or apply across all serverless instances.
export function createRateLimiter(limit = 10, windowMs = 10 * 60_000, maxEntries = 10_000) {
  const entries = new Map<string, { count: number; expires: number }>();
  return (key: string, now = Date.now()): Response | null => {
    for (const [id, entry] of entries) {
      if (entry.expires <= now) entries.delete(id);
    }
    let entry = entries.get(key);
    if (!entry && entries.size < maxEntries) {
      entry = { count: 0, expires: now + windowMs };
      entries.set(key, entry);
    }
    if (!entry || entry.count >= limit) {
      // Do not evict active clients when full: that would reset their limits.
      const retryMs = entry ? entry.expires - now : windowMs;
      return Response.json({ error: 'Too many requests. Please try again later.' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryMs / 1000))), 'Cache-Control': 'no-store' },
      });
    }
    entry.count++;
    return null;
  };
}

export function clientKey(request: Request): string {
  // Vercel overwrites this header. Never trust caller-supplied forwarding
  // headers on a standalone server; use a shared fallback bucket there.
  // With an upstream proxy, the address may identify that proxy.
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.trim() : undefined;
  if (!ip || !isIP(ip)) return 'unknown';
  const normalized = ip.includes(':') ? new URL(`http://[${ip}]/`).hostname : ip;
  return createHash('sha256').update(normalized).digest('hex');
}

/** Enforce the actual streamed size, even without an honest Content-Length. */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<Response> {
  const declared = request.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new RequestError('Request is too large.', 413);
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          void reader.cancel().catch(() => undefined);
          throw new RequestError('Request is too large.', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, { headers: { 'Content-Type': request.headers.get('content-type') || 'application/octet-stream' } });
}
