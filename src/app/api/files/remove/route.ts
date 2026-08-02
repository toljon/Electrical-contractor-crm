import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { z } from 'zod'
import { getDb, UPLOADS_DIR } from '@/lib/localdb/database'
import { getEngineContext } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

const bodySchema = z.object({
  paths: z.array(z.string()),
})

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'paths must be an array of strings' }, { status: 400 })
  }
  const { paths } = parsed.data

  const { orgId } = getEngineContext(userId)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const ownsPath = getDb().prepare('SELECT 1 FROM photos WHERE storage_path = ? AND org_id = ?')
  for (const p of paths) {
    // only delete files that belong to a photo row in the caller's org
    if (!ownsPath.get(p, orgId)) continue
    const resolved = path.resolve(UPLOADS_DIR, p)
    if (!resolved.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) continue
    await fs.rm(resolved, { force: true }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
