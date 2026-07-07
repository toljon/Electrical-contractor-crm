// Server-side data client. Drop-in replacement for the previous Supabase
// server client — same call surface (`from`, `auth`, `storage`), backed by
// the local SQLite database instead of hosted Supabase.
import { cookies } from 'next/headers'
import path from 'path'
import fs from 'fs/promises'
import { getDb, UPLOADS_DIR } from '@/lib/localdb/database'
import { executeQuery, type QueryDescriptor, type QueryResult } from '@/lib/localdb/engine'
import { QueryBuilder } from '@/lib/localdb/builder'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'
import { getEngineContext, getUserById, toAuthUser } from '@/lib/localdb/auth'

function safeUploadPath(storagePath: string): string {
  const resolved = path.resolve(UPLOADS_DIR, storagePath)
  if (!resolved.startsWith(path.resolve(UPLOADS_DIR))) {
    throw new Error('Invalid storage path')
  }
  return resolved
}

export async function createClient() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const userId = await verifySessionToken(token)

  const executor = async (q: QueryDescriptor): Promise<QueryResult> => {
    if (!userId) return { data: null, error: { message: 'Not authenticated' }, count: null }
    return executeQuery(getDb(), q, getEngineContext(userId))
  }

  return {
    from(table: string) {
      return new QueryBuilder(executor, table)
    },

    auth: {
      async getUser() {
        const user = userId ? getUserById(userId) : null
        return { data: { user: user ? toAuthUser(user) : null }, error: null }
      },
    },

    storage: {
      from(_bucket: string) {
        return {
          async upload(storagePath: string, file: File, _options?: { upsert?: boolean }) {
            try {
              const dest = safeUploadPath(storagePath)
              await fs.mkdir(path.dirname(dest), { recursive: true })
              await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()))
              return { data: { path: storagePath }, error: null }
            } catch (err) {
              return {
                data: null,
                error: { message: err instanceof Error ? err.message : 'Upload failed' },
              }
            }
          },
          getPublicUrl(storagePath: string) {
            return { data: { publicUrl: `/api/files/${storagePath}` } }
          },
          async createSignedUrl(storagePath: string, _expiresIn: number) {
            return { data: { signedUrl: `/api/files/${storagePath}` }, error: null }
          },
          async remove(paths: string[]) {
            for (const p of paths) {
              await fs.rm(safeUploadPath(p), { force: true }).catch(() => {})
            }
            return { data: paths.map((p) => ({ name: p })), error: null }
          },
        }
      },
    },
  }
}
