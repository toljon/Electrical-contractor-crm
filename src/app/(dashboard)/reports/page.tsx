import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, ChevronRight } from 'lucide-react'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportType } from '@/types/database'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: reports } = await supabase
    .from('inspection_reports')
    .select(
      '*, customer:customers(name), location:locations(name), work_order:work_orders(order_number)'
    )
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Inspection Reports</h1>
        <p className="text-gray-500 mt-1">
          All field inspection and test reports
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">
              No inspection reports yet. Reports are created from work orders.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const customer = report.customer as { name: string } | null
            const location = report.location as { name: string } | null
            const workOrder = report.work_order as { order_number: string | null } | null

            return (
              <Link key={report.id} href={`/reports/${report.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-100 rounded-lg p-2">
                        <FileText className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {customer?.name ?? 'No customer'} —{' '}
                          {location?.name ?? 'No location'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {REPORT_TYPE_LABELS[report.report_type as ReportType] ?? 'Unknown type'}
                          {' '}&middot; {report.test_date}
                          {report.report_number && ` · #${report.report_number}`}
                          {report.technician_name && ` · ${report.technician_name}`}
                          {workOrder?.order_number && ` · WO ${workOrder.order_number}`}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
