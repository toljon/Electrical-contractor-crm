import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

// Session-cookie auth guard. Runs on the edge runtime, so it only verifies
// the signed cookie — the org-membership check (→ /onboarding) lives in the
// (dashboard) layout, which has database access.
export async function middleware(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  const path = request.nextUrl.pathname

  // Public routes
  if (path.startsWith('/login') || path.startsWith('/onboarding')) {
    if (userId && path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Unauthenticated → login
  if (!userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
