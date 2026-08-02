import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { getDb, UPLOADS_DIR } from '@/lib/localdb/database'
import { getEngineContext } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { path: segments } = await params
  const resolved = path.resolve(UPLOADS_DIR, ...segments)
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { orgId } = getEngineContext(userId)
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  // photos.storage_path is stored slash-joined and relative to UPLOADS_DIR
  const owned = getDb()
    .prepare('SELECT 1 FROM photos WHERE storage_path = ? AND org_id = ?')
    .get(segments.join('/'), orgId)
  if (!owned) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  try {
    const file = await fs.readFile(resolved)
    const contentType = MIME[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream'
    return new NextResponse(new Uint8Array(file), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
