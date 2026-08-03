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
import { SIGNATURE_HEADER, signBody } from './signature'

async function dispatch(headers: Headers, url: URL, origin: string): Promise<void> {
  try {
    const visit = await collectVisit({ headers }, url)
    if (!visit) return

    const body = JSON.stringify(visit)
    const response = await fetch(new URL('/api/events', origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SIGNATURE_HEADER]: await signBody(body),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      // Last resort: the runtime log still captures the visit even when the
      // recorder is unreachable, so nothing is silently dropped.
      console.warn('[visits] recorder returned', response.status, body)
    }
  } catch (err) {
    console.warn('[visits] dispatch failed:', (err as Error).message)
  }
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
