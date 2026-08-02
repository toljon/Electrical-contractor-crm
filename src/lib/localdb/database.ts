import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA } from './schema'
import { seedDemo } from './seed'
import { demoMode } from '@/lib/demo'

// Prefer ./data; fall back to /tmp when the working directory is read-only
// (serverless platforms). /tmp storage is per-instance and ephemeral there —
// acceptable for demo deployments, not for production data.
function resolveDataDir(): string {
  const preferred = process.env.TGG_DATA_DIR ?? path.join(process.cwd(), 'data')
  try {
    fs.mkdirSync(preferred, { recursive: true })
    fs.accessSync(preferred, fs.constants.W_OK)
    return preferred
  } catch {
    const fallback = path.join('/tmp', 'tgg-data')
    fs.mkdirSync(fallback, { recursive: true })
    return fallback
  }
}

export const DATA_DIR = resolveDataDir()
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// Singleton across Next.js dev HMR reloads
const globalForDb = globalThis as unknown as { __tggDb?: Database.Database }

export function getDb(): Database.Database {
  if (globalForDb.__tggDb) return globalForDb.__tggDb
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  const db = new Database(path.join(DATA_DIR, 'tgg-ops.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  // Without this, a second writer (the seed script, another worker) fails
  // immediately with SQLITE_BUSY rather than waiting its turn.
  db.pragma('busy_timeout = 5000')
  db.exec(SCHEMA)
  // Demo mode: a brand-new database auto-seeds the deterministic TGG demo
  // dataset (fixed IDs, so independently seeded serverless replicas agree).
  // Deliberately NOT keyed on VERCEL: a real deployment that turns demo mode
  // off must not get accounts whose shared password is published in the README.
  if (demoMode() || process.env.TGG_DEMO_SEED === '1') {
    const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
    if (c === 0) seedDemo(db)
  }
  globalForDb.__tggDb = db
  return db
}

/** Test-only: create an isolated in-memory database with the full schema. */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.exec(SCHEMA)
  return db
}
