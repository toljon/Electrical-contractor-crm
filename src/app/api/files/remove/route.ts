import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { getDb, UPLOADS_DIR } from '@/lib/localdb/database'
import { getEngineContext } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { paths } = await request.json().catch(() => ({ paths: [] }))
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: 'paths must be an array' }, { status: 400 })
  }

  const { orgId } = getEngineContext(userId)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const ownsPath = getDb().prepare('SELECT 1 FROM photos WHERE storage_path = ? AND org_id = ?')
  for (const p of paths) {
    if (typeof p !== 'string') continue
    // only delete files that belong to a photo row in the caller's org
    if (!ownsPath.get(p, orgId)) continue
    const resolved = path.resolve(UPLOADS_DIR, p)
    if (!resolved.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) continue
    await fs.rm(resolved, { force: true }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
