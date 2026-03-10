import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ClipboardList, ChevronRight } from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus, WorkType } from '@/types/database'

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  inspection: 'Inspection',
  repair: 'Repair',
  installation: 'Installation',
  emergency: 'Emergency',
}

export default async function WorkOrdersPage() {
  const supabase = await createClient()
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('*, customer:customers(name), location:locations(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Manage and track all work orders</p>
        </div>
        <Link href="/work-orders/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      {!workOrders || workOrders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No work orders yet.</p>
            <Link href="/work-orders/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Work Order
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {workOrders.map((wo) => (
            <Link key={wo.id} href={`/work-orders/${wo.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-yellow-100 rounded-lg p-2">
                      <ClipboardList className="h-5 w-5 text-yellow-600" />
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
