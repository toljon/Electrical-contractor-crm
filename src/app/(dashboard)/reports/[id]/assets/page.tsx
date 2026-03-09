export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import AssetsEditor from './AssetsEditor'
import type { Asset, TestReading } from '@/types/database'

export default async function AssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: report }, { data: assets }] = await Promise.all([
    supabase.from('test_reports').select('id, report_type, status').eq('id', id).single(),
    supabase
      .from('assets')
      .select('*, test_readings(*)')
      .eq('report_id', id)
      .order('sort_order'),
  ])

  if (!report) notFound()

  return (
    <div className="p-8 max-w-4xl">
      <Link href={`/reports/${id}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Report
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets & Test Readings</h1>
          <p className="text-gray-500 mt-1">Add each piece of equipment tested and record measurements.</p>
        </div>
        <Link href={`/reports/${id}/findings`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            Next: Findings
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <AssetsEditor
        reportId={id}
        reportType={report.report_type}
        initialAssets={(assets ?? []) as (Asset & { test_readings: TestReading[] })[]}
      />
    </div>
  )
}
