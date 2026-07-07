import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA } from './schema'


export const DATA_DIR = process.env.TGG_DATA_DIR ?? path.join(process.cwd(), 'data')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

// Singleton across Next.js dev HMR reloads
const globalForDb = globalThis as unknown as { __tggDb?: Database.Database }

export function getDb(): Database.Database {
  if (globalForDb.__tggDb) return globalForDb.__tggDb
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  const db = new Database(path.join(DATA_DIR, 'tgg-ops.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  globalForDb.__tggDb = db
  return db
}

/** Test-only: create an isolated in-memory database with the full schema. */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}
