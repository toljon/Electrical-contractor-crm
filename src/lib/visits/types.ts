// Shape of one recorded hit on the public deployment. Shared by the edge
// collector (middleware), the Node recorder (/api/events) and the report renderer.

/**
 * What made the request.
 *
 * `preview` is split out from `bot` on purpose: a Slackbot/LinkedIn/WhatsApp
 * unfurl is not noise, it is the strongest signal this log produces — it means
 * a human pasted the link into a conversation. Those are surfaced in the
 * report; generic crawlers are collapsed out of the way.
 */
export type VisitKind = 'human' | 'preview' | 'bot'

export interface Visit {
  id: string
  /** ISO-8601, UTC. */
  at: string
  /** Stable per (ip, user-agent) pair — groups a burst of hits into a session. */
  visitorKey: string
  ip: string | null
  host: string | null
  path: string
  query: string | null
  referrer: string | null
  userAgent: string | null
  /** Geo comes from Vercel's edge headers; all null off-platform. */
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  /** Owning network/ASN, only when IP enrichment is configured. */
  network: string | null
  kind: VisitKind
  /** Which rule classified it — kept so a misfiring bot pattern is debuggable. */
  kindReason: string | null
  /** VERCEL_ENV: production | preview | development. */
  env: string | null
}

/** One visitor's contiguous activity, as assembled by the report. */
export interface VisitSession {
  visitorKey: string
  ip: string | null
  firstAt: string
  lastAt: string
  kind: VisitKind
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  network: string | null
  userAgent: string | null
  referrer: string | null
  /** Which rule classified the session — names the crawler or unfurler. */
  kindReason: string | null
  /** Distinct paths, in the order they were first hit. */
  paths: string[]
  hits: number
  /** True when the visitor matches one of VISIT_WATCH's terms. */
  watched: boolean
}
