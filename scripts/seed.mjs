// TGG Ops demo seed — realistic TG Gallagher world for demos.
// Usage: npm run seed        (wipes and recreates data/tgg-ops.db)
// Login: demo@tggallagher.com / gallagher
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { SCHEMA } from '../src/lib/localdb/schema.js'
import { seedDemo } from '../src/lib/localdb/seed.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = process.env.TGG_DATA_DIR ?? path.join(ROOT, 'data')
const DB_PATH = path.join(DATA_DIR, 'tgg-ops.db')

fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true })
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_PATH + suffix, { force: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(SCHEMA)

const { login, password } = seedDemo(db)

const counts = {}
for (const t of ['customers', 'locations', 'equipment', 'work_orders', 'inspection_reports', 'test_readings', 'findings', 'projects', 'prefab_assemblies']) {
  counts[t] = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c
}
console.log('Seeded TGG Ops demo database:')
console.table(counts)
console.log(`\nLogin: ${login} / ${password}`)
