import { createClient } from '@/lib/supabase/server'
import { generateExecutiveSummary } from '@/lib/agents/report-agent'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch report with related data
  const { data: report } = await supabase
    .from('inspection_reports')
    .select(`
      *,
      customer:customers(name),
      location:locations(name),
      findings(*),
      test_readings(*)
    `)
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const summary = await generateExecutiveSummary({
    customerName: (report.customer as { name: string })?.name ?? 'Unknown',
    locationName: (report.location as { name: string })?.name ?? 'Unknown',
    reportType: report.report_type ?? 'Inspection',
    testDate: report.test_date,
    technicianName: report.technician_name ?? 'Technician',
    findings: (report.findings as Array<{ severity: string; description: string; recommendation: string | null; standard_ref: string | null }>).map(f => ({
      severity: f.severity,
      description: f.description,
      recommendation: f.recommendation,
      standardRef: f.standard_ref,
    })),
    readings: (report.test_readings as Array<{ parameter: string; value: string | null; unit: string | null; result: string | null }>).map(r => ({
      parameter: r.parameter,
      value: r.value,
      unit: r.unit,
      result: r.result,
    })),
  })

  // Save summary to report
  await supabase
    .from('inspection_reports')
    .update({ executive_summary: summary })
    .eq('id', id)

  return NextResponse.json({ summary })
}
