import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ClipboardList, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: todayJobs },
    { count: openFindings },
    { count: completedThisMonth },
    { data: recentWorkOrders },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select('*, customer:customers(name), location:locations(name)')
      .eq('scheduled_date', today)
      .not('status', 'in', '("cancelled","invoiced")')
      .order('scheduled_date'),
    supabase
      .from('findings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'complete')
      .gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase
      .from('work_orders')
      .select('*, customer:customers(name), location:locations(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/work-orders/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Today&apos;s Jobs</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayJobs?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open Deficiencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{openFindings ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completedThisMonth ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Work Orders</CardTitle>
          <Link href="/work-orders" className="text-sm text-yellow-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {!recentWorkOrders?.length ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No work orders yet.</p>
              <Link href="/work-orders/new">
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Create First Work Order</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentWorkOrders.map(wo => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <div className="font-medium text-gray-900">
                      {(wo.customer as { name: string } | null)?.name} — {(wo.location as { name: string } | null)?.name ?? 'No location'}
                    </div>
                    <div className="text-sm text-gray-500">{wo.work_type} · {wo.scheduled_date ?? 'Unscheduled'}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[wo.status as WorkOrderStatus]}`}>
                    {wo.status.replace('_', ' ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
