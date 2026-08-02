import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from 'better-sqlite3'
import { createTestDb } from '@/lib/localdb/database'
import { executeQuery, type EngineContext } from '@/lib/localdb/engine'

// Every case here is an attack that worked against the engine before the query
// descriptor's identifiers were validated. They are written as "an authenticated
// org-A user cannot ..." so a regression shows up as a tenant boundary failing,
// not as a changed error string.

let db: Database
const alice: EngineContext = { userId: 'u-a', orgId: 'org-A' }

beforeEach(() => {
  db = createTestDb()
  db.prepare("INSERT INTO organizations (id,name,slug) VALUES ('org-A','Alpha','alpha')").run()
  db.prepare("INSERT INTO organizations (id,name,slug) VALUES ('org-B','Beta','beta')").run()
  db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('u-a','a@a.com','SALT_A:HASH_A')").run()
  db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('u-a2','a2@a.com','SALT_A2:HASH_A2')").run()
  db.prepare("INSERT INTO users (id,email,password_hash) VALUES ('u-b','b@b.com','SALT_B:HASH_B')").run()
  db.prepare("INSERT INTO profiles (id,full_name,org_id,role) VALUES ('u-a','Alice','org-A','technician')").run()
  db.prepare("INSERT INTO profiles (id,full_name,org_id,role) VALUES ('u-a2','Ann','org-A','admin')").run()
  db.prepare("INSERT INTO profiles (id,full_name,org_id,role) VALUES ('u-b','Bob','org-B','admin')").run()
  db.prepare("INSERT INTO customers (id,org_id,name,notes) VALUES ('c-a','org-A','Alpha Own','ours')").run()
  db.prepare("INSERT INTO customers (id,org_id,name,notes) VALUES ('c-b','org-B','BETA CONFIDENTIAL','secret margins')").run()
})

const names = (r: { data: unknown }) =>
  (r.data as { name: string }[]).map((x) => x.name)

describe('identifier injection', () => {
  it('rejects a filter column that tries to break out of its quotes', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select',
      filters: [{ method: 'not', column: 'id" IS NOT NULL OR "id', value: null, operator: 'is' }],
    }, alice)

    expect(r.error).not.toBeNull()
    expect(r.data).toBeNull()
  })

  it('rejects an eq filter column carrying injected boolean logic', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select',
      filters: [{ method: 'eq', column: 'name" = "name" OR "name', value: 'BETA CONFIDENTIAL' }],
    }, alice)

    expect(r.error).not.toBeNull()
    expect(r.data).toBeNull()
  })

  it('rejects an injected ORDER BY column', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select', filters: [],
      order: [{ column: "name\", (SELECT password_hash FROM users WHERE id='u-b') --", ascending: true }],
    }, alice)

    expect(r.error).not.toBeNull()
  })

  it('rejects a values key that smuggles a second assignment into UPDATE', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'update',
      values: { 'name" = \'pwned\', "org_id': 'org-B' },
      filters: [{ method: 'eq', column: 'id', value: 'c-a' }],
    }, alice)

    expect(r.error).not.toBeNull()
    const row = db.prepare("SELECT org_id,name FROM customers WHERE id='c-a'").get()
    expect(row).toEqual({ org_id: 'org-A', name: 'Alpha Own' })
  })

  it('rejects an unknown column outright', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select',
      filters: [{ method: 'eq', column: 'no_such_column', value: 1 }],
    }, alice)

    expect(r.error?.message).toContain('Unknown column')
  })
})

describe('tenant isolation', () => {
  it('never returns another org\'s rows on a normal query', () => {
    const r = executeQuery(db, { table: 'customers', action: 'select', filters: [] }, alice)
    expect(names(r)).toEqual(['Alpha Own'])
  })

  it('ignores a client-supplied org_id on insert', () => {
    executeQuery(db, {
      table: 'customers', action: 'insert',
      values: { id: 'c-new', name: 'Planted', org_id: 'org-B' }, filters: [],
    }, alice)

    const row = db.prepare("SELECT org_id FROM customers WHERE id='c-new'").get()
    expect(row).toEqual({ org_id: 'org-A' })
  })

  it('refuses to move a profile into another organization', () => {
    executeQuery(db, {
      table: 'profiles', action: 'update', values: { org_id: 'org-B' },
      filters: [{ method: 'eq', column: 'id', value: 'u-a' }],
    }, alice)

    const row = db.prepare("SELECT org_id FROM profiles WHERE id='u-a'").get()
    expect(row).toEqual({ org_id: 'org-A' })
  })

  it('refuses to let a technician promote themselves to admin', () => {
    executeQuery(db, {
      table: 'profiles', action: 'update', values: { role: 'admin', full_name: 'Alice' },
      filters: [{ method: 'eq', column: 'id', value: 'u-a' }],
    }, alice)

    const row = db.prepare("SELECT role FROM profiles WHERE id='u-a'").get()
    expect(row).toEqual({ role: 'technician' })
  })

  it('confines a profile write to the caller\'s own row', () => {
    executeQuery(db, {
      table: 'profiles', action: 'update', values: { full_name: 'PWNED' },
      filters: [{ method: 'neq', column: 'id', value: '__none__' }],
    }, alice)

    const others = db.prepare("SELECT full_name FROM profiles WHERE id != 'u-a'").all()
    expect(others).toEqual([{ full_name: 'Ann' }, { full_name: 'Bob' }])
  })

  it('scopes embedded relations to the caller\'s organization', () => {
    db.prepare("INSERT INTO work_orders (id,org_id,customer_id,order_number) VALUES ('w1','org-A','c-b','WO-1')").run()
    const r = executeQuery(db, {
      table: 'work_orders', action: 'select', select: '*, customer:customers(name)', filters: [],
    }, alice)

    const row = (r.data as { customer: unknown }[])[0]
    expect(row.customer).toBeNull()
  })
})

describe('table reachability', () => {
  it('refuses a direct query against users', () => {
    const r = executeQuery(db, { table: 'users', action: 'select', filters: [] }, alice)
    expect(r.error?.message).toContain('not accessible')
  })

  it('refuses to reach users through an embedded relation', () => {
    const r = executeQuery(db, {
      table: 'profiles', action: 'select', select: '*, u:users!profiles_id_fkey(*)', filters: [],
    }, alice)

    expect(r.error).not.toBeNull()
    expect(JSON.stringify(r.data ?? '')).not.toContain('HASH_A')
  })

  it('refuses an undefined relationship instead of silently returning null', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select', select: '*, bogus:projects(*)', filters: [],
    }, alice)

    expect(r.error).not.toBeNull()
  })

  it('refuses to create or delete organizations through the query endpoint', () => {
    const created = executeQuery(db, {
      table: 'organizations', action: 'insert', values: { name: 'Injected', slug: 'injected' }, filters: [],
    }, alice)
    expect(created.error).not.toBeNull()

    const removed = executeQuery(db, {
      table: 'organizations', action: 'delete',
      filters: [{ method: 'eq', column: 'id', value: 'org-A' }],
    }, alice)
    expect(removed.error).not.toBeNull()
  })
})

describe('destructive queries', () => {
  it('refuses a delete with no caller filter', () => {
    const r = executeQuery(db, { table: 'customers', action: 'delete', filters: [] }, alice)

    expect(r.error).not.toBeNull()
    const { c } = db.prepare("SELECT COUNT(*) c FROM customers WHERE org_id='org-A'").get() as { c: number }
    expect(c).toBe(1)
  })

  it('refuses an update with no caller filter', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'update', values: { name: 'wiped' }, filters: [],
    }, alice)

    expect(r.error).not.toBeNull()
    const row = db.prepare("SELECT name FROM customers WHERE id='c-a'").get()
    expect(row).toEqual({ name: 'Alpha Own' })
  })

  it('still deletes the caller\'s own filtered row', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'delete',
      filters: [{ method: 'eq', column: 'id', value: 'c-a' }],
    }, alice)

    expect(r.error).toBeNull()
    const { c } = db.prepare("SELECT COUNT(*) c FROM customers WHERE id='c-a'").get() as { c: number }
    expect(c).toBe(0)
  })

  it('cannot delete another org\'s row even when named explicitly', () => {
    executeQuery(db, {
      table: 'customers', action: 'delete',
      filters: [{ method: 'eq', column: 'id', value: 'c-b' }],
    }, alice)

    const { c } = db.prepare("SELECT COUNT(*) c FROM customers WHERE id='c-b'").get() as { c: number }
    expect(c).toBe(1)
  })
})

describe('filters fail loudly rather than widening', () => {
  it('errors on an unsupported not.<operator> instead of dropping it', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select',
      filters: [{ method: 'not', column: 'name', value: 'Alpha Own', operator: 'ilike' }],
    }, alice)

    expect(r.error).not.toBeNull()
    expect(r.data).toBeNull()
  })

  it('honours a not.in list in either PostgREST spelling', () => {
    db.prepare("INSERT INTO customers (id,org_id,name,status) VALUES ('c-a2','org-A','Second','inactive')").run()
    for (const literal of ['("inactive")', '(inactive)']) {
      const r = executeQuery(db, {
        table: 'customers', action: 'select',
        filters: [{ method: 'not', column: 'status', value: literal, operator: 'in' }],
      }, alice)
      expect(r.error).toBeNull()
      expect(names(r)).toEqual(['Alpha Own'])
    }
  })

  it('accepts a boolean filter value the engine itself returns', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select',
      filters: [{ method: 'eq', column: 'tax_exempt', value: false }],
    }, alice)

    expect(r.error).toBeNull()
    expect(names(r)).toEqual(['Alpha Own'])
  })
})

describe('PostgREST compatibility', () => {
  it('maybeSingle treats no rows as a legitimate empty answer', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select', single: true, singleMode: 'maybe',
      filters: [{ method: 'eq', column: 'id', value: 'nope' }],
    }, alice)

    expect(r.error).toBeNull()
    expect(r.data).toBeNull()
  })

  it('single errors when no rows match', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select', single: true, singleMode: 'strict',
      filters: [{ method: 'eq', column: 'id', value: 'nope' }],
    }, alice)

    expect(r.error?.code).toBe('PGRST116')
  })

  it('single errors when several rows match instead of picking one', () => {
    db.prepare("INSERT INTO customers (id,org_id,name) VALUES ('c-a2','org-A','Second')").run()
    const r = executeQuery(db, {
      table: 'customers', action: 'select', single: true, singleMode: 'strict', filters: [],
    }, alice)

    expect(r.error?.code).toBe('PGRST116')
  })

  it('count exact reports the full match count, not the page size', () => {
    db.prepare("INSERT INTO customers (id,org_id,name) VALUES ('c-a2','org-A','Second')").run()
    db.prepare("INSERT INTO customers (id,org_id,name) VALUES ('c-a3','org-A','Third')").run()
    const r = executeQuery(db, {
      table: 'customers', action: 'select', count: 'exact', limit: 1, filters: [],
    }, alice)

    expect((r.data as unknown[]).length).toBe(1)
    expect(r.count).toBe(3)
  })
})

describe('error reporting', () => {
  it('does not leak raw driver text to the caller', () => {
    const r = executeQuery(db, {
      table: 'customers', action: 'select', filters: [], limit: Number.NaN,
    }, alice)

    expect(r.error).not.toBeNull()
    expect(r.error?.message).not.toContain('SQLITE')
    expect(r.error?.message).not.toContain('no such column')
  })
})
