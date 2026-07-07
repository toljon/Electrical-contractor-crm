import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

// Executes Supabase/PostgREST-style query descriptors against SQLite,
// enforcing the org scoping that RLS provided on hosted Supabase.

export interface QueryFilter {
  method: 'eq' | 'in' | 'gte' | 'lte' | 'neq' | 'not'
  column: string
  value: unknown
  // for `not`: the negated operator, e.g. 'in'
  operator?: string
}

export interface QueryDescriptor {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  select?: string
  count?: 'exact'
  head?: boolean
  values?: Record<string, unknown>
  filters: QueryFilter[]
  order?: { column: string; ascending: boolean }[]
  limit?: number
  single?: boolean
  // return inserted/updated rows (a trailing .select() on a write)
  returning?: boolean
}

export interface QueryResult {
  data: unknown
  error: { message: string; code?: string } | null
  count: number | null
}

export interface EngineContext {
  userId: string
  orgId: string | null
}

// Row = record from SQLite
type Row = Record<string, unknown>

const ORG_SCOPED = new Set([
  'customers', 'contacts', 'locations', 'equipment', 'contracts',
  'work_orders', 'projects', 'prefab_assemblies', 'inspection_reports',
  'test_readings', 'findings', 'photos',
])

const ALLOWED_TABLES = new Set([...ORG_SCOPED, 'organizations', 'profiles'])

const JSON_COLUMNS: Record<string, string[]> = {
  projects: ['trades'],
  profiles: ['certifications'],
}

const BOOLEAN_COLUMNS: Record<string, string[]> = {
  customers: ['tax_exempt'],
  contacts: ['is_primary'],
  contracts: ['auto_renew'],
  work_orders: ['report_generated', 'report_sent'],
}

// Many-to-one: FK column on the base table pointing at the embed table
const MANY_TO_ONE: Record<string, Record<string, string>> = {
  work_orders: {
    customers: 'customer_id', locations: 'location_id', profiles: 'assigned_to',
    contracts: 'contract_id', projects: 'project_id',
  },
  inspection_reports: {
    customers: 'customer_id', locations: 'location_id',
    work_orders: 'work_order_id', profiles: 'technician_id',
  },
  locations: { customers: 'customer_id' },
  contacts: { customers: 'customer_id' },
  equipment: { customers: 'customer_id', locations: 'location_id' },
  contracts: { customers: 'customer_id' },
  prefab_assemblies: { projects: 'project_id' },
  test_readings: { inspection_reports: 'report_id', equipment: 'equipment_id' },
  findings: { inspection_reports: 'report_id', equipment: 'equipment_id' },
  photos: { inspection_reports: 'report_id', findings: 'finding_id', equipment: 'equipment_id' },
  profiles: { organizations: 'org_id' },
}

// One-to-many: FK column on the embed (child) table pointing back at the base
const ONE_TO_MANY: Record<string, Record<string, string>> = {
  customers: {
    locations: 'customer_id', work_orders: 'customer_id',
    equipment: 'customer_id', contacts: 'customer_id', contracts: 'customer_id',
  },
  locations: { equipment: 'location_id', work_orders: 'location_id' },
  work_orders: { inspection_reports: 'work_order_id' },
  inspection_reports: { test_readings: 'report_id', findings: 'report_id', photos: 'report_id' },
  projects: { prefab_assemblies: 'project_id', work_orders: 'project_id' },
  findings: { photos: 'finding_id' },
}

interface Embed {
  alias: string
  table: string
  fkHint: string | null
  inner: string
}

/** Split a select string on top-level commas (ignoring commas inside parens). */
function splitTopLevel(select: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of select) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function parseSelect(select: string): { embeds: Embed[] } {
  const embeds: Embed[] = []
  for (const part of splitTopLevel(select)) {
    const m = part.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?\(([\s\S]*)\)$/)
    if (m) {
      embeds.push({ alias: m[1] ?? m[2], table: m[2], fkHint: m[3] ?? null, inner: m[4].trim() })
    }
    // plain columns are ignored — we always return full base rows, which is a
    // superset of any requested column list
  }
  return { embeds }
}

function toStorage(table: string, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const jsonCols = JSON_COLUMNS[table] ?? []
  const boolCols = BOOLEAN_COLUMNS[table] ?? []
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue
    if (jsonCols.includes(k)) out[k] = v == null ? null : JSON.stringify(v)
    else if (boolCols.includes(k)) out[k] = v ? 1 : 0
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0
    else out[k] = v
  }
  return out
}

function fromStorage(table: string, row: Row): Row {
  const out: Row = { ...row }
  for (const col of JSON_COLUMNS[table] ?? []) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col] as string) } catch { /* leave as-is */ }
    }
  }
  for (const col of BOOLEAN_COLUMNS[table] ?? []) {
    if (out[col] != null) out[col] = !!out[col]
  }
  return out
}

/** Parse a PostgREST list literal like `("cancelled","invoiced")`. */
function parseListLiteral(value: string): string[] {
  return (value.match(/"([^"]*)"/g) ?? []).map((m) => m.slice(1, -1))
}

function buildWhere(
  q: QueryDescriptor,
  ctx: EngineContext
): { clause: string; params: unknown[]; error?: string } {
  const conds: string[] = []
  const params: unknown[] = []

  // Org scoping (RLS equivalent)
  if (ORG_SCOPED.has(q.table)) {
    if (!ctx.orgId) return { clause: '', params: [], error: 'No organization found for your account' }
    conds.push('org_id = ?')
    params.push(ctx.orgId)
  } else if (q.table === 'organizations') {
    if (q.action !== 'insert') {
      conds.push('id = ?')
      params.push(ctx.orgId ?? '__none__')
    }
  } else if (q.table === 'profiles') {
    // own row, or rows in the same org
    if (ctx.orgId) {
      conds.push('(id = ? OR org_id = ?)')
      params.push(ctx.userId, ctx.orgId)
    } else {
      conds.push('id = ?')
      params.push(ctx.userId)
    }
  }

  for (const f of q.filters) {
    switch (f.method) {
      case 'eq':
        conds.push(`"${f.column}" = ?`)
        params.push(f.value)
        break
      case 'neq':
        conds.push(`"${f.column}" != ?`)
        params.push(f.value)
        break
      case 'gte':
        conds.push(`"${f.column}" >= ?`)
        params.push(f.value)
        break
      case 'lte':
        conds.push(`"${f.column}" <= ?`)
        params.push(f.value)
        break
      case 'in': {
        const arr = Array.isArray(f.value) ? f.value : []
        if (arr.length === 0) {
          conds.push('0 = 1')
        } else {
          conds.push(`"${f.column}" IN (${arr.map(() => '?').join(',')})`)
          params.push(...arr)
        }
        break
      }
      case 'not': {
        if (f.operator === 'in') {
          const values = typeof f.value === 'string'
            ? parseListLiteral(f.value)
            : (Array.isArray(f.value) ? f.value : [])
          if (values.length > 0) {
            conds.push(`"${f.column}" NOT IN (${values.map(() => '?').join(',')})`)
            params.push(...values)
          }
        } else if (f.operator === 'eq') {
          conds.push(`"${f.column}" != ?`)
          params.push(f.value)
        } else if (f.operator === 'is' && f.value === null) {
          conds.push(`"${f.column}" IS NOT NULL`)
        }
        break
      }
    }
  }

  return { clause: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params }
}

function resolveFkColumn(base: string, embed: Embed): string | null {
  if (embed.fkHint) {
    // e.g. work_orders_assigned_to_fkey → assigned_to
    const m = embed.fkHint.match(new RegExp(`^${base}_(.+)_fkey$`))
    if (m) return m[1]
  }
  return MANY_TO_ONE[base]?.[embed.table] ?? null
}

function attachEmbeds(db: Database, base: string, rows: Row[], embeds: Embed[]): void {
  for (const embed of embeds) {
    const fkCol = resolveFkColumn(base, embed)
    if (fkCol) {
      // many-to-one: single related object (or null)
      const stmt = db.prepare(`SELECT * FROM "${embed.table}" WHERE id = ?`)
      for (const row of rows) {
        const fkVal = row[fkCol]
        const related = fkVal != null ? (stmt.get(fkVal) as Row | undefined) : undefined
        row[embed.alias] = related ? fromStorage(embed.table, related) : null
      }
      continue
    }
    const childFk = ONE_TO_MANY[base]?.[embed.table]
    if (childFk) {
      if (embed.inner === 'count') {
        const stmt = db.prepare(`SELECT COUNT(*) AS count FROM "${embed.table}" WHERE "${childFk}" = ?`)
        for (const row of rows) {
          const result = stmt.get(row.id) as { count: number }
          row[embed.alias] = [{ count: result.count }]
        }
      } else {
        const stmt = db.prepare(`SELECT * FROM "${embed.table}" WHERE "${childFk}" = ? ORDER BY rowid`)
        for (const row of rows) {
          const children = stmt.all(row.id) as Row[]
          row[embed.alias] = children.map((c) => fromStorage(embed.table, c))
        }
      }
      continue
    }
    // unknown relationship — surface loudly during development
    for (const row of rows) row[embed.alias] = null
  }
}

export function executeQuery(db: Database, q: QueryDescriptor, ctx: EngineContext): QueryResult {
  try {
    if (!ALLOWED_TABLES.has(q.table)) {
      return { data: null, error: { message: `Table "${q.table}" is not accessible` }, count: null }
    }

    const where = buildWhere(q, ctx)
    if (where.error) return { data: null, error: { message: where.error }, count: null }

    switch (q.action) {
      case 'select': {
        if (q.count === 'exact' && q.head) {
          const row = db
            .prepare(`SELECT COUNT(*) AS count FROM "${q.table}" ${where.clause}`)
            .get(...where.params) as { count: number }
          return { data: null, error: null, count: row.count }
        }

        let sql = `SELECT * FROM "${q.table}" ${where.clause}`
        if (q.order?.length) {
          sql += ' ORDER BY ' + q.order
            .map((o) => `"${o.column}" ${o.ascending ? 'ASC' : 'DESC'}`)
            .join(', ')
        }
        if (q.limit != null) sql += ` LIMIT ${Math.floor(q.limit)}`

        const rows = (db.prepare(sql).all(...where.params) as Row[]).map((r) =>
          fromStorage(q.table, r)
        )

        if (q.select) {
          const { embeds } = parseSelect(q.select)
          if (embeds.length) attachEmbeds(db, q.table, rows, embeds)
        }

        if (q.single) {
          if (rows.length === 0) {
            return {
              data: null,
              error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
              count: null,
            }
          }
          return { data: rows[0], error: null, count: null }
        }
        return { data: rows, error: null, count: q.count === 'exact' ? rows.length : null }
      }

      case 'insert': {
        const values = { ...(q.values ?? {}) }
        if (ORG_SCOPED.has(q.table)) {
          if (!ctx.orgId) return { data: null, error: { message: 'No organization found for your account' }, count: null }
          values.org_id = ctx.orgId
        }
        if (!values.id) values.id = randomUUID()
        const stored = toStorage(q.table, values)
        const cols = Object.keys(stored)
        db.prepare(
          `INSERT INTO "${q.table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        ).run(...cols.map((c) => stored[c]))
        if (q.returning || q.single) {
          const row = db.prepare(`SELECT * FROM "${q.table}" WHERE id = ?`).get(values.id) as Row
          const data = fromStorage(q.table, row)
          return { data: q.single ? data : [data], error: null, count: null }
        }
        return { data: null, error: null, count: null }
      }

      case 'update': {
        const stored = toStorage(q.table, q.values ?? {})
        delete stored.id
        // org_id is server-controlled on org-scoped tables; profiles keep it
        // writable so onboarding can link the user to a newly created org
        if (q.table !== 'profiles') delete stored.org_id
        const cols = Object.keys(stored)
        if (cols.length === 0) return { data: null, error: null, count: null }
        const sql = `UPDATE "${q.table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')} ${where.clause}`
        db.prepare(sql).run(...cols.map((c) => stored[c]), ...where.params)
        return { data: null, error: null, count: null }
      }

      case 'delete': {
        db.prepare(`DELETE FROM "${q.table}" ${where.clause}`).run(...where.params)
        return { data: null, error: null, count: null }
      }
    }
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Database error' },
      count: null,
    }
  }
}
