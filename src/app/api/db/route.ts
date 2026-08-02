import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/localdb/database'
import { executeQuery, type QueryDescriptor } from '@/lib/localdb/engine'
import { getEngineContext } from '@/lib/localdb/auth'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

// The descriptor is authored by the browser, so its shape is pinned here before
// it reaches the engine. Identifier *values* are checked against the real schema
// inside the engine, which is also reached by the server-side executor.
const filterSchema = z.object({
  method: z.enum(['eq', 'in', 'gte', 'lte', 'neq', 'not']),
  column: z.string().min(1).max(64),
  value: z.unknown(),
  operator: z.string().min(1).max(16).optional(),
})

const descriptorSchema = z.object({
  table: z.string().min(1).max(64),
  action: z.enum(['select', 'insert', 'update', 'delete']),
  select: z.string().max(2000).optional(),
  count: z.literal('exact').optional(),
  head: z.boolean().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
  filters: z.array(filterSchema).max(50),
  order: z.array(z.object({
    column: z.string().min(1).max(64),
    ascending: z.boolean(),
  })).max(10).optional(),
  limit: z.number().int().nonnegative().max(10_000).optional(),
  single: z.boolean().optional(),
  singleMode: z.enum(['strict', 'maybe']).optional(),
  returning: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = descriptorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  const result = executeQuery(getDb(), parsed.data as QueryDescriptor, getEngineContext(userId))
  return NextResponse.json(result)
}
