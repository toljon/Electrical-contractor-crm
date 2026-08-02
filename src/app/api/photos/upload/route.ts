import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// The types the report pages and the PDF template can actually render
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/pdf',
])

const fieldsSchema = z.object({
  report_id: z.string().min(1),
  equipment_id: z.string().nullable(),
  finding_id: z.string().nullable(),
  caption: z.string().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Expected a multipart form body' }, { status: 400 })
  }

  const file = formData.get('file')
  const fields = fieldsSchema.safeParse({
    report_id: formData.get('report_id'),
    equipment_id: formData.get('equipment_id'),
    finding_id: formData.get('finding_id'),
    caption: formData.get('caption'),
  })

  if (!(file instanceof File) || file.size === 0 || !fields.success) {
    return NextResponse.json({ error: 'file and report_id are required' }, { status: 400 })
  }

  const { report_id: reportId, equipment_id: equipmentId, finding_id: findingId, caption } = fields.data

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is larger than the 10MB limit' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organization found for your account' }, { status: 400 })
  }

  // Must run before the upload: a report_id that fails the insert's foreign key
  // would otherwise leave the written file orphaned.
  const { data: report } = await supabase
    .from('inspection_reports')
    .select('id')
    .eq('id', reportId)
    .eq('org_id', profile.org_id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `reports/${reportId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(storagePath, file, { upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data, error: dbError } = await supabase
    .from('photos')
    .insert({
      org_id: profile.org_id,
      report_id: reportId,
      equipment_id: equipmentId || null,
      finding_id: findingId || null,
      storage_path: storagePath,
      caption: caption || null,
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from('report-photos').remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ photo: data })
}
