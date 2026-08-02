import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

// Executes Supabase/PostgREST-style query descriptors against SQLite,
// enforcing the org scoping that RLS provided on hosted Supabase.
//
// Descriptors arrive from the browser via /api/db, so every identifier in one
// is untrusted input. Table names are checked against ALLOWED_TABLES and every
// column name against the table's real column list before it reaches SQL —
// identifiers cannot be bound as parameters, so an allowlist is the only
// defence available here.

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
  /** `.single()` errors when a query matches no rows; `.maybeSingle()` does not. */
  singleMode?: 'strict' | 'maybe'
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

// Columns the server owns. A client may never set these, on any table: org_id
// decides which tenant a row belongs to, and role decides what its owner may do.
const SERVER_CONTROLLED = new Set(['org_id', 'role'])

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
  inner: string
}

class QueryError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Real column names per table, read once from the database itself. */
const columnCache = new WeakMap<Database, Map<string, Set<string>>>()

function tableColumns(db: Database, table: string): Set<string> {
  let perDb = columnCache.get(db)
  if (!perDb) {
    perDb = new Map()
    columnCache.set(db, perDb)
  }
  let cols = perDb.get(table)
  if (!cols) {
    // Safe to interpolate: callers check ALLOWED_TABLES before reaching here.
    const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
    cols = new Set(rows.map((r) => r.name))
    perDb.set(table, cols)
  }
  return cols
}

function checkColumn(db: Database, table: string, column: unknown): string {
  if (typeof column !== 'string' || !tableColumns(db, table).has(column)) {
    throw new QueryError(`Unknown column "${String(column)}" on "${table}"`, 'PGRST204')
  }
  return column
}

/** better-sqlite3 binds only numbers, strings, bigints, buffers and null. */
function toBindable(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value === undefined) return null
  if (value !== null && typeof value === 'object') {
    throw new QueryError('Filter values must be primitives')
  }
  return value
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
    // The `!fkey` hint PostgREST allows is parsed and discarded: the join column
    // is resolved from the static relation maps, never from the request.
    const m = part.match(/^(?:([\w]+):)?([\w]+)(?:![\w]+)?\(([\s\S]*)\)$/)
    if (m) {
      embeds.push({ alias: m[1] ?? m[2], table: m[2], inner: m[3].trim() })
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
    else if (v !== null && typeof v === 'object') out[k] = JSON.stringify(v)
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

/** Parse a PostgREST list literal, quoted `("a","b")` or bare `(a,b)`. */
function parseListLiteral(value: string): string[] {
  const inner = value.trim().replace(/^\(/, '').replace(/\)$/, '')
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^"(.*)"$/, '$1'))
    .filter((s) => s.length > 0)
}

/** Scoping predicate for a table, used for the base query and for embeds. */
function scopeFor(
  table: string,
  ctx: EngineContext,
  action: QueryDescriptor['action']
): { sql: string; params: unknown[] } | null {
  if (ORG_SCOPED.has(table)) {
    if (!ctx.orgId) throw new QueryError('No organization found for your account')
    return { sql: 'org_id = ?', params: [ctx.orgId] }
  }
  if (table === 'organizations') {
    return { sql: 'id = ?', params: [ctx.orgId ?? '__none__'] }
  }
  if (table === 'profiles') {
    // Reads may see teammates; writes are confined to the caller's own row so a
    // filterless update cannot rewrite every profile in the organization.
    if (action !== 'select') return { sql: 'id = ?', params: [ctx.userId] }
    if (ctx.orgId) return { sql: '(id = ? OR org_id = ?)', params: [ctx.userId, ctx.orgId] }
    return { sql: 'id = ?', params: [ctx.userId] }
  }
  return null
}

function buildWhere(
  db: Database,
  q: QueryDescriptor,
  ctx: EngineContext
): { clause: string; params: unknown[] } {
  const conds: string[] = []
  const params: unknown[] = []

  const scope = scopeFor(q.table, ctx, q.action)
  if (scope) {
    conds.push(scope.sql)
    params.push(...scope.params)
  }

  for (const f of q.filters) {
    const col = checkColumn(db, q.table, f.column)
    switch (f.method) {
      case 'eq':
        conds.push(`"${col}" = ?`)
        params.push(toBindable(f.value))
        break
      case 'neq':
        conds.push(`"${col}" != ?`)
        params.push(toBindable(f.value))
        break
      case 'gte':
        conds.push(`"${col}" >= ?`)
        params.push(toBindable(f.value))
        break
      case 'lte':
        conds.push(`"${col}" <= ?`)
        params.push(toBindable(f.value))
        break
      case 'in': {
        const arr = Array.isArray(f.value) ? f.value : []
        if (arr.length === 0) {
          conds.push('0 = 1')
        } else {
          conds.push(`"${col}" IN (${arr.map(() => '?').join(',')})`)
          params.push(...arr.map(toBindable))
        }
        break
      }
      case 'not': {
        if (f.operator === 'in') {
          const values = typeof f.value === 'string'
            ? parseListLiteral(f.value)
            : (Array.isArray(f.value) ? f.value : [])
          if (values.length === 0) {
            throw new QueryError(`Filter not.in on "${col}" has no values`)
          }
          conds.push(`"${col}" NOT IN (${values.map(() => '?').join(',')})`)
          params.push(...values.map(toBindable))
        } else if (f.operator === 'eq') {
          conds.push(`"${col}" != ?`)
          params.push(toBindable(f.value))
        } else if (f.operator === 'is' && f.value === null) {
          conds.push(`"${col}" IS NOT NULL`)
        } else {
          // Dropping an unsupported filter would silently widen the query.
          throw new QueryError(`Unsupported filter: not.${String(f.operator)}`)
        }
        break
      }
      default:
        throw new QueryError(`Unsupported filter method: ${String(f.method)}`)
    }
  }

  return { clause: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params }
}

function attachEmbeds(
  db: Database,
  base: string,
  rows: Row[],
  embeds: Embed[],
  ctx: EngineContext
): void {
  for (const embed of embeds) {
    if (!ALLOWED_TABLES.has(embed.table)) {
      throw new QueryError(`Table "${embed.table}" is not accessible`)
    }

    // Embedded rows get the same tenant scoping as a direct query would.
    const scope = scopeFor(embed.table, ctx, 'select')
    const scopeSql = scope ? ` AND ${scope.sql}` : ''
    const scopeParams = scope ? scope.params : []

    const fkCol = MANY_TO_ONE[base]?.[embed.table] ?? null
    if (fkCol) {
      // many-to-one: single related object (or null)
      const stmt = db.prepare(`SELECT * FROM "${embed.table}" WHERE id = ?${scopeSql}`)
      for (const row of rows) {
        const fkVal = row[fkCol]
        const related = fkVal != null
          ? (stmt.get(fkVal, ...scopeParams) as Row | undefined)
          : undefined
        row[embed.alias] = related ? fromStorage(embed.table, related) : null
      }
      continue
    }

    const childFk = ONE_TO_MANY[base]?.[embed.table]
    if (childFk) {
      if (embed.inner === 'count') {
        const stmt = db.prepare(
          `SELECT COUNT(*) AS count FROM "${embed.table}" WHERE "${childFk}" = ?${scopeSql}`
        )
        for (const row of rows) {
          const result = stmt.get(row.id, ...scopeParams) as { count: number }
          row[embed.alias] = [{ count: result.count }]
        }
      } else {
        // Children the app orders explicitly must come back in that order, so
        // the AI summary and the PDF describe findings in the same sequence.
        const orderBy = tableColumns(db, embed.table).has('sort_order')
          ? '"sort_order", rowid'
          : 'rowid'
        const stmt = db.prepare(
          `SELECT * FROM "${embed.table}" WHERE "${childFk}" = ?${scopeSql} ORDER BY ${orderBy}`
        )
        for (const row of rows) {
          const children = stmt.all(row.id, ...scopeParams) as Row[]
          row[embed.alias] = children.map((c) => fromStorage(embed.table, c))
        }
      }
      continue
    }

    throw new QueryError(`Relationship "${base}" -> "${embed.table}" is not defined`, 'PGRST200')
  }
}

export function executeQuery(db: Database, q: QueryDescriptor, ctx: EngineContext): QueryResult {
  try {
    if (!ALLOWED_TABLES.has(q.table)) {
      return { data: null, error: { message: `Table "${q.table}" is not accessible` }, count: null }
    }

    // Organizations are created and removed by the onboarding route, which can
    // check that the caller has no org yet; the generic endpoint cannot.
    if (q.table === 'organizations' && (q.action === 'insert' || q.action === 'delete')) {
      return {
        data: null,
        error: { message: `Cannot ${q.action} organizations through this endpoint` },
        count: null,
      }
    }

    // An update or delete carrying no caller filter matches everything the
    // scope allows, which for most tables is the whole organization.
    if ((q.action === 'update' || q.action === 'delete') && q.filters.length === 0) {
      return {
        data: null,
        error: { message: `A ${q.action} must include at least one filter` },
        count: null,
      }
    }

    const where = buildWhere(db, q, ctx)

    switch (q.action) {
      case 'select': {
        const embeds = q.select ? parseSelect(q.select).embeds : []

        if (q.count === 'exact' && q.head) {
          const row = db
            .prepare(`SELECT COUNT(*) AS count FROM "${q.table}" ${where.clause}`)
            .get(...where.params) as { count: number }
          return { data: null, error: null, count: row.count }
        }

        let sql = `SELECT * FROM "${q.table}" ${where.clause}`
        if (q.order?.length) {
          sql += ' ORDER BY ' + q.order
            .map((o) => `"${checkColumn(db, q.table, o.column)}" ${o.ascending ? 'ASC' : 'DESC'}`)
            .join(', ')
        }
        if (q.limit != null) {
          if (!Number.isFinite(q.limit) || q.limit < 0) {
            return { data: null, error: { message: 'limit must be a non-negative number' }, count: null }
          }
          sql += ` LIMIT ${Math.floor(q.limit)}`
        }

        const rows = (db.prepare(sql).all(...where.params) as Row[]).map((r) =>
          fromStorage(q.table, r)
        )

        if (embeds.length) attachEmbeds(db, q.table, rows, embeds, ctx)

        if (q.single) {
          if (rows.length === 0) {
            // .maybeSingle() treats "no rows" as a legitimate answer.
            if (q.singleMode === 'maybe') return { data: null, error: null, count: null }
            return {
              data: null,
              error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
              count: null,
            }
          }
          if (rows.length > 1) {
            return {
              data: null,
              error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
              count: null,
            }
          }
          return { data: rows[0], error: null, count: null }
        }

        let count: number | null = null
        if (q.count === 'exact') {
          const row = db
            .prepare(`SELECT COUNT(*) AS count FROM "${q.table}" ${where.clause}`)
            .get(...where.params) as { count: number }
          count = row.count
        }
        return { data: rows, error: null, count }
      }

      case 'insert': {
        const values = { ...(q.values ?? {}) }
        for (const key of SERVER_CONTROLLED) delete values[key]
        if (ORG_SCOPED.has(q.table)) {
          if (!ctx.orgId) return { data: null, error: { message: 'No organization found for your account' }, count: null }
          values.org_id = ctx.orgId
        }
        if (q.table === 'profiles') values.id = ctx.userId
        if (!values.id) values.id = randomUUID()
        const stored = toStorage(q.table, values)
        const cols = Object.keys(stored).map((c) => checkColumn(db, q.table, c))
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
        const values = { ...(q.values ?? {}) }
        delete values.id
        for (const key of SERVER_CONTROLLED) delete values[key]
        const stored = toStorage(q.table, values)
        const cols = Object.keys(stored).map((c) => checkColumn(db, q.table, c))
        if (cols.length === 0) {
          return { data: null, error: { message: 'No writable columns in update' }, count: null }
        }
        const sql = `UPDATE "${q.table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')} ${where.clause}`
        db.prepare(sql).run(...cols.map((c) => stored[c]), ...where.params)
        if (q.returning || q.single) {
          const rows = (db.prepare(`SELECT * FROM "${q.table}" ${where.clause}`)
            .all(...where.params) as Row[]).map((r) => fromStorage(q.table, r))
          return { data: q.single ? (rows[0] ?? null) : rows, error: null, count: null }
        }
        return { data: null, error: null, count: null }
      }

      case 'delete': {
        db.prepare(`DELETE FROM "${q.table}" ${where.clause}`).run(...where.params)
        return { data: null, error: null, count: null }
      }

      default:
        return { data: null, error: { message: `Unsupported action: ${String(q.action)}` }, count: null }
    }
  } catch (err) {
    if (err instanceof QueryError) {
      return { data: null, error: { message: err.message, code: err.code }, count: null }
    }
    // Driver text can name tables and columns the caller has no business
    // learning, and gives a probe a precise oracle. Keep it server-side.
    console.error('[localdb] query failed:', err)
    return { data: null, error: { message: 'Database error' }, count: null }
  }
}
