import { createClient } from '@supabase/supabase-js'

export interface ERPFullReport {
  id: string
  report_number: string | null
  report_type: string | null
  test_date: string
  technician_name: string | null
  technician_certs: string | null
  ambient_temp_f: number | null
  humidity_pct: number | null
  weather_conditions: string | null
  executive_summary: string | null
  notes: string | null
  customer: { name: string; billing_city?: string; billing_state?: string } | null
  location: { name: string; address?: string; city?: string; state?: string } | null
  equipment: Array<{
    id: string
    name: string
    equipment_type: string
    manufacturer: string | null
    model: string | null
    serial_number: string | null
    location_detail: string | null
  }>
  test_readings: Array<{
    id: string
    equipment_id: string | null
    parameter: string
    value: string | null
    unit: string | null
    result: string | null
    sort_order: number
  }>
  findings: Array<{
    id: string
    equipment_id: string | null
    severity: string | null
    description: string
    standard_ref: string | null
    recommendation: string | null
    sort_order: number
  }>
  photos: Array<{
    id: string
    finding_id: string | null
    equipment_id: string | null
    storage_path: string
    caption: string | null
  }>
}

export async function fetchFullReport(reportId: string): Promise<ERPFullReport | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: report } = await supabase
    .from('inspection_reports')
    .select(`
      *,
      customer:customers(name, billing_city, billing_state),
      location:locations(name, address, city, state)
    `)
    .eq('id', reportId)
    .single()

  if (!report) return null

  // Fetch equipment at this location
  const locationId = report.location_id
  const { data: equipment } = locationId
    ? await supabase
        .from('equipment')
        .select('id, name, equipment_type, manufacturer, model, serial_number, location_detail')
        .eq('location_id', locationId)
        .eq('status', 'active')
        .order('sort_order')
    : { data: [] }

  // Fetch readings and findings for this report
  const [{ data: readings }, { data: findings }, { data: photos }] = await Promise.all([
    supabase
      .from('test_readings')
      .select('id, equipment_id, parameter, value, unit, result, sort_order')
      .eq('report_id', reportId)
      .order('sort_order'),
    supabase
      .from('findings')
      .select('id, equipment_id, severity, description, standard_ref, recommendation, sort_order')
      .eq('report_id', reportId)
      .order('sort_order'),
    supabase
      .from('photos')
      .select('id, finding_id, equipment_id, storage_path, caption')
      .eq('report_id', reportId),
  ])

  return {
    id: report.id,
    report_number: report.report_number,
    report_type: report.report_type,
    test_date: report.test_date,
    technician_name: report.technician_name,
    technician_certs: report.technician_certs,
    ambient_temp_f: report.ambient_temp_f,
    humidity_pct: report.humidity_pct,
    weather_conditions: report.weather_conditions,
    executive_summary: report.executive_summary,
    notes: report.notes,
    customer: report.customer as ERPFullReport['customer'],
    location: report.location as ERPFullReport['location'],
    equipment: equipment ?? [],
    test_readings: readings ?? [],
    findings: findings ?? [],
    photos: photos ?? [],
  }
}

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
