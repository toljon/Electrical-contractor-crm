export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, Building2, TrendingUp, Clock } from 'lucide-react'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportStatus, ReportType } from '@/types/database'

const statusColors: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: reports }, { data: companies }, { count: thisMonthCount }] = await Promise.all([
    supabase
      .from('test_reports')
      .select('*, company:companies(name), site:sites(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('companies').select('id').limit(1),
    supabase
      .from('test_reports')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const draftCount = reports?.filter(r => r.status === 'draft').length ?? 0
  const completeCount = reports?.filter(r => r.status === 'complete').length ?? 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back. Here&apos;s what&apos;s happening.</p>
        </div>
        <Link href="/reports/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Reports This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{thisMonthCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Draft</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completeCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Reports</CardTitle>
          <Link href="/reports" className="text-sm text-yellow-600 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No reports yet. Create your first report to get started.</p>
              <Link href="/reports/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Report
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {(report.company as { name: string } | null)?.name ?? 'No company'} —{' '}
                      {(report.site as { name: string } | null)?.name ?? 'No site'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {REPORT_TYPE_LABELS[report.report_type as ReportType] ?? report.report_type} &middot;{' '}
                      {report.test_date}
                    </div>
                  </div>
                  <Badge className={statusColors[report.status as ReportStatus]}>
                    {report.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Companies prompt if none */}
      {(!companies || companies.length === 0) && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800 font-medium">
                Add your first customer company to get started
              </span>
            </div>
            <Link href="/companies">
              <Button size="sm" variant="outline" className="border-yellow-400">
                Add Company
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
