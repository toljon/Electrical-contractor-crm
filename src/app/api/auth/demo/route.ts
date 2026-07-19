import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/localdb/database'
import { seedDemo } from '@/lib/localdb/seed'
import { findUserByEmail } from '@/lib/localdb/auth'
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/localdb/session'
import { DEMO_LOGIN, demoMode } from '@/lib/demo'

// Demo-mode sign-in: mints a session for the seeded demo user and redirects
// into the app. The middleware sends unauthenticated visitors here instead of
// /login while demo mode is on.
export async function GET(request: NextRequest) {
  if (!demoMode()) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const db = getDb()
  let user = findUserByEmail(DEMO_LOGIN)
  if (!user) {
    try {
      seedDemo(db)
    } catch {
      // non-empty database without the demo user (e.g. real signups only) —
      // fall through to the error below rather than corrupt existing data
    }
    user = findUserByEmail(DEMO_LOGIN)
  }
  if (!user) {
    return new NextResponse(
      'Demo user unavailable. Run `npm run seed` (or set TGG_DEMO_MODE=0 to use the login screen).',
      { status: 500 }
    )
  }

  const next = request.nextUrl.searchParams.get('next')
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  const response = NextResponse.redirect(new URL(target, request.url))
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), SESSION_COOKIE_OPTIONS)
  return response
}
