export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import FindingsEditor from './FindingsEditor'
import type { Finding, Asset } from '@/types/database'

export default async function FindingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: report }, { data: findings }, { data: assets }] = await Promise.all([
    supabase.from('test_reports').select('id, status').eq('id', id).single(),
    supabase.from('findings').select('*').eq('report_id', id).order('sort_order'),
    supabase.from('assets').select('id, name').eq('report_id', id).order('sort_order'),
  ])

  if (!report) notFound()

  return (
    <div className="p-8 max-w-3xl">
      <Link href={`/reports/${id}/assets`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Assets
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Findings</h1>
          <p className="text-gray-500 mt-1">Document issues with severity, description, and recommendations.</p>
        </div>
        <Link href={`/reports/${id}/preview`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            Preview Report
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <FindingsEditor
        reportId={id}
        initialFindings={(findings ?? []) as Finding[]}
        assets={(assets ?? []) as Pick<Asset, 'id' | 'name'>[]}
      />
    </div>
  )
}
