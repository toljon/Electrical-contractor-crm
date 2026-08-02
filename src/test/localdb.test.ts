// @vitest-environment node
import { createTestDb } from '@/lib/localdb/database'
import { executeQuery, type EngineContext, type QueryDescriptor } from '@/lib/localdb/engine'
import type { Database } from 'better-sqlite3'

let db: Database
const USER = 'user-1'
const ORG = 'org-1'
const ctx: EngineContext = { userId: USER, orgId: ORG }

function run(q: Partial<QueryDescriptor> & { table: string }, context: EngineContext = ctx) {
  return executeQuery(db, { action: 'select', filters: [], ...q } as QueryDescriptor, context)
}

beforeEach(() => {
  db = createTestDb()
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, 'a@b.c', 'x')").run(USER)
  db.prepare("INSERT INTO organizations (id, name, slug) VALUES (?, 'TGG', 'tgg')").run(ORG)
  db.prepare('INSERT INTO profiles (id, org_id, full_name) VALUES (?, ?, ?)').run(USER, ORG, 'Tech One')
})

function seedCustomerGraph() {
  db.prepare("INSERT INTO customers (id, org_id, name) VALUES ('cust-1', ?, 'Beacon Property')").run(ORG)
  db.prepare(
    "INSERT INTO locations (id, org_id, customer_id, name) VALUES ('loc-1', ?, 'cust-1', 'HQ')"
  ).run(ORG)
  db.prepare(
    `INSERT INTO work_orders (id, org_id, customer_id, location_id, assigned_to, status, scheduled_date)
     VALUES ('wo-1', ?, 'cust-1', 'loc-1', ?, 'created', '2026-07-07')`
  ).run(ORG, USER)
}

describe('localdb engine', () => {
  it('inserts with generated id and forced org_id, returning single row', () => {
    const result = run({
      table: 'customers',
      action: 'insert',
      values: { name: 'Acme Hospital', org_id: 'spoofed-org' },
      single: true,
      returning: true,
    })
    expect(result.error).toBeNull()
    const row = result.data as { id: string; org_id: string; name: string; tax_exempt: boolean }
    expect(row.id).toBeTruthy()
    expect(row.org_id).toBe(ORG) // spoofed org overridden
    expect(row.tax_exempt).toBe(false) // boolean conversion
  })

  it('scopes selects to the caller org', () => {
    seedCustomerGraph()
    db.prepare("INSERT INTO organizations (id, name, slug) VALUES ('org-2', 'Other', 'other')").run()
    db.prepare("INSERT INTO customers (id, org_id, name) VALUES ('cust-2', 'org-2', 'Foreign')").run()

    const result = run({ table: 'customers', select: '*' })
    expect((result.data as unknown[]).length).toBe(1)
  })

  it('resolves many-to-one embeds including fk hints', () => {
    seedCustomerGraph()
    const result = run({
      table: 'work_orders',
      select: '*, customer:customers(name), location:locations(name), technician:profiles!work_orders_assigned_to_fkey(full_name)',
    })
    const rows = result.data as Array<Record<string, { name?: string; full_name?: string } | null>>
    expect(rows[0].customer?.name).toBe('Beacon Property')
    expect(rows[0].location?.name).toBe('HQ')
    expect(rows[0].technician?.full_name).toBe('Tech One')
  })

  it('resolves one-to-many count embeds in PostgREST shape', () => {
    seedCustomerGraph()
    const result = run({ table: 'customers', select: '*, locations(count), work_orders(count)' })
    const row = (result.data as Array<Record<string, Array<{ count: number }>>>)[0]
    expect(row.locations).toEqual([{ count: 1 }])
    expect(row.work_orders).toEqual([{ count: 1 }])
  })

  it('supports count-exact head queries', () => {
    seedCustomerGraph()
    const result = run({
      table: 'work_orders',
      count: 'exact',
      head: true,
      filters: [{ method: 'eq', column: 'status', value: 'created' }],
    })
    expect(result.count).toBe(1)
    expect(result.data).toBeNull()
  })

  it('handles negated PostgREST in-list filters', () => {
    seedCustomerGraph()
    db.prepare(
      `INSERT INTO work_orders (id, org_id, customer_id, status) VALUES ('wo-2', ?, 'cust-1', 'cancelled')`
    ).run(ORG)
    const result = run({
      table: 'work_orders',
      select: '*',
      filters: [{ method: 'not', column: 'status', operator: 'in', value: '("cancelled","invoiced")' }],
    })
    expect((result.data as Array<{ id: string }>).map((r) => r.id)).toEqual(['wo-1'])
  })

  it('returns PGRST116-style error for .single() with no rows', () => {
    const result = run({
      table: 'customers',
      select: '*',
      filters: [{ method: 'eq', column: 'id', value: 'nope' }],
      single: true,
    })
    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('PGRST116')
  })

  it('parses JSON columns on projects round-trip', () => {
    const insert = run({
      table: 'projects',
      action: 'insert',
      values: { name: 'Kendall Lab', trades: ['hvac', 'plumbing'] },
      single: true,
      returning: true,
    })
    expect((insert.data as { trades: string[] }).trades).toEqual(['hvac', 'plumbing'])
  })

  // Onboarding used to run through this engine, which meant org_id and role had
  // to stay client-writable — and so any user could move themselves into any
  // organization. Both writes now belong to POST /api/onboarding, which can
  // check the caller has no org yet and do the pair in one transaction.
  it('refuses the client-driven onboarding writes it used to allow', () => {
    const noOrgCtx: EngineContext = { userId: USER, orgId: null }
    db.prepare('UPDATE profiles SET org_id = NULL WHERE id = ?').run(USER)

    const orgInsert = run(
      { table: 'organizations', action: 'insert', values: { name: 'New Org', slug: 'new-org' }, single: true, returning: true },
      noOrgCtx
    )
    expect(orgInsert.error).not.toBeNull()

    const link = run(
      {
        table: 'profiles',
        action: 'update',
        values: { org_id: 'org-somewhere-else', role: 'admin' },
        filters: [{ method: 'eq', column: 'id', value: USER }],
      },
      noOrgCtx
    )
    expect(link.error).not.toBeNull()
    const profile = db.prepare('SELECT org_id, role FROM profiles WHERE id = ?').get(USER) as {
      org_id: string | null
      role: string
    }
    expect(profile.org_id).toBeNull()
    expect(profile.role).not.toBe('admin')
  })

  it('rejects org-scoped access without an org', () => {
    const noOrgCtx: EngineContext = { userId: USER, orgId: null }
    const result = run({ table: 'customers', select: '*' }, noOrgCtx)
    expect(result.error?.message).toContain('No organization')
  })

  it('supports in-array filters and deletes', () => {
    seedCustomerGraph()
    db.prepare(
      `INSERT INTO inspection_reports (id, org_id, work_order_id, customer_id) VALUES ('rep-1', ?, 'wo-1', 'cust-1')`
    ).run(ORG)
    db.prepare(
      `INSERT INTO findings (id, org_id, report_id, description) VALUES ('f-1', ?, 'rep-1', 'Belt frayed')`
    ).run(ORG)
    db.prepare(
      `INSERT INTO photos (id, org_id, report_id, finding_id, storage_path) VALUES ('p-1', ?, 'rep-1', 'f-1', 'reports/rep-1/x.jpg')`
    ).run(ORG)

    const photos = run({
      table: 'photos',
      select: 'id, finding_id, storage_path, caption',
      filters: [{ method: 'in', column: 'finding_id', value: ['f-1'] }],
    })
    expect((photos.data as unknown[]).length).toBe(1)

    const del = run({
      table: 'photos',
      action: 'delete',
      filters: [{ method: 'eq', column: 'id', value: 'p-1' }],
    })
    expect(del.error).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS c FROM photos').get()).toEqual({ c: 0 })
  })

  it('resolves one-to-many full embeds (findings(*), test_readings(*))', () => {
    seedCustomerGraph()
    db.prepare(
      `INSERT INTO inspection_reports (id, org_id, work_order_id, customer_id) VALUES ('rep-1', ?, 'wo-1', 'cust-1')`
    ).run(ORG)
    db.prepare(
      `INSERT INTO findings (id, org_id, report_id, description) VALUES ('f-1', ?, 'rep-1', 'Belt frayed')`
    ).run(ORG)

    const result = run({
      table: 'inspection_reports',
      select: '*, customer:customers(name), findings(*), test_readings(*)',
      filters: [{ method: 'eq', column: 'id', value: 'rep-1' }],
      single: true,
    })
    const report = result.data as {
      customer: { name: string }
      findings: Array<{ description: string }>
      test_readings: unknown[]
    }
    expect(report.customer.name).toBe('Beacon Property')
    expect(report.findings[0].description).toBe('Belt frayed')
    expect(report.test_readings).toEqual([])
  })

  it('blocks tables outside the allowlist', () => {
    const result = run({ table: 'users', select: '*' })
    expect(result.error?.message).toContain('not accessible')
  })
})
