export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { REPORT_TYPE_LABELS, SEVERITY_LABELS } from '@/types/database'
import type { ReportType, FindingSeverity, Asset, TestReading, Finding } from '@/types/database'
import PhotoUpload from '@/components/reports/PhotoUpload'
import PDFDownloadButton from './PDFDownloadButton'

const severityColors: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  observation: 'bg-blue-100 text-blue-700',
}

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: report },
    { data: assets },
    { data: findings },
  ] = await Promise.all([
    supabase.from('test_reports').select('*, company:companies(name), site:sites(name)').eq('id', id).single(),
    supabase.from('assets').select('*, test_readings(*)').eq('report_id', id).order('sort_order'),
    supabase.from('findings').select('*, asset:assets(name)').eq('report_id', id).order('sort_order'),
  ])

  if (!report) notFound()

  const company = report.company as { name: string } | null
  const site = report.site as { name: string } | null
  const criticalCount = findings?.filter(f => f.severity === 'critical').length ?? 0

  return (
    <div className="p-8 max-w-4xl">
      <Link href={`/reports/${id}/findings`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Findings
      </Link>

      {/* Hero action bar */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Preview</h1>
          <p className="text-gray-500 mt-1">
            {company?.name} — {site?.name} · {report.test_date}
          </p>
        </div>
        <PDFDownloadButton reportId={id} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{assets?.length ?? 0}</div>
            <div className="text-sm text-gray-500">Assets Tested</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{findings?.length ?? 0}</div>
            <div className="text-sm text-gray-500">Total Findings</div>
          </CardContent>
        </Card>
        <Card className={criticalCount > 0 ? 'border-red-200' : ''}>
          <CardContent className="py-4 text-center">
            <div className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {criticalCount}
            </div>
            <div className="text-sm text-gray-500">Critical Findings</div>
          </CardContent>
        </Card>
      </div>

      {/* Report type */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Report Type</div>
              <div className="font-semibold">{REPORT_TYPE_LABELS[report.report_type as ReportType]}</div>
            </div>
            {report.technician_name && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Technician</div>
                <div className="font-semibold">{report.technician_name}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Findings summary */}
      {findings && findings.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Findings Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(['critical', 'major', 'minor', 'observation'] as FindingSeverity[]).map(sev => {
                const sevF = (findings as (Finding & { asset?: Asset })[]).filter(f => f.severity === sev)
                if (!sevF.length) return null
                return sevF.map(f => (
                  <div key={f.id} className="flex items-start gap-3 p-2 rounded bg-gray-50">
                    <Badge className={severityColors[sev]}>{SEVERITY_LABELS[sev]}</Badge>
                    <div className="text-sm">
                      <div>{f.description}</div>
                      {f.recommendation && (
                        <div className="text-gray-500 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {f.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent>
          <PhotoUpload reportId={id} />
        </CardContent>
      </Card>

      {/* Generate PDF CTA */}
      <div className="bg-gray-900 rounded-xl p-6 text-white text-center">
        <FileText className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-1">Ready to generate your report?</h2>
        <p className="text-gray-400 text-sm mb-4">Download a professional, customer-ready PDF in seconds.</p>
        <PDFDownloadButton reportId={id} variant="hero" />
      </div>
    </div>
  )
}
