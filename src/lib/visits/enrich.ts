// Optional IP → network lookup via ipinfo.io.
//
// Vercel's edge headers give a city, which answers "somewhere near Boston" but
// not "who". ipinfo returns the owning organisation ("AS1234 Example Corp") and
// the reverse-DNS hostname, which is what turns an anonymous hit into a
// recognisable one when a visitor is on their employer's network.
//
// Off unless VISIT_IPINFO_TOKEN is set, because it forwards the visitor's IP to
// a third party. Failures are swallowed — enrichment is a nicety, and a lookup
// outage must not cost us the visit record.

import { REDIS_NETWORK_PREFIX, ipinfoToken, redisStore } from './config'

/** Per-instance memo, so a burst of hits from one visitor costs one lookup. */
const memo = new Map<string, string | null>()

const CACHE_TTL_SECONDS = 30 * 86_400

/** Private/loopback ranges — never worth a lookup, and ipinfo rejects them. */
function isPrivate(ip: string): boolean {
  return (
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

async function cacheGet(ip: string): Promise<string | null | undefined> {
  if (memo.has(ip)) return memo.get(ip)
  const store = redisStore()
  if (!store) return undefined
  try {
    const res = await fetch(`${store.url}/get/${encodeURIComponent(REDIS_NETWORK_PREFIX + ip)}`, {
      headers: { Authorization: `Bearer ${store.token}` },
      cache: 'no-store',
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as { result?: string | null }
    if (json.result == null) return undefined
    return json.result === '' ? null : json.result
  } catch {
    return undefined
  }
}

async function cacheSet(ip: string, value: string | null): Promise<void> {
  memo.set(ip, value)
  const store = redisStore()
  if (!store) return
  try {
    await fetch(
      `${store.url}/set/${encodeURIComponent(REDIS_NETWORK_PREFIX + ip)}/${encodeURIComponent(value ?? '')}?ex=${CACHE_TTL_SECONDS}`,
      { headers: { Authorization: `Bearer ${store.token}` }, cache: 'no-store' }
    )
  } catch {
    // cache-only failure; the memo above still saves the repeat lookups
  }
}

/**
 * Returns something like `AS1234 Example Corp · host.example.com`, or null when
 * enrichment is off, the IP is private, or the lookup did not resolve.
 */
export async function lookupNetwork(ip: string | null): Promise<string | null> {
  const token = ipinfoToken()
  if (!token || !ip || isPrivate(ip)) return null

  const cached = await cacheGet(ip)
  if (cached !== undefined) return cached

  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      await cacheSet(ip, null)
      return null
    }
    const json = (await res.json()) as { org?: string; hostname?: string }
    const parts = [json.org?.trim(), json.hostname?.trim()].filter(Boolean)
    const network = parts.length > 0 ? parts.join(' · ') : null
    await cacheSet(ip, network)
    return network
  } catch {
    memo.set(ip, null)
    return null
  }
}
