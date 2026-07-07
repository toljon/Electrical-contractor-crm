import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { getDb } from './database'
import type { EngineContext } from './engine'

export interface LocalUser {
  id: string
  email: string
  full_name: string | null
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function createUser(email: string, password: string, fullName: string | null): LocalUser {
  const db = getDb()
  const id = randomUUID()
  const insert = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
      id,
      email.toLowerCase(),
      hashPassword(password),
      fullName
    )
    // mirror of the Supabase handle_new_user trigger
    db.prepare('INSERT INTO profiles (id, full_name) VALUES (?, ?)').run(id, fullName)
  })
  insert()
  return { id, email: email.toLowerCase(), full_name: fullName }
}

export function findUserByEmail(email: string): (LocalUser & { password_hash: string }) | null {
  const row = getDb()
    .prepare('SELECT id, email, full_name, password_hash FROM users WHERE email = ?')
    .get(email.toLowerCase()) as (LocalUser & { password_hash: string }) | undefined
  return row ?? null
}

export function getUserById(id: string): LocalUser | null {
  const row = getDb()
    .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
    .get(id) as LocalUser | undefined
  return row ?? null
}

/** Resolve the engine context (user + org) for a verified user id. */
export function getEngineContext(userId: string): EngineContext {
  const profile = getDb()
    .prepare('SELECT org_id FROM profiles WHERE id = ?')
    .get(userId) as { org_id: string | null } | undefined
  return { userId, orgId: profile?.org_id ?? null }
}

/** Supabase-shaped auth user object. */
export function toAuthUser(user: LocalUser) {
  return {
    id: user.id,
    email: user.email,
    user_metadata: { full_name: user.full_name },
  }
}
