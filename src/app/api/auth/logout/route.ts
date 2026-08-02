import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/localdb/session'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  // Attributes must match the cookie that was set, or the browser keeps it.
  response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return response
}
