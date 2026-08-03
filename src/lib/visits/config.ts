// Environment-driven configuration for the private visit log.
//
// Every `process.env.X` below is a *static* property reference evaluated inside
// a function. That is deliberate on both counts: Next.js inlines statically
// analysable references when it bundles middleware for the edge runtime, so
// `process.env[someVariable]` would read as undefined there — and reading at
// call time rather than module scope keeps the Node routes picking up a changed
// Vercel env var on the next invocation instead of the next deployment.

const OFF = new Set(['0', 'false', 'off', 'no', 'disabled'])

function flag(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback
  return !OFF.has(raw.trim().toLowerCase())
}

function list(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** Master switch. On by default; set VISIT_TRACKING=0 to record nothing. */
export function trackingEnabled(): boolean {
  return flag(process.env.VISIT_TRACKING, true)
}

/**
 * Shared secret for the report URL. Returns null when unset or too short, and
 * the report route 404s — a guessable key on an unauthenticated URL is worse
 * than no report, and this one necessarily travels in a query string.
 */
export function accessKey(): string | null {
  const k = process.env.VISIT_ACCESS_KEY?.trim()
  if (!k) return null
  return k.length >= 16 ? k : null
}

/** Set but rejected — worth a log line, since the symptom is a silent 404. */
export function accessKeyTooShort(): boolean {
  const k = process.env.VISIT_ACCESS_KEY?.trim()
  return !!k && k.length < 16
}

/** Your own IP(s), so walking the deployment yourself does not fill the log. */
export function ignoredIps(): string[] {
  return list(process.env.VISIT_IGNORE_IPS)
}

/** Extra path prefixes to skip, beyond the always-ignored asset paths. */
export function ignoredPaths(): string[] {
  return list(process.env.VISIT_IGNORE_PATHS)
}

/**
 * Substrings flagged in the report when they appear in a visitor's network,
 * hostname or city — e.g. "gallagher,waltham". Purely presentational: matching
 * changes nothing about what is recorded.
 */
export function watchTerms(): string[] {
  return list(process.env.VISIT_WATCH)
}

/** Slack/Discord/generic incoming webhook, pinged once per new session. */
export function webhookUrl(): string | null {
  const u = process.env.VISIT_WEBHOOK_URL?.trim()
  return u && /^https:\/\//i.test(u) ? u : null
}

/**
 * Upstash Redis REST credentials. Without these the log lives only in SQLite,
 * which on Vercel means /tmp — per-instance and wiped on cold start (see
 * resolveDataDir in localdb/database.ts). Anyone who wants the log to survive
 * more than a few minutes on Vercel needs this configured.
 */
export function redisStore(): { url: string; token: string } | null {
  const url = (process.env.VISIT_KV_REST_API_URL ?? process.env.KV_REST_API_URL)?.trim()
  const token = (process.env.VISIT_KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim()
  if (!url || !token || !/^https:\/\//i.test(url)) return null
  return { url: url.replace(/\/+$/, ''), token }
}

/**
 * ipinfo.io token. Turns a bare address into "AS1234 Some Company Inc", which
 * is the difference between "someone in Boston" and a named employer. Opt-in
 * because it forwards the visitor's IP to a third party.
 */
export function ipinfoToken(): string | null {
  return process.env.VISIT_IPINFO_TOKEN?.trim() || null
}

/** Days of history to keep in SQLite. */
export function retentionDays(): number {
  const n = Number(process.env.VISIT_RETENTION_DAYS)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90
}

/** Gap after which a visitor's next hit counts as a new session. */
export const SESSION_GAP_MS = 30 * 60 * 1000

/** Cap on rows held in Redis; keeps the list from growing without bound. */
export const REDIS_MAX_ENTRIES = 5000

export const REDIS_LOG_KEY = 'tgg:visits:log'
export const REDIS_SESSION_PREFIX = 'tgg:visits:seen:'
export const REDIS_NETWORK_PREFIX = 'tgg:visits:net:'
