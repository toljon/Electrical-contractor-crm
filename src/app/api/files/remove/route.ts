import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { UPLOADS_DIR } from '@/lib/localdb/database'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { paths } = await request.json().catch(() => ({ paths: [] }))
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: 'paths must be an array' }, { status: 400 })
  }

  for (const p of paths) {
    if (typeof p !== 'string') continue
    const resolved = path.resolve(UPLOADS_DIR, p)
    if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) continue
    await fs.rm(resolved, { force: true }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
