import { NextRequest, NextResponse } from 'next/server'
import { createUser, findUserByEmail, toAuthUser } from '@/lib/localdb/auth'
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/localdb/session'

export async function POST(request: NextRequest) {
  const { email, password, full_name } = await request.json().catch(() => ({}))

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  // full_name reaches a SQLite bind, which rejects anything but a primitive.
  const fullName = typeof full_name === 'string' ? full_name.trim().slice(0, 200) || null : null

  const user = createUser(email, password, fullName)
  const response = NextResponse.json({ user: toAuthUser(user) })
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), SESSION_COOKIE_OPTIONS)
  return response
}
