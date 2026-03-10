import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  FileDown,
  ClipboardList,
  AlertTriangle,
  Thermometer,
  User,
} from 'lucide-react'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportType } from '@/types/database'

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('inspection_reports')
    .select(
      '*, customer:customers(name), location:locations(name), work_order:work_orders(id, order_number)'
    )
    .eq('id', id)
    .single()

  if (!report) notFound()

  const customer = report.customer as { name: string } | null
  const location = report.location as { name: string } | null
  const workOrder = report.work_order as {
    id: string
    order_number: string | null
  } | null
  const reportType = report.report_type as ReportType | null

  return (
    <div className="p-8 max-w-5xl">
      {workOrder ? (
        <Link
          href={`/work-orders/${workOrder.id}`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Work Order
          {workOrder.order_number && ` #${workOrder.order_number}`}
        </Link>
      ) : (
        <Link
          href="/reports"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {reportType
              ? REPORT_TYPE_LABELS[reportType]
              : 'Inspection Report'}
          </h1>
          <div className="text-sm text-gray-500 mt-1">
            {report.report_number && `#${report.report_number} · `}
            {report.test_date}
            {customer?.name && ` · ${customer.name}`}
            {location?.name && ` · ${location.name}`}
          </div>
        </div>
        <a href={`/api/reports/${id}/pdf`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </a>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Technician */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <User className="h-4 w-4" />
              Technician
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">
                {report.technician_name ?? 'Not specified'}
              </span>
            </div>
            {report.technician_certs && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Certifications</span>
                <span className="font-medium text-gray-900">
                  {report.technician_certs}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ambient Conditions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Ambient Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.notes ? (
              <p className="text-sm text-gray-700">{report.notes}</p>
            ) : (
              <p className="text-sm text-gray-400">No conditions recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary */}
      {report.executive_summary && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {report.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/reports/${id}/readings`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-yellow-200 hover:border-yellow-400">
            <CardContent className="py-6 flex items-center gap-4">
              <div className="bg-yellow-50 rounded-lg p-3">
                <ClipboardList className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  Test Readings
                </div>
                <div className="text-sm text-gray-500">
                  Record measurements for each piece of equipment
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/reports/${id}/findings`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-yellow-200 hover:border-yellow-400">
            <CardContent className="py-6 flex items-center gap-4">
              <div className="bg-yellow-50 rounded-lg p-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Findings</div>
                <div className="text-sm text-gray-500">
                  Document deficiencies and recommendations
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
