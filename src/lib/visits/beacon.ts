// Middleware-side dispatch.
//
// Middleware runs on the edge runtime and cannot open the SQLite database, so
// it hands the record to /api/events (Node) instead. That hop is the whole reason
// this file exists.
//
// Everything happens inside `after()`, i.e. once the response has already been
// sent — the visitor never waits on it, and because the capture is entirely
// server-side there is no beacon script, no tracking pixel, no extra cookie and
// nothing in the browser's network tab.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { collectVisit } from './collect'
import { trackingEnabled } from './config'
import { visitLogLine } from './notify'
import { SIGNATURE_HEADER, signBody } from './signature'

async function dispatch(headers: Headers, url: URL, origin: string): Promise<void> {
  let visit
  try {
    visit = await collectVisit({ headers }, url)
    if (!visit) return

    const body = JSON.stringify(visit)
    const beaconHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      [SIGNATURE_HEADER]: await signBody(body),
    }

    // Deployment Protection sits in front of the whole deployment, including
    // this internal hop, and answers the middleware's own fetch with a 401 —
    // observed on a protected preview deployment. Vercel's documented way
    // through is the bypass secret, which is present once "Protection Bypass
    // for Automation" is enabled for the project.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass) beaconHeaders['x-vercel-protection-bypass'] = bypass

    const response = await fetch(new URL('/api/events', origin), {
      method: 'POST',
      headers: beaconHeaders,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return

    if (response.status === 401 || response.status === 403) {
      console.warn(
        `[visits] recorder blocked with ${response.status} — Deployment Protection is in front of /api/events. ` +
          'Enable Protection Bypass for Automation, or configure the Redis store so the log does not depend on this hop.'
      )
    } else {
      console.warn('[visits] recorder returned', response.status)
    }
  } catch (err) {
    console.warn('[visits] dispatch failed:', (err as Error).message)
  }

  // Whatever went wrong above, the visit still reaches the runtime log rather
  // than being dropped on the floor.
  if (visit) console.log(visitLogLine(visit))
}

/**
 * Queues a visit record for the current request. Returns immediately and never
 * throws — tracking must not be able to break page delivery.
 */
export function trackVisit(request: NextRequest): void {
  if (!trackingEnabled()) return

  try {
    // Snapshot both synchronously: the request object is not guaranteed to be
    // usable from inside the after() callback.
    const headers = new Headers(request.headers)
    const url = new URL(request.nextUrl.toString())
    const origin = request.nextUrl.origin

    after(() => dispatch(headers, url, origin))
  } catch (err) {
    console.warn('[visits] could not schedule:', (err as Error).message)
  }
}
