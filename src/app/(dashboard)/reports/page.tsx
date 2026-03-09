import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, ChevronRight } from 'lucide-react'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportStatus, ReportType } from '@/types/database'

const statusColors: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: reports } = await supabase
    .from('test_reports')
    .select('*, company:companies(name), site:sites(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">All test reports</p>
        </div>
        <Link href="/reports/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </Link>
      </div>

      {!reports || reports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No reports yet.</p>
            <Link href="/reports/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-100 rounded-lg p-2">
                      <FileText className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {(report.company as { name: string } | null)?.name ?? 'No company'} —{' '}
                        {(report.site as { name: string } | null)?.name ?? 'No site'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {REPORT_TYPE_LABELS[report.report_type as ReportType] ?? 'Unknown type'} &middot; {report.test_date}
                        {report.report_number && ` · #${report.report_number}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[report.status as ReportStatus]}>
                      {report.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
