import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getDb } from '@/lib/localdb/database'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/localdb/session'

// Creating an organization and linking the caller's profile to it are the two
// writes the query engine deliberately refuses, because together they decide
// which tenant an account belongs to. They live here instead, where the caller
// can be checked for not already having an org and both writes share a
// transaction — a half-finished onboarding leaves an orphan org and a profile
// that can never load any page.

const bodySchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  licenseNumber: z.string().trim().max(100).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(2).optional().default(''),
})

export async function POST(request: NextRequest) {
  const userId = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }
  const form = parsed.data

  const db = getDb()
  const profile = db
    .prepare('SELECT org_id FROM profiles WHERE id = ?')
    .get(userId) as { org_id: string | null } | undefined

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (profile.org_id) {
    return NextResponse.json({ error: 'Your account already belongs to an organization' }, { status: 409 })
  }

  const orgId = randomUUID()
  const base = form.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const slug = `${base || 'org'}-${randomUUID().slice(0, 4)}`

  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, phone, city, state, license_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(orgId, form.companyName, slug, form.phone, form.city, form.state, form.licenseNumber)
      // Only links a profile that has no org — the guard above plus this
      // predicate mean a concurrent request cannot move an onboarded account.
      db.prepare('UPDATE profiles SET org_id = ?, role = ? WHERE id = ? AND org_id IS NULL')
        .run(orgId, 'admin', userId)
    })()
  } catch (err) {
    console.error('[onboarding] failed:', err)
    return NextResponse.json({ error: 'Could not create your organization' }, { status: 500 })
  }

  return NextResponse.json({ org: { id: orgId, name: form.companyName, slug } })
}
