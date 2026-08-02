import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, toAuthUser, verifyPassword } from '@/lib/localdb/auth'
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/localdb/session'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({}))

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const response = NextResponse.json({ user: toAuthUser(user) })
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), SESSION_COOKIE_OPTIONS)
  return response
}
