export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, FileDown, Pencil, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { REPORT_TYPE_LABELS, SEVERITY_LABELS } from '@/types/database'
import type { ReportStatus, ReportType, FindingSeverity, Asset, TestReading, Finding } from '@/types/database'
import ReportStatusActions from './ReportStatusActions'

const statusColors: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
}

const severityColors: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  observation: 'bg-blue-100 text-blue-700',
}

const resultColors: Record<string, string> = {
  pass: 'text-green-600 font-medium',
  fail: 'text-red-600 font-bold',
  marginal: 'text-orange-600 font-medium',
  'n/a': 'text-gray-400',
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: report },
    { data: assets },
    { data: findings },
    { data: photos },
  ] = await Promise.all([
    supabase
      .from('test_reports')
      .select('*, company:companies(*), site:sites(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('assets')
      .select('*, test_readings(*)')
      .eq('report_id', id)
      .order('sort_order'),
    supabase
      .from('findings')
      .select('*, asset:assets(name)')
      .eq('report_id', id)
      .order('sort_order'),
    supabase
      .from('photos')
      .select('*')
      .eq('report_id', id),
  ])

  if (!report) notFound()

  const company = report.company as Record<string, string> | null
  const site = report.site as Record<string, string> | null
  const criticalCount = findings?.filter(f => f.severity === 'critical').length ?? 0
  const majorCount = findings?.filter(f => f.severity === 'major').length ?? 0

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/reports" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Reports
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {company?.name ?? 'No company'} — {site?.name ?? 'No site'}
            </h1>
            <Badge className={statusColors[report.status as ReportStatus]}>{report.status}</Badge>
          </div>
          <div className="text-sm text-gray-500">
            {REPORT_TYPE_LABELS[report.report_type as ReportType]} &middot; {report.test_date}
            {report.report_number && ` &middot; ${report.report_number}`}
            {report.technician_name && ` &middot; ${report.technician_name}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/reports/${id}/assets`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Link href={`/reports/${id}/preview`}>
            <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold" size="sm">
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Generate PDF
            </Button>
          </Link>
        </div>
      </div>

      <ReportStatusActions reportId={id} currentStatus={report.status as ReportStatus} />

      {/* Alerts */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <strong>{criticalCount} critical finding{criticalCount > 1 ? 's' : ''}</strong> require immediate attention
        </div>
      )}
      {majorCount > 0 && !criticalCount && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4 text-sm text-orange-700">
          <Info className="h-4 w-4 flex-shrink-0" />
          <strong>{majorCount} major finding{majorCount > 1 ? 's' : ''}</strong> noted
        </div>
      )}

      {/* Notes */}
      {report.notes && (
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">General Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{report.notes}</p></CardContent>
        </Card>
      )}

      {/* Assets & Readings */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Assets & Test Readings</h2>
          <Link href={`/reports/${id}/assets`} className="text-sm text-yellow-600 hover:underline">
            Edit
          </Link>
        </div>
        {!assets || assets.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-gray-400">
              No assets added yet.{' '}
              <Link href={`/reports/${id}/assets`} className="text-yellow-600 hover:underline">Add assets</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(assets as (Asset & { test_readings: TestReading[] })[]).map((asset) => (
              <Card key={asset.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{asset.name}</CardTitle>
                  <div className="text-xs text-gray-500">
                    {[asset.equipment_type, asset.manufacturer, asset.model, asset.serial_number && `S/N: ${asset.serial_number}`, asset.location].filter(Boolean).join(' · ')}
                  </div>
                </CardHeader>
                {asset.test_readings && asset.test_readings.length > 0 && (
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500">
                          <th className="pb-1.5 font-medium">Parameter</th>
                          <th className="pb-1.5 font-medium">Value</th>
                          <th className="pb-1.5 font-medium">Unit</th>
                          <th className="pb-1.5 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asset.test_readings.map((r) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="py-1.5 text-gray-700">{r.parameter}</td>
                            <td className="py-1.5 font-mono">{r.value ?? '—'}</td>
                            <td className="py-1.5 text-gray-500">{r.unit ?? ''}</td>
                            <td className={`py-1.5 ${resultColors[r.result ?? ''] ?? ''}`}>
                              {r.result ? r.result.toUpperCase() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator className="my-6" />

      {/* Findings */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Findings</h2>
          <Link href={`/reports/${id}/findings`} className="text-sm text-yellow-600 hover:underline">
            Edit
          </Link>
        </div>
        {!findings || findings.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-gray-400">
              No findings.{' '}
              <Link href={`/reports/${id}/findings`} className="text-yellow-600 hover:underline">Add findings</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(['critical', 'major', 'minor', 'observation'] as FindingSeverity[]).map((sev) => {
              const sevFindings = (findings as (Finding & { asset?: Asset })[]).filter(f => f.severity === sev)
              if (!sevFindings.length) return null
              return (
                <div key={sev}>
                  {sevFindings.map((f) => (
                    <Card key={f.id} className="mb-2">
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <Badge className={severityColors[sev]}>{SEVERITY_LABELS[sev]}</Badge>
                          <div>
                            <div className="text-sm font-medium">{f.description}</div>
                            {f.asset && <div className="text-xs text-gray-500 mt-0.5">Asset: {f.asset.name}</div>}
                            {f.recommendation && (
                              <div className="text-sm text-gray-600 mt-1.5 flex items-start gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                {f.recommendation}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
