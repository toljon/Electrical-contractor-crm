// Optional push: one webhook call per new session, so you hear about a visit
// without going to look for it. Slack and Discord incoming webhooks both work;
// anything else receives the same JSON with a `text` field.

import { watchTerms, webhookUrl } from './config'
import type { Visit } from './types'

/** Coarse browser/OS read of a user-agent — enough to tell phone from desktop. */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'unknown client'
  const ua = userAgent.toLowerCase()

  const browser =
    ua.includes('edg/') ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera') ? 'Opera'
    : ua.includes('chrome/') && !ua.includes('chromium') ? 'Chrome'
    : ua.includes('firefox/') ? 'Firefox'
    : ua.includes('safari/') ? 'Safari'
    : 'browser'

  const os =
    ua.includes('iphone') ? 'iPhone'
    : ua.includes('ipad') ? 'iPad'
    : ua.includes('android') ? 'Android'
    : ua.includes('windows') ? 'Windows'
    : ua.includes('mac os x') || ua.includes('macintosh') ? 'Mac'
    : ua.includes('linux') ? 'Linux'
    : 'unknown OS'

  return `${browser} on ${os}`
}

/** Human-readable place, best-effort from whatever geo fields we have. */
export function describePlace(visit: Visit): string {
  const parts = [visit.city, visit.region, visit.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'unknown location'
}

/**
 * True when any VISIT_WATCH term appears in the visitor's network, referrer or
 * city — the "this is probably them" flag.
 */
export function isWatched(visit: Visit): boolean {
  const terms = watchTerms()
  if (terms.length === 0) return false
  const haystack = [visit.network, visit.city, visit.region, visit.referrer, visit.host]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return terms.some((t) => haystack.includes(t))
}

function summarise(visit: Visit): string {
  const flag = isWatched(visit) ? '🎯 ' : visit.kind === 'preview' ? '🔗 ' : '👀 '
  const lead =
    visit.kind === 'preview'
      ? `${flag}Link preview (${visit.kindReason ?? 'unfurl'}) — someone shared the URL`
      : `${flag}New visit — ${describePlace(visit)}`

  const lines = [
    lead,
    `${visit.ip ?? 'no IP'}${visit.network ? ` · ${visit.network}` : ''}`,
    `${visit.path}${visit.query ? `?${visit.query}` : ''} · ${describeDevice(visit.userAgent)}`,
  ]
  if (visit.referrer) lines.push(`referred by ${visit.referrer}`)
  return lines.join('\n')
}

/**
 * Fires the configured webhook. Bots are skipped; link previews are not.
 * Never throws — a webhook outage must not affect the request being served.
 */
export async function notifyVisit(visit: Visit): Promise<void> {
  const url = webhookUrl()
  if (!url || visit.kind === 'bot') return

  const text = summarise(visit)
  // Discord's incoming webhooks take `content`; Slack's take `text`. Sending
  // both keeps a generic endpoint working without knowing which it is.
  const payload = /discord(app)?\.com/i.test(url) ? { content: text } : { text, content: text }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn('[visits] webhook rejected', res.status)
    }
  } catch (err) {
    console.warn('[visits] webhook failed:', (err as Error).message)
  }
}
