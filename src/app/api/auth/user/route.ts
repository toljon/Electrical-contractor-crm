import { NextRequest, NextResponse } from 'next/server'
import { getUserById, toAuthUser } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

export async function GET(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  const user = userId ? getUserById(userId) : null
  return NextResponse.json({ user: user ? toAuthUser(user) : null })
}
