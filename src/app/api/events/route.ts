// Visit recorder and report.
//
// POST — internal only. Middleware cannot reach SQLite from the edge runtime,
//        so it signs a record and posts it here. The HMAC is what stops anyone
//        who finds this path from writing fabricated visits into the log.
// GET  — the report, gated on VISIT_ACCESS_KEY. Deliberately *not* gated on a
//        session: demo mode signs every visitor in as the demo user, so a
//        session check would let the people being recorded read the recording.
//
// Under /api, which the middleware matcher excludes — so serving this route
// never records a visit of its own.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { accessKey, accessKeyTooShort, trackingEnabled } from '@/lib/visits/config'
import { isIgnoredVisit } from '@/lib/visits/collect'
import { SIGNATURE_HEADER, timingSafeEqual, verifyBody } from '@/lib/visits/signature'
import { lookupNetwork } from '@/lib/visits/enrich'
import { notifyVisit, visitLogLine } from '@/lib/visits/notify'
import { buildSessions, summarise } from '@/lib/visits/sessions'
import { renderReport } from '@/lib/visits/report'
import { isNewSession, readVisits, recordVisit } from '@/lib/visits/store'
import type { Visit } from '@/lib/visits/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const nullableText = z.string().max(2000).nullable()

const visitSchema = z.object({
  id: z.string().min(1).max(64),
  at: z.string().min(1).max(40),
  visitorKey: z.string().min(1).max(64),
  ip: z.string().max(64).nullable(),
  host: z.string().max(255).nullable(),
  path: z.string().max(2000),
  query: nullableText,
  referrer: nullableText,
  userAgent: nullableText,
  country: z.string().max(8).nullable(),
  region: z.string().max(64).nullable(),
  city: z.string().max(128).nullable(),
  timezone: z.string().max(64).nullable(),
  network: nullableText,
  kind: z.enum(['human', 'preview', 'bot']),
  kindReason: z.string().max(128).nullable(),
  env: z.string().max(32).nullable(),
})

/** An unauthenticated caller learns only that nothing lives here. */
function notFound(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  if (!trackingEnabled()) return notFound()

  const body = await request.text()
  if (!(await verifyBody(body, request.headers.get(SIGNATURE_HEADER)))) {
    return notFound()
  }

  const parsed = visitSchema.safeParse(JSON.parse(body || 'null'))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid record' }, { status: 400 })
  }

  const visit: Visit = { ...parsed.data, network: parsed.data.network ?? null }

  // Checked here rather than at the edge so VISIT_IGNORE_IPS / VISIT_IGNORE_PATHS
  // take effect without a redeploy.
  if (isIgnoredVisit(visit)) {
    return NextResponse.json({ ok: true, ignored: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Asked before the record is written, or the visit we are about to insert
  // would itself count as prior activity and every session would look old.
  const fresh = await isNewSession(visit.visitorKey)
  visit.network = visit.network ?? (await lookupNetwork(visit.ip))

  // Structured line so the visit survives in Vercel's runtime logs even if
  // both stores are unavailable.
  console.log(visitLogLine(visit))

  await recordVisit(visit)
  if (fresh) await notifyVisit(visit)

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: NextRequest) {
  const expected = accessKey()
  if (!expected) {
    if (accessKeyTooShort()) {
      console.warn('[visits] VISIT_ACCESS_KEY is set but shorter than 16 characters — report disabled')
    }
    return notFound()
  }

  const provided = request.nextUrl.searchParams.get('k')
  if (!provided || !timingSafeEqual(provided, expected)) return notFound()

  const visits = await readVisits()
  const sessions = buildSessions(visits)
  const summary = summarise(sessions)

  const headers = {
    'Cache-Control': 'no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
  }

  if (request.nextUrl.searchParams.get('format') === 'json') {
    return NextResponse.json({ summary, sessions, visits }, { headers })
  }

  return new NextResponse(renderReport(sessions, summary), {
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
