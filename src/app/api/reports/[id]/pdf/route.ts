import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFullReport } from '@/lib/pdf/generateReport'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import ReportTemplate from '@/components/pdf/ReportTemplate'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await fetchFullReport(id)
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  // RLS handles authorization — no manual owner_id check needed

  const element = React.createElement(ReportTemplate, { report }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  const filename = `VoltTrack-${report.customer?.name ?? 'Report'}-${report.test_date}-${report.report_number ?? id.slice(0, 8)}.pdf`
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  })
}
