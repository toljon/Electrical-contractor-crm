// Persistence for the visit log. Node runtime only — imported by /api/events.
//
// Two sinks, because neither is sufficient alone:
//
//  * SQLite is always written. Locally that is a real durable file. On Vercel
//    the data directory falls back to /tmp (see resolveDataDir in
//    localdb/database.ts), which is per-instance and wiped on cold start — so
//    there it is a best-effort cache, not a record.
//  * Upstash Redis is written when configured, and is then the source of truth
//    for the report. This is what makes the log actually survive on Vercel.
//
// Nothing in here is allowed to throw: a failure to log a visit must never turn
// into a failure to serve the page.

import { getDb } from '@/lib/localdb/database'
import {
  REDIS_LOG_KEY,
  REDIS_MAX_ENTRIES,
  REDIS_SESSION_PREFIX,
  SESSION_GAP_MS,
  redisStore,
  retentionDays,
} from './config'
import type { Visit } from './types'

type Row = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function rowToVisit(r: Row): Visit {
  return {
    id: String(r.id),
    at: String(r.at),
    visitorKey: String(r.visitor_key),
    ip: str(r.ip),
    host: str(r.host),
    path: String(r.path),
    query: str(r.query),
    referrer: str(r.referrer),
    userAgent: str(r.user_agent),
    country: str(r.country),
    region: str(r.region),
    city: str(r.city),
    timezone: str(r.timezone),
    network: str(r.network),
    kind: (str(r.kind) ?? 'human') as Visit['kind'],
    kindReason: str(r.kind_reason),
    env: str(r.env),
  }
}

// ---------------------------------------------------------------- Redis (REST)

async function redisPipeline(commands: (string | number)[][]): Promise<unknown[] | null> {
  const store = redisStore()
  if (!store) return null
  try {
    const res = await fetch(`${store.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${store.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[visits] redis pipeline failed', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = (await res.json()) as { result?: unknown; error?: string }[]
    if (!Array.isArray(json)) return null
    return json.map((entry) => (entry?.error ? null : (entry?.result ?? null)))
  } catch (err) {
    console.warn('[visits] redis unreachable:', (err as Error).message)
    return null
  }
}

// --------------------------------------------------------------------- Writes

let writesSincePrune = 0

/**
 * Exported so a test can run it against a throwaway database: better-sqlite3
 * matches named parameters against the bound object exactly, so a renamed Visit
 * field would otherwise fail for the first time in production.
 */
export const VISIT_INSERT_SQL = `INSERT OR IGNORE INTO site_visits
   (id, at, visitor_key, ip, host, path, query, referrer, user_agent,
    country, region, city, timezone, network, kind, kind_reason, env)
 VALUES
   (@id, @at, @visitorKey, @ip, @host, @path, @query, @referrer, @userAgent,
    @country, @region, @city, @timezone, @network, @kind, @kindReason, @env)`

function insertSqlite(visit: Visit): void {
  try {
    getDb().prepare(VISIT_INSERT_SQL).run(visit)

    // Amortised cleanup — cheap enough to skip most of the time, and the row
    // count only matters on a long-lived local database anyway.
    if (++writesSincePrune >= 100) {
      writesSincePrune = 0
      const cutoff = new Date(Date.now() - retentionDays() * 86_400_000).toISOString()
      getDb().prepare('DELETE FROM site_visits WHERE at < ?').run(cutoff)
    }
  } catch (err) {
    console.warn('[visits] sqlite write failed:', (err as Error).message)
  }
}

/** Records a visit to every configured sink. Never throws. */
export async function recordVisit(visit: Visit): Promise<void> {
  insertSqlite(visit)
  await redisPipeline([
    ['LPUSH', REDIS_LOG_KEY, JSON.stringify(visit)],
    ['LTRIM', REDIS_LOG_KEY, 0, REDIS_MAX_ENTRIES - 1],
  ])
}

/**
 * True when this visitor has not been seen within the session gap — i.e. this
 * hit starts a new visit rather than continuing one. Called *before* the visit
 * is recorded, and used to decide whether to fire a webhook, so that browsing
 * ten pages produces one notification instead of ten.
 */
export async function isNewSession(visitorKey: string): Promise<boolean> {
  const ttlSeconds = Math.floor(SESSION_GAP_MS / 1000)

  // SET NX is atomic, so concurrent requests from the same visitor cannot both
  // decide they are the new session.
  const viaRedis = await redisPipeline([
    ['SET', `${REDIS_SESSION_PREFIX}${visitorKey}`, '1', 'NX', 'EX', ttlSeconds],
  ])
  if (viaRedis) return viaRedis[0] === 'OK'

  try {
    const cutoff = new Date(Date.now() - SESSION_GAP_MS).toISOString()
    const row = getDb()
      .prepare('SELECT 1 AS hit FROM site_visits WHERE visitor_key = ? AND at >= ? LIMIT 1')
      .get(visitorKey, cutoff) as { hit: number } | undefined
    return row === undefined
  } catch {
    // Unknown rather than false: better a duplicate ping than a missed one.
    return true
  }
}

// ---------------------------------------------------------------------- Reads

/** Most recent visits, newest first. Redis wins when configured. */
export async function readVisits(limit = 2000): Promise<Visit[]> {
  const capped = Math.min(Math.max(limit, 1), REDIS_MAX_ENTRIES)

  const viaRedis = await redisPipeline([['LRANGE', REDIS_LOG_KEY, 0, capped - 1]])
  if (viaRedis) {
    const entries = viaRedis[0]
    if (Array.isArray(entries)) {
      return entries
        .map((raw) => {
          try {
            return JSON.parse(String(raw)) as Visit
          } catch {
            return null
          }
        })
        .filter((v): v is Visit => v !== null)
    }
  }

  try {
    const rows = getDb()
      .prepare('SELECT * FROM site_visits ORDER BY at DESC LIMIT ?')
      .all(capped) as Row[]
    return rows.map(rowToVisit)
  } catch (err) {
    console.warn('[visits] sqlite read failed:', (err as Error).message)
    return []
  }
}

/** Where the report's data came from, so the UI can say so. */
export function storeLabel(): 'redis' | 'sqlite' {
  return redisStore() ? 'redis' : 'sqlite'
}
