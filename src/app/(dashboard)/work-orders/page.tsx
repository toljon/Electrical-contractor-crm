import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ClipboardList, ChevronRight, AlertTriangle, X } from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus, WorkType, DbRow } from '@/types/database'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  inspection: 'Inspection',
  maintenance: 'Preventive Maintenance',
  repair: 'Repair',
  installation: 'Installation',
  startup: 'Startup / Commissioning',
  emergency: 'Emergency',
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const { customerId } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('work_orders')
    .select('*, customer:customers(name), location:locations(name)')
  if (customerId) query = query.eq('customer_id', customerId)
  const { data: workOrders, error } = await query.order('created_at', { ascending: false })

  const { data: filterCustomer } = customerId
    ? await supabase.from('customers').select('name').eq('id', customerId).maybeSingle()
    : { data: null }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Manage and track all work orders</p>
        </div>
        <Link href="/work-orders/new">
          <Button className="bg-ink hover:bg-ink-hover text-white font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      {customerId && (
        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center gap-2 text-sm text-gray-700 bg-brand-wash border border-brand/40 rounded-full pl-3 pr-2 py-1">
            Showing only {filterCustomer?.name ?? 'one customer'}
            <Link
              href="/work-orders"
              aria-label="Clear customer filter"
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </span>
        </div>
      )}

      {error ? (
        <Card>
          <CardContent className="text-center py-16">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-1">Work orders could not be loaded.</p>
            <p className="text-sm text-gray-500">
              This is a load failure, not an empty list — refresh to try again. ({error.message})
            </p>
          </CardContent>
        </Card>
      ) : !workOrders || workOrders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {customerId ? 'No work orders for this customer.' : 'No work orders yet.'}
            </p>
            <Link href="/work-orders/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                {customerId ? 'New Work Order' : 'Create First Work Order'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {workOrders.map((wo: DbRow) => (
            <Link key={wo.id} href={`/work-orders/${wo.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-brand-wash rounded-lg p-2">
                      <ClipboardList className="h-5 w-5 text-brand-ink" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {(wo.customer as { name: string } | null)?.name ?? 'No customer'}
                        {(wo.location as { name: string } | null)?.name
                          ? ` — ${(wo.location as { name: string }).name}`
                          : ''}
                      </div>
                      <div className="text-sm text-gray-500">
                        {WORK_TYPE_LABELS[wo.work_type as WorkType] ?? wo.work_type}
                        {wo.scheduled_date && ` · ${wo.scheduled_date}`}
                        {wo.order_number && ` · #${wo.order_number}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={STATUS_COLORS[wo.status as WorkOrderStatus]}>
                      {(wo.status as string).replace(/_/g, ' ')}
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
