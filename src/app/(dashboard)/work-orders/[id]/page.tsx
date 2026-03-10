import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  ClipboardList,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
  FileText,
  Plus,
} from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus, WorkType } from '@/types/database'
import WorkOrderActions from './WorkOrderActions'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  inspection: 'Inspection',
  repair: 'Repair',
  installation: 'Installation',
  emergency: 'Emergency',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: workOrder }, { data: reports }] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        '*, customer:customers(name), location:locations(name, address, city, state), technician:profiles!work_orders_assigned_to_fkey(full_name)'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('inspection_reports')
      .select('id, report_number, report_type, test_date')
      .eq('work_order_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!workOrder) notFound()

  const customer = workOrder.customer as { name: string } | null
  const location = workOrder.location as {
    name: string
    address: string | null
    city: string | null
    state: string | null
  } | null
  const technician = workOrder.technician as { full_name: string | null } | null
  const status = workOrder.status as WorkOrderStatus
  const workType = workOrder.work_type as WorkType
  const priority = workOrder.priority as string

  const canStartInspection =
    (status === 'on_site' || status === 'in_progress') &&
    (!reports || reports.length === 0)

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/work-orders"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Work Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {customer?.name ?? 'No customer'}
              {location?.name ? ` — ${location.name}` : ''}
            </h1>
            <Badge className={STATUS_COLORS[status]}>
              {status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <div className="text-sm text-gray-500">
            {WORK_TYPE_LABELS[workType] ?? workType}
            {workOrder.order_number && ` · #${workOrder.order_number}`}
            {workOrder.scheduled_date && ` · ${workOrder.scheduled_date}`}
          </div>
        </div>
      </div>

      {/* Status Actions */}
      <WorkOrderActions workOrderId={id} currentStatus={status} />

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Work Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Work Type</span>
              <span className="font-medium text-gray-900">
                {WORK_TYPE_LABELS[workType]}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Priority</span>
              <Badge className={PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-700'}>
                {priority}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Scheduled Date</span>
              <span className="font-medium text-gray-900">
                {workOrder.scheduled_date ?? 'Not scheduled'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <Badge className={STATUS_COLORS[status]}>
                {status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">
                {customer?.name ?? 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Location</span>
              <span className="font-medium text-gray-900">
                {location?.name ?? 'N/A'}
              </span>
            </div>
            {location?.address && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Address</span>
                <span className="font-medium text-gray-900 text-right">
                  {[location.address, location.city, location.state]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Technician</span>
              <span className="font-medium text-gray-900">
                {technician?.full_name ?? 'Unassigned'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Special Instructions */}
      {workOrder.special_instructions && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Special Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {workOrder.special_instructions}
            </p>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Inspection Reports */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Inspection Reports
          </h2>
          {canStartInspection && (
            <Link href={`/reports/new?workOrderId=${id}`}>
              <Button
                size="sm"
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Start Inspection
              </Button>
            </Link>
          )}
        </div>

        {!reports || reports.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-gray-400">
              No inspection reports linked to this work order.
              {canStartInspection && (
                <>
                  {' '}
                  <Link
                    href={`/reports/new?workOrderId=${id}`}
                    className="text-yellow-600 hover:underline"
                  >
                    Start an inspection
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <Link key={report.id} href={`/reports/${report.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 rounded-lg p-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {report.report_number ?? 'Report'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {report.report_type ?? 'Unknown type'} &middot;{' '}
                          {report.test_date}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
