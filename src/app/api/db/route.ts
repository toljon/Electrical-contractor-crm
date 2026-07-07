import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/localdb/database'
import { executeQuery, type QueryDescriptor } from '@/lib/localdb/engine'
import { getEngineContext } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const q = (await request.json().catch(() => null)) as QueryDescriptor | null
  if (!q || typeof q.table !== 'string' || !Array.isArray(q.filters)) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  const result = executeQuery(getDb(), q, getEngineContext(userId))
  return NextResponse.json(result)
}
