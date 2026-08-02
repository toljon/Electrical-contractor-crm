import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'
import { demoMode } from '@/lib/demo'

// Session-cookie auth guard. Runs on the edge runtime, so it only verifies
// the signed cookie — the org-membership check (→ /onboarding) lives in the
// (dashboard) layout, which has database access.
export async function middleware(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  const path = request.nextUrl.pathname

  // Demo mode: no login screen — unauthenticated visitors get signed in as
  // the demo user by /api/auth/demo (a Node route with database access).
  const demoSignIn = (next: string) => {
    const url = new URL('/api/auth/demo', request.url)
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/login')) {
    // The dashboard sends holders of a signed-but-unknown session here (their
    // user row is gone). The cookie has to be cleared on the way in, or this
    // and the dashboard redirect to each other until the browser gives up.
    if (request.nextUrl.searchParams.get('expired') === '1') {
      if (demoMode()) return demoSignIn('/dashboard')
      const response = NextResponse.next()
      response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
      return response
    }
    if (userId) return NextResponse.redirect(new URL('/dashboard', request.url))
    if (demoMode()) return demoSignIn('/dashboard')
    return NextResponse.next()
  }

  // Unauthenticated → demo sign-in or login. /onboarding is included: it
  // creates an organization, so it needs a session like any other page.
  if (!userId) {
    if (demoMode()) return demoSignIn(path === '/' ? '/dashboard' : path)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
