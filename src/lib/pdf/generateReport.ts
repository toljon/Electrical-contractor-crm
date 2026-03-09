import { createClient } from '@supabase/supabase-js'
import type { FullReport } from '@/types/database'

export async function fetchFullReport(reportId: string): Promise<FullReport | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: report },
    { data: assets },
    { data: findings },
    { data: photos },
  ] = await Promise.all([
    supabase
      .from('test_reports')
      .select('*, company:companies(*), site:sites(*)')
      .eq('id', reportId)
      .single(),
    supabase
      .from('assets')
      .select('*, test_readings(*)')
      .eq('report_id', reportId)
      .order('sort_order'),
    supabase
      .from('findings')
      .select('*, asset:assets(name)')
      .eq('report_id', reportId)
      .order('sort_order'),
    supabase
      .from('photos')
      .select('*')
      .eq('report_id', reportId),
  ])

  if (!report) return null

  return {
    ...report,
    assets: assets ?? [],
    findings: findings ?? [],
    photos: photos ?? [],
  } as FullReport
}

// Get signed URLs for photos
export async function getPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const result: Record<string, string> = {}
  for (const path of paths) {
    const { data } = await supabase.storage.from('report-photos').createSignedUrl(path, 3600)
    if (data) result[path] = data.signedUrl
  }
  return result
}
