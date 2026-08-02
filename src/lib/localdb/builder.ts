import type { QueryDescriptor, QueryFilter, QueryResult } from './engine'

// Supabase-compatible fluent query builder. Chainable and thenable, so
// `await supabase.from('x').select().eq(...)` works exactly like the real
// client. The executor is injected: browser → fetch('/api/db'),
// server → direct engine call.

export type Executor = (q: QueryDescriptor) => Promise<QueryResult>

// Matches the loose typing of supabase-js results that the pages rely on
export interface BuilderResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  error: { message: string; code?: string } | null
  count: number | null
}

export class QueryBuilder implements PromiseLike<BuilderResult> {
  private q: QueryDescriptor

  constructor(private executor: Executor, table: string) {
    this.q = { table, action: 'select', filters: [] }
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    if (this.q.action === 'select') {
      this.q.select = columns
      if (options?.count) this.q.count = options.count
      if (options?.head) this.q.head = options.head
    } else {
      this.q.returning = true
    }
    return this
  }

  insert(values: Record<string, unknown>) {
    this.q.action = 'insert'
    this.q.values = values
    return this
  }

  update(values: Record<string, unknown>) {
    this.q.action = 'update'
    this.q.values = values
    return this
  }

  delete() {
    this.q.action = 'delete'
    return this
  }

  private addFilter(f: QueryFilter) {
    this.q.filters.push(f)
    return this
  }

  eq(column: string, value: unknown) {
    return this.addFilter({ method: 'eq', column, value })
  }

  neq(column: string, value: unknown) {
    return this.addFilter({ method: 'neq', column, value })
  }

  gte(column: string, value: unknown) {
    return this.addFilter({ method: 'gte', column, value })
  }

  lte(column: string, value: unknown) {
    return this.addFilter({ method: 'lte', column, value })
  }

  in(column: string, values: unknown[]) {
    return this.addFilter({ method: 'in', column, value: values })
  }

  not(column: string, operator: string, value: unknown) {
    return this.addFilter({ method: 'not', column, value, operator })
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.q.order = [...(this.q.order ?? []), { column, ascending: options?.ascending !== false }]
    return this
  }

  limit(n: number) {
    this.q.limit = n
    return this
  }

  single() {
    this.q.single = true
    this.q.singleMode = 'strict'
    return this
  }

  maybeSingle() {
    this.q.single = true
    this.q.singleMode = 'maybe'
    return this
  }

  then<TResult1 = BuilderResult, TResult2 = never>(
    onfulfilled?: ((value: BuilderResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.executor(this.q).then((r) => r as BuilderResult).then(onfulfilled, onrejected)
  }
}
