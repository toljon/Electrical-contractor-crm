// Turns an incoming request into a Visit record. Runs in the edge runtime
// (middleware), so everything here is Web-API only — no node:crypto, no fs.

import { ignoredIps, ignoredPaths } from './config'
import type { Visit, VisitKind } from './types'

/**
 * Link-preview fetchers. These are bots, but they are the interesting kind:
 * one of these means a human pasted the URL into Slack/Teams/iMessage/etc, so
 * they get their own class rather than being filed with the crawlers.
 */
const PREVIEW_AGENTS = [
  'slackbot', 'slack-imgproxy', 'discordbot', 'telegrambot', 'whatsapp',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'skypeuripreview',
  'microsoftpreview', 'teamsbot', 'outlook', 'googledocs', 'notionbot',
  'embedly', 'quora link preview', 'redditbot', 'applebot', 'bingpreview',
  'iframely', 'opengraph', 'vkshare', 'nuzzel', 'pinterest',
]

/** Generic automation: crawlers, scanners, monitors, HTTP libraries, agents. */
const BOT_AGENTS = [
  'bot', 'crawler', 'spider', 'crawl', 'slurp', 'search',
  'curl', 'wget', 'python-requests', 'python-urllib', 'aiohttp', 'httpx',
  'go-http-client', 'java/', 'okhttp', 'axios', 'node-fetch', 'got/',
  'libwww', 'lwp::', 'perl', 'ruby', 'scrapy', 'httpclient',
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
  'lighthouse', 'pagespeed', 'gtmetrix', 'chrome-lighthouse',
  'pingdom', 'uptimerobot', 'statuscake', 'monitor', 'newrelic', 'datadog',
  'postman', 'insomnia', 'httpie', 'restsharp',
  'semrush', 'ahrefs', 'mj12', 'dotbot', 'petalbot', 'bytespider', 'dataprovider',
  'gptbot', 'claudebot', 'anthropic', 'ccbot', 'perplexity', 'amazonbot',
  'oai-searchbot', 'chatgpt', 'google-read-aloud', 'google-inspectiontool',
  'vercel-screenshot', 'vercel-favicon', 'vercel-og', 'screenshot',
  'scanner', 'nmap', 'masscan', 'zgrab', 'nuclei', 'wpscan',
]

/**
 * Never recorded. Asset and instrumentation paths only — the middleware matcher
 * already filters _next/static, _next/image, favicon and /api, this covers what
 * slips past it (RSC data fetches, well-known probes, sourcemaps).
 */
const ALWAYS_IGNORED_PREFIXES = [
  '/_next/', '/.well-known/', '/__nextjs', '/favicon', '/robots.txt',
  '/sitemap.xml', '/manifest.json', '/apple-touch-icon',
]

const ASSET_EXTENSIONS =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|woff2?|ttf|eot|txt|xml|json)$/i

function header(h: Headers, name: string): string | null {
  const v = h.get(name)
  return v && v.trim() !== '' ? v.trim() : null
}

/**
 * Client IP. On Vercel `x-vercel-forwarded-for` is set by the platform and is
 * the only one a client cannot spoof; the rest are fallbacks for other hosts
 * and local development, where the value is advisory at best.
 */
export function clientIp(h: Headers): string | null {
  const vercel = header(h, 'x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0].trim()
  const real = header(h, 'x-real-ip')
  if (real) return real
  const forwarded = header(h, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return header(h, 'cf-connecting-ip')
}

/** Vercel percent-encodes the geo headers, and sends "" for unknown fields. */
function geo(h: Headers, name: string): string | null {
  const raw = header(h, name)
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    return decoded.trim() === '' ? null : decoded
  } catch {
    return raw
  }
}

export function classify(userAgent: string | null): { kind: VisitKind; reason: string | null } {
  if (!userAgent) return { kind: 'bot', reason: 'no user-agent' }
  const ua = userAgent.toLowerCase()
  for (const term of PREVIEW_AGENTS) {
    if (ua.includes(term)) return { kind: 'preview', reason: term }
  }
  for (const term of BOT_AGENTS) {
    if (ua.includes(term)) return { kind: 'bot', reason: term }
  }
  // Every real browser says so. Anything that reaches here without it is a
  // client that did not bother to impersonate one.
  if (!ua.includes('mozilla/')) return { kind: 'bot', reason: 'non-browser agent' }
  return { kind: 'human', reason: null }
}

/**
 * Speculation-rules prefetch. The browser announces these itself, and they do
 * arrive as document requests, so this check is needed on top of the Fetch
 * Metadata one below.
 */
function isPrefetch(h: Headers): boolean {
  const purpose = (header(h, 'sec-purpose') ?? header(h, 'purpose') ?? '').toLowerCase()
  return purpose.includes('prefetch')
}

/**
 * True for a genuine top-level page load.
 *
 * This is the check that makes the log trustworthy. Next.js prefetches every
 * <Link> in the viewport, so opening one page fires background requests for
 * every other page in the nav — measured against a production build, loading
 * /dashboard alone produced requests for thirteen other routes. Recording
 * those would claim the visitor read the whole app.
 *
 * The router's own markers (`next-router-prefetch`, `rsc`,
 * `next-router-state-tree`) are stripped by Next.js before middleware runs, so
 * they cannot be used. What does survive is the browser's Fetch Metadata:
 *
 *   real navigation           → sec-fetch-dest: document, mode: navigate
 *   prefetch / client-side nav → sec-fetch-dest: empty,    mode: cors
 *
 * Clients that send no Sec-Fetch headers at all — crawlers, link unfurlers,
 * curl — are kept: they never generate RSC traffic, and they are exactly the
 * hits worth seeing.
 *
 * The cost of this rule is that in-app navigation after the first page is not
 * counted, because at this layer it is indistinguishable from a prefetch. A
 * landing page per visit is the honest reading; a page list padded with links
 * nobody clicked is not.
 */
function isDocumentRequest(h: Headers): boolean {
  const dest = header(h, 'sec-fetch-dest')?.toLowerCase()
  if (!dest) return true
  return dest === 'document'
}

/**
 * Env-driven exclusions, applied by the Node recorder rather than here.
 *
 * Middleware is bundled for the edge runtime, where Next.js inlines
 * `process.env` reads at build time — evaluating these at the edge would mean
 * a change to the ignore list needed a redeploy to take effect. Checking them
 * in the route keeps them live.
 */
export function isIgnoredVisit(visit: Visit): boolean {
  if (visit.ip && ignoredIps().includes(visit.ip.toLowerCase())) return true
  const path = visit.path.toLowerCase()
  return ignoredPaths().some((p) => path === p || path.startsWith(p))
}

function isAssetPath(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    ALWAYS_IGNORED_PREFIXES.some((p) => lower.startsWith(p)) || ASSET_EXTENSIONS.test(lower)
  )
}

/**
 * Stable identifier for a visitor, as SHA-256 over IP + user-agent. Used only
 * to group hits into sessions — the raw IP is recorded alongside it, so this
 * is a grouping key rather than a privacy measure.
 */
export async function visitorKey(ip: string | null, userAgent: string | null): Promise<string> {
  const data = new TextEncoder().encode(`${ip ?? 'unknown'}|${userAgent ?? 'unknown'}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Build a Visit from a request, or null when it should not be recorded
 * (prefetch, asset path, ignored path, or an IP on the ignore list).
 *
 * Takes a bare `{ headers }` rather than the Request itself so the caller can
 * snapshot the headers synchronously and record after the response has already
 * gone out — and so tests can construct an input without a whole Request.
 */
export async function collectVisit(
  source: { headers: Headers },
  url: URL
): Promise<Visit | null> {
  const h = source.headers
  if (isPrefetch(h)) return null
  if (!isDocumentRequest(h)) return null
  if (isAssetPath(url.pathname)) return null

  const ip = clientIp(h)
  const userAgent = header(h, 'user-agent')
  const { kind, reason } = classify(userAgent)

  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    visitorKey: await visitorKey(ip, userAgent),
    ip,
    host: header(h, 'x-forwarded-host') ?? header(h, 'host'),
    path: url.pathname,
    query: url.search ? url.search.slice(1) : null,
    referrer: header(h, 'referer') ?? header(h, 'referrer'),
    userAgent,
    country: geo(h, 'x-vercel-ip-country'),
    region: geo(h, 'x-vercel-ip-country-region'),
    city: geo(h, 'x-vercel-ip-city'),
    timezone: geo(h, 'x-vercel-ip-timezone'),
    network: null, // filled in by the recorder when enrichment is configured
    kind,
    kindReason: reason,
    env: process.env.VERCEL_ENV ?? null,
  }
}
