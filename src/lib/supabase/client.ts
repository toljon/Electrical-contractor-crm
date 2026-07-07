// Browser-side data client. Drop-in replacement for the previous Supabase
// browser client — same call surface (`from`, `auth`, `storage`). Queries
// are executed server-side via /api/db (which enforces auth + org scoping);
// auth goes through /api/auth/*; files through /api/files/*.
import { QueryBuilder } from '@/lib/localdb/builder'
import type { QueryDescriptor, QueryResult } from '@/lib/localdb/engine'

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const executor = async (q: QueryDescriptor): Promise<QueryResult> => {
  try {
    const res = await postJson('/api/db', q)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      return {
        data: null,
        error: { message: json?.error ?? `Request failed (${res.status})` },
        count: null,
      }
    }
    return (await res.json()) as QueryResult
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Network error' },
      count: null,
    }
  }
}

export function createClient() {
  return {
    from(table: string) {
      return new QueryBuilder(executor, table)
    },

    auth: {
      async getUser() {
        const res = await fetch('/api/auth/user')
        if (!res.ok) return { data: { user: null }, error: null }
        const json = await res.json()
        return { data: { user: json.user ?? null }, error: null }
      },

      async signUp(params: {
        email: string
        password: string
        options?: { data?: { full_name?: string } }
      }) {
        const res = await postJson('/api/auth/signup', {
          email: params.email,
          password: params.password,
          full_name: params.options?.data?.full_name ?? null,
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return { data: { user: null }, error: new Error(json.error ?? 'Sign up failed') }
        return { data: { user: json.user }, error: null }
      },

      async signInWithPassword(params: { email: string; password: string }) {
        const res = await postJson('/api/auth/login', params)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return { data: { user: null }, error: new Error(json.error ?? 'Sign in failed') }
        return { data: { user: json.user }, error: null }
      },

      async signOut() {
        await postJson('/api/auth/logout', {})
        return { error: null }
      },
    },

    storage: {
      from(_bucket: string) {
        return {
          getPublicUrl(storagePath: string) {
            return { data: { publicUrl: `/api/files/${storagePath}` } }
          },
          async remove(paths: string[]) {
            await postJson('/api/files/remove', { paths })
            return { data: paths.map((p) => ({ name: p })), error: null }
          },
        }
      },
    },
  }
}
