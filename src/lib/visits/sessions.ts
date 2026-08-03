// Rolls the raw hit log up into sessions.
//
// Raw hits are close to useless to read: one person looking at the demo for two
// minutes produces a dozen rows. A session — one visitor, one sitting, the list
// of pages they opened — is the unit the report is actually about.

import { SESSION_GAP_MS } from './config'
import { isWatched } from './notify'
import type { Visit, VisitKind, VisitSession } from './types'

/** Prefers the most recent non-null value across a session's hits. */
function latest(visits: Visit[], pick: (v: Visit) => string | null): string | null {
  for (let i = visits.length - 1; i >= 0; i--) {
    const value = pick(visits[i])
    if (value) return value
  }
  return null
}

/**
 * A session is as human as its most human hit: a crawler and a person sharing
 * an IP would otherwise let the crawler's classification hide the person.
 */
function sessionKind(visits: Visit[]): VisitKind {
  if (visits.some((v) => v.kind === 'human')) return 'human'
  if (visits.some((v) => v.kind === 'preview')) return 'preview'
  return 'bot'
}

/** The referrer that brought them in — the first one pointing off our own host. */
function entryReferrer(visits: Visit[]): string | null {
  for (const v of visits) {
    if (!v.referrer) continue
    try {
      const host = new URL(v.referrer).host.toLowerCase()
      if (v.host && host === v.host.toLowerCase()) continue
    } catch {
      // Unparseable referrers are still worth showing verbatim.
    }
    return v.referrer
  }
  return null
}

function toSession(visitorKey: string, visits: Visit[]): VisitSession {
  const paths: string[] = []
  for (const v of visits) if (!paths.includes(v.path)) paths.push(v.path)

  return {
    visitorKey,
    ip: latest(visits, (v) => v.ip),
    firstAt: visits[0].at,
    lastAt: visits[visits.length - 1].at,
    kind: sessionKind(visits),
    country: latest(visits, (v) => v.country),
    region: latest(visits, (v) => v.region),
    city: latest(visits, (v) => v.city),
    timezone: latest(visits, (v) => v.timezone),
    network: latest(visits, (v) => v.network),
    userAgent: latest(visits, (v) => v.userAgent),
    referrer: entryReferrer(visits),
    kindReason: latest(visits, (v) => v.kindReason),
    paths,
    hits: visits.length,
    watched: visits.some(isWatched),
  }
}

/**
 * Groups hits by visitor and splits each visitor's timeline wherever they went
 * quiet for longer than SESSION_GAP_MS. Returns newest-active first.
 */
export function buildSessions(visits: Visit[]): VisitSession[] {
  const byVisitor = new Map<string, Visit[]>()
  for (const v of visits) {
    const bucket = byVisitor.get(v.visitorKey)
    if (bucket) bucket.push(v)
    else byVisitor.set(v.visitorKey, [v])
  }

  const sessions: VisitSession[] = []
  for (const [key, list] of byVisitor) {
    list.sort((a, b) => a.at.localeCompare(b.at))

    let current: Visit[] = []
    for (const v of list) {
      const previous = current[current.length - 1]
      if (previous && Date.parse(v.at) - Date.parse(previous.at) > SESSION_GAP_MS) {
        sessions.push(toSession(key, current))
        current = []
      }
      current.push(v)
    }
    if (current.length > 0) sessions.push(toSession(key, current))
  }

  return sessions.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

export interface VisitSummary {
  humanSessions: number
  humanSessions7d: number
  previewSessions: number
  botSessions: number
  uniqueHumanIps: number
  watchedSessions: number
  lastHumanAt: string | null
  totalHits: number
}

export function summarise(sessions: VisitSession[], now = Date.now()): VisitSummary {
  const humans = sessions.filter((s) => s.kind === 'human')
  const weekAgo = now - 7 * 86_400_000

  return {
    humanSessions: humans.length,
    humanSessions7d: humans.filter((s) => Date.parse(s.lastAt) >= weekAgo).length,
    previewSessions: sessions.filter((s) => s.kind === 'preview').length,
    botSessions: sessions.filter((s) => s.kind === 'bot').length,
    uniqueHumanIps: new Set(humans.map((s) => s.ip).filter(Boolean)).size,
    watchedSessions: sessions.filter((s) => s.watched).length,
    lastHumanAt: humans[0]?.lastAt ?? null,
    totalHits: sessions.reduce((sum, s) => sum + s.hits, 0),
  }
}
