// HMAC for the middleware → /api/events hop.
//
// The collector route has to accept POSTs from the edge runtime, which means it
// is reachable by anyone who finds it. Without a signature they could forge
// arbitrary visit records; with one the route only accepts records minted by
// this deployment's own middleware. Same Web Crypto approach as localdb/session
// so it verifies in both runtimes.

const DEV_SECRET = 'tgg-visits-local-dev-secret'

/** Skew tolerance, so a captured beacon cannot be replayed indefinitely. */
const MAX_AGE_MS = 5 * 60 * 1000

export const SIGNATURE_HEADER = 'x-tgg-v'

function secret(): string {
  return (
    process.env.VISIT_SIGNING_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    DEV_SECRET
  )
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Returns the header value to send alongside `body`. Format: `t=<ms>,v=<hex>`. */
export async function signBody(body: string, now = Date.now()): Promise<string> {
  return `t=${now},v=${await hmac(`${now}.${body}`)}`
}

export async function verifyBody(
  body: string,
  headerValue: string | null,
  now = Date.now()
): Promise<boolean> {
  if (!headerValue) return false
  const match = /^t=(\d+),v=([0-9a-f]+)$/.exec(headerValue.trim())
  if (!match) return false
  const [, tsRaw, sig] = match
  const ts = Number(tsRaw)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_MS) return false

  const expected = await hmac(`${ts}.${body}`)
  if (sig.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

/** Constant-time string compare, for the report access key. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
