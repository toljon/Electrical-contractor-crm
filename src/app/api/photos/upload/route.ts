import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const reportId = formData.get('report_id') as string
  const equipmentId = formData.get('equipment_id') as string | null
  const findingId = formData.get('finding_id') as string | null
  const caption = formData.get('caption') as string | null

  if (!file || !reportId) {
    return NextResponse.json({ error: 'file and report_id are required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organization found for your account' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
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
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ photo: data })
}
