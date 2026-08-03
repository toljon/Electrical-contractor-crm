import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Database } from 'better-sqlite3'
import { createTestDb } from '@/lib/localdb/database'
import { executeQuery } from '@/lib/localdb/engine'
import { classify, clientIp, collectVisit, isIgnoredVisit, visitorKey } from '@/lib/visits/collect'
import { signBody, timingSafeEqual, verifyBody } from '@/lib/visits/signature'
import { buildSessions, summarise } from '@/lib/visits/sessions'
import { esc, relativeTime } from '@/lib/visits/report'
import { describeDevice, isWatched } from '@/lib/visits/notify'
import { accessKey, trackingEnabled } from '@/lib/visits/config'
import { VISIT_INSERT_SQL } from '@/lib/visits/store'
import type { Visit } from '@/lib/visits/types'

const ENV_KEYS = [
  'VISIT_TRACKING', 'VISIT_ACCESS_KEY', 'VISIT_IGNORE_IPS', 'VISIT_IGNORE_PATHS',
  'VISIT_WATCH', 'VISIT_WEBHOOK_URL', 'VISIT_SIGNING_SECRET', 'SESSION_SECRET',
]
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// ------------------------------------------------------------- classification

describe('classify', () => {
  it('treats a normal browser agent as human', () => {
    expect(classify(CHROME).kind).toBe('human')
  })

  it('files link-preview fetchers separately from crawlers', () => {
    // The distinction is the point: an unfurl means a person shared the link.
    expect(classify('Slackbot-LinkExpanding 1.0').kind).toBe('preview')
    expect(classify('facebookexternalhit/1.1').kind).toBe('preview')
    expect(classify('Mozilla/5.0 (compatible; Googlebot/2.1)').kind).toBe('bot')
  })

  it('classifies scripted clients and empty agents as bots', () => {
    expect(classify('curl/8.4.0').kind).toBe('bot')
    expect(classify('python-requests/2.31.0').kind).toBe('bot')
    expect(classify('HeadlessChrome/120.0').kind).toBe('bot')
    expect(classify(null).kind).toBe('bot')
    expect(classify('SomeUnknownAgent/1.0').kind).toBe('bot')
  })
})

describe('clientIp', () => {
  it('prefers the platform-set header over client-supplied ones', () => {
    const ip = clientIp(headers({
      'x-vercel-forwarded-for': '9.9.9.9',
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'x-real-ip': '3.3.3.3',
    }))
    expect(ip).toBe('9.9.9.9')
  })

  it('takes the first entry of a forwarded chain', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1')
  })

  it('returns null when no address header is present', () => {
    expect(clientIp(headers({}))).toBeNull()
  })
})

// ------------------------------------------------------------------ collector

describe('collectVisit', () => {
  const url = (path: string) => new URL(`https://example.com${path}`)

  it('captures address, geo and path', async () => {
    const visit = await collectVisit(
      {
        headers: headers({
          'user-agent': CHROME,
          'x-vercel-forwarded-for': '203.0.113.7',
          'x-vercel-ip-city': 'Waltham',
          'x-vercel-ip-country': 'US',
          'x-vercel-ip-country-region': 'MA',
          referer: 'https://mail.google.com/',
        }),
      },
      url('/dashboard?ref=demo')
    )

    expect(visit).not.toBeNull()
    expect(visit!.ip).toBe('203.0.113.7')
    expect(visit!.city).toBe('Waltham')
    expect(visit!.region).toBe('MA')
    expect(visit!.path).toBe('/dashboard')
    expect(visit!.query).toBe('ref=demo')
    expect(visit!.referrer).toBe('https://mail.google.com/')
    expect(visit!.kind).toBe('human')
  })

  it('percent-decodes city names', async () => {
    const visit = await collectVisit(
      { headers: headers({ 'user-agent': CHROME, 'x-vercel-ip-city': 'New%20York' }) },
      url('/')
    )
    expect(visit!.city).toBe('New York')
  })

  it('records a real navigation', async () => {
    const visit = await collectVisit(
      {
        headers: headers({
          'user-agent': CHROME,
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
        }),
      },
      url('/dashboard')
    )
    expect(visit).not.toBeNull()
  })

  it('drops the router traffic a page load fans out', async () => {
    // Measured against a production build: opening /dashboard fires background
    // requests for every other route in the nav. Next.js strips its own
    // next-router-prefetch/rsc headers before middleware, so Fetch Metadata is
    // what distinguishes them — these arrive as dest=empty, mode=cors.
    const visit = await collectVisit(
      {
        headers: headers({
          'user-agent': CHROME,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'next-url': '/dashboard',
          referer: 'https://example.com/dashboard',
        }),
      },
      url('/reports')
    )
    expect(visit).toBeNull()
  })

  it('drops speculation-rules prefetches, which do arrive as documents', async () => {
    expect(
      await collectVisit(
        {
          headers: headers({
            'user-agent': CHROME,
            'sec-fetch-dest': 'document',
            'sec-purpose': 'prefetch;prerender',
          }),
        },
        url('/reports')
      )
    ).toBeNull()
  })

  it('drops subresource requests', async () => {
    for (const dest of ['image', 'style', 'script', 'font']) {
      expect(
        await collectVisit(
          { headers: headers({ 'user-agent': CHROME, 'sec-fetch-dest': dest }) },
          url('/whatever')
        )
      ).toBeNull()
    }
  })

  it('keeps clients that send no Fetch Metadata at all', async () => {
    // Crawlers and link unfurlers never send Sec-Fetch headers, and they are
    // precisely the hits worth recording.
    const visit = await collectVisit(
      { headers: headers({ 'user-agent': 'Slackbot-LinkExpanding 1.0' }) },
      url('/')
    )
    expect(visit).not.toBeNull()
    expect(visit!.kind).toBe('preview')
  })

  it('drops asset and framework paths', async () => {
    for (const path of ['/logo.png', '/_next/data/x.json', '/.well-known/x', '/styles.css']) {
      expect(await collectVisit({ headers: headers({ 'user-agent': CHROME }) }, url(path))).toBeNull()
    }
  })
})

describe('isIgnoredVisit', () => {
  const base = (over: Partial<Visit>): Visit => visit({ at: 'x', visitorKey: 'k', ...over })

  it('drops addresses on the ignore list', () => {
    process.env.VISIT_IGNORE_IPS = '203.0.113.7, 198.51.100.1'
    expect(isIgnoredVisit(base({ ip: '203.0.113.7' }))).toBe(true)
    expect(isIgnoredVisit(base({ ip: '8.8.8.8' }))).toBe(false)
  })

  it('honours path prefixes', () => {
    process.env.VISIT_IGNORE_PATHS = '/health'
    expect(isIgnoredVisit(base({ path: '/health/live' }))).toBe(true)
    expect(isIgnoredVisit(base({ path: '/dashboard' }))).toBe(false)
  })

  it('ignores nothing by default', () => {
    expect(isIgnoredVisit(base({ ip: '203.0.113.7', path: '/dashboard' }))).toBe(false)
  })

  it('gives the same visitor key to the same address and agent', async () => {
    const a = await visitorKey('203.0.113.7', CHROME)
    const b = await visitorKey('203.0.113.7', CHROME)
    const c = await visitorKey('203.0.113.8', CHROME)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

// ------------------------------------------------------------------ signature

describe('beacon signature', () => {
  it('accepts a body it signed', async () => {
    const body = JSON.stringify({ path: '/' })
    expect(await verifyBody(body, await signBody(body))).toBe(true)
  })

  it('rejects a tampered body', async () => {
    const sig = await signBody(JSON.stringify({ path: '/' }))
    expect(await verifyBody(JSON.stringify({ path: '/admin' }), sig)).toBe(false)
  })

  it('rejects a missing or malformed header', async () => {
    expect(await verifyBody('{}', null)).toBe(false)
    expect(await verifyBody('{}', 'garbage')).toBe(false)
    expect(await verifyBody('{}', 't=abc,v=ff')).toBe(false)
  })

  it('rejects a replayed signature once it is stale', async () => {
    const body = '{}'
    const signedAt = Date.now()
    const sig = await signBody(body, signedAt)
    expect(await verifyBody(body, sig, signedAt + 60_000)).toBe(true)
    expect(await verifyBody(body, sig, signedAt + 10 * 60_000)).toBe(false)
  })

  it('rejects a signature minted under a different secret', async () => {
    process.env.VISIT_SIGNING_SECRET = 'secret-one-secret-one'
    const sig = await signBody('{}')
    process.env.VISIT_SIGNING_SECRET = 'secret-two-secret-two'
    expect(await verifyBody('{}', sig)).toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('compares without leaking length mismatches as equality', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true)
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false)
    expect(timingSafeEqual('abc', 'abcdef')).toBe(false)
  })
})

// -------------------------------------------------------------------- config

describe('config', () => {
  it('tracks by default and honours the off switch', () => {
    expect(trackingEnabled()).toBe(true)
    for (const off of ['0', 'false', 'off', 'no']) {
      process.env.VISIT_TRACKING = off
      expect(trackingEnabled()).toBe(false)
    }
  })

  it('refuses a report key short enough to guess', () => {
    process.env.VISIT_ACCESS_KEY = 'short'
    expect(accessKey()).toBeNull()
    process.env.VISIT_ACCESS_KEY = 'a-sufficiently-long-key'
    expect(accessKey()).toBe('a-sufficiently-long-key')
  })
})

// ------------------------------------------------------------------ sessions

let seq = 0
function visit(partial: Partial<Visit> & { at: string; visitorKey: string }): Visit {
  return {
    id: `v${seq++}`,
    ip: '203.0.113.7',
    host: 'example.com',
    path: '/',
    query: null,
    referrer: null,
    userAgent: CHROME,
    country: 'US',
    region: 'MA',
    city: 'Waltham',
    timezone: 'America/New_York',
    network: null,
    kind: 'human',
    kindReason: null,
    env: 'production',
    ...partial,
  }
}

describe('buildSessions', () => {
  it('collapses a burst of hits into one session with its pages in order', () => {
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a', path: '/' }),
      visit({ at: '2026-08-01T10:01:00.000Z', visitorKey: 'a', path: '/dashboard' }),
      visit({ at: '2026-08-01T10:02:00.000Z', visitorKey: 'a', path: '/dashboard' }),
      visit({ at: '2026-08-01T10:03:00.000Z', visitorKey: 'a', path: '/reports' }),
    ])

    expect(sessions).toHaveLength(1)
    expect(sessions[0].hits).toBe(4)
    expect(sessions[0].paths).toEqual(['/', '/dashboard', '/reports'])
    expect(sessions[0].firstAt).toBe('2026-08-01T10:00:00.000Z')
    expect(sessions[0].lastAt).toBe('2026-08-01T10:03:00.000Z')
  })

  it('splits one visitor into separate sessions across a long gap', () => {
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a' }),
      visit({ at: '2026-08-01T14:00:00.000Z', visitorKey: 'a' }),
    ])
    expect(sessions).toHaveLength(2)
  })

  it('keeps different visitors apart and returns newest first', () => {
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a' }),
      visit({ at: '2026-08-01T11:00:00.000Z', visitorKey: 'b' }),
    ])
    expect(sessions).toHaveLength(2)
    expect(sessions[0].visitorKey).toBe('b')
  })

  it('rates a session by its most human hit', () => {
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a', kind: 'bot' }),
      visit({ at: '2026-08-01T10:01:00.000Z', visitorKey: 'a', kind: 'human' }),
    ])
    expect(sessions[0].kind).toBe('human')
  })

  it('reports the referrer that brought them in, ignoring our own pages', () => {
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a', referrer: 'https://example.com/x' }),
      visit({ at: '2026-08-01T10:01:00.000Z', visitorKey: 'a', referrer: 'https://mail.google.com/' }),
    ])
    expect(sessions[0].referrer).toBe('https://mail.google.com/')
  })
})

describe('summarise', () => {
  it('counts humans, unfurls and unique addresses separately', () => {
    const now = Date.parse('2026-08-01T12:00:00.000Z')
    const sessions = buildSessions([
      visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'a', ip: '1.1.1.1' }),
      visit({ at: '2026-08-01T11:00:00.000Z', visitorKey: 'b', ip: '2.2.2.2' }),
      visit({ at: '2026-08-01T11:30:00.000Z', visitorKey: 'c', ip: '3.3.3.3', kind: 'preview' }),
      visit({ at: '2026-08-01T11:40:00.000Z', visitorKey: 'd', ip: '4.4.4.4', kind: 'bot' }),
      visit({ at: '2026-06-01T09:00:00.000Z', visitorKey: 'e', ip: '5.5.5.5' }),
    ])
    const s = summarise(sessions, now)

    expect(s.humanSessions).toBe(3)
    expect(s.humanSessions7d).toBe(2)
    expect(s.previewSessions).toBe(1)
    expect(s.botSessions).toBe(1)
    expect(s.uniqueHumanIps).toBe(3)
    expect(s.lastHumanAt).toBe('2026-08-01T11:00:00.000Z')
  })
})

describe('watch terms', () => {
  it('flags a visitor whose network matches a watch term', () => {
    process.env.VISIT_WATCH = 'gallagher,waltham'
    expect(isWatched(visit({ at: 'x', visitorKey: 'a', network: 'AS1234 TG Gallagher Inc' }))).toBe(true)
    expect(isWatched(visit({ at: 'x', visitorKey: 'a', city: 'Waltham', network: null }))).toBe(true)
    expect(isWatched(visit({ at: 'x', visitorKey: 'a', city: 'Denver', network: 'AS7 Comcast' }))).toBe(false)
  })

  it('flags nothing when no terms are configured', () => {
    expect(isWatched(visit({ at: 'x', visitorKey: 'a', network: 'AS1234 TG Gallagher Inc' }))).toBe(false)
  })
})

// -------------------------------------------------------------------- report

describe('report rendering', () => {
  it('escapes visitor-controlled values', () => {
    // Referrer and user-agent are chosen by the caller, so the report is an
    // injection sink if they are interpolated raw.
    expect(esc('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(esc('" onload="x')).toBe('&quot; onload=&quot;x')
  })

  it('renders relative times', () => {
    const now = Date.parse('2026-08-01T12:00:00.000Z')
    expect(relativeTime('2026-08-01T11:59:50.000Z', now)).toBe('just now')
    expect(relativeTime('2026-08-01T11:30:00.000Z', now)).toBe('30m ago')
    expect(relativeTime('2026-08-01T09:00:00.000Z', now)).toBe('3h ago')
    expect(relativeTime('2026-07-30T12:00:00.000Z', now)).toBe('2d ago')
  })

  it('summarises a client from its user-agent', () => {
    expect(describeDevice(CHROME)).toBe('Chrome on Mac')
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1')).toBe(
      'Safari on iPhone'
    )
    expect(describeDevice(null)).toBe('unknown client')
  })
})

// ------------------------------------------------------------------- storage

describe('site_visits table', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  it('accepts a visit row', () => {
    db.prepare(
      `INSERT INTO site_visits (id, at, visitor_key, ip, path, kind)
       VALUES ('v1', '2026-08-01T10:00:00.000Z', 'abc', '203.0.113.7', '/dashboard', 'human')`
    ).run()
    const row = db.prepare('SELECT * FROM site_visits WHERE id = ?').get('v1') as { ip: string }
    expect(row.ip).toBe('203.0.113.7')
  })

  it('binds every field of a Visit through the recorder statement', () => {
    // better-sqlite3 matches named parameters against the bound object exactly,
    // so this fails loudly if a Visit field and its column drift apart.
    const v = visit({ at: '2026-08-01T10:00:00.000Z', visitorKey: 'abc', path: '/reports' })
    db.prepare(VISIT_INSERT_SQL).run(v)

    const row = db.prepare('SELECT * FROM site_visits WHERE id = ?').get(v.id) as {
      visitor_key: string
      user_agent: string
      path: string
      city: string
    }
    expect(row.visitor_key).toBe('abc')
    expect(row.user_agent).toBe(CHROME)
    expect(row.path).toBe('/reports')
    expect(row.city).toBe('Waltham')
  })

  it('constrains kind to the known classes', () => {
    expect(() =>
      db.prepare(
        `INSERT INTO site_visits (id, at, visitor_key, path, kind)
         VALUES ('v2', '2026-08-01T10:00:00.000Z', 'abc', '/', 'nonsense')`
      ).run()
    ).toThrow()
  })

  it('is not reachable through the browser-facing query engine', () => {
    // Demo mode signs every visitor in as the demo user, so anything in
    // ALLOWED_TABLES is readable by the people this table records.
    const result = executeQuery(
      db,
      { table: 'site_visits', action: 'select', filters: [] },
      { userId: 'u-a', orgId: 'org-A' }
    )
    expect(result.data).toBeNull()
    expect(result.error?.message).toMatch(/not accessible/)
  })
})
