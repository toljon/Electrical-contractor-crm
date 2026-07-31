import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ClipboardList, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import { STATUS_COLORS } from '@/types/database'
import type { WorkOrderStatus, DbRow } from '@/types/database'
import { getEngineContext } from '@/lib/localdb/auth'
import { getExecMetrics, fmtMoneyCents, fmtUsdExact, COST_MODEL } from '@/lib/metrics'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const metrics = getExecMetrics(getEngineContext(user!.id).orgId!)

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
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/work-orders/new">
          <Button className="bg-ink hover:bg-ink-hover text-white font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      {/* The business, first. Dispatch counts matter to a coordinator; these
          three are what the operation is actually worth this quarter. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="border-l-4 border-l-brand">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Active project pipeline</p>
            <p className="text-3xl font-bold text-gray-900">{fmtMoneyCents(metrics.activeProjects.value)}</p>
            <p className="text-xs text-gray-500 mt-1">across {metrics.activeProjects.n} projects</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-brand">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Prefab backlog in shop</p>
            <p className="text-3xl font-bold text-gray-900">{metrics.backlog}</p>
            <p className="text-xs text-gray-500 mt-1">
              assemblies modeled → QC · {metrics.shipped30} shipped in 30 days
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-brand">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Shop hours vs estimate</p>
            <p className={`text-3xl font-bold ${metrics.variancePct > 5 ? 'text-amber-700' : 'text-gray-900'}`}>
              {metrics.variancePct > 0 ? '+' : ''}{metrics.variancePct}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(metrics.totalActual).toLocaleString()}h actual / {Math.round(metrics.totalEst).toLocaleString()}h est
            </p>
          </CardContent>
        </Card>
      </div>

      {/* The one sentence a CEO can act on without opening another tab. */}
      {metrics.worstOverrun && (
        <Link href="/insights" className="block mb-8 group">
          <Card className="bg-brand-wash border-brand/40 transition-colors group-hover:border-brand">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-brand-ink shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-semibold">{metrics.worstOverrun.label}</span> assemblies are
                  running <span className="font-semibold">{metrics.worstOverrun.variancePct}% over estimate</span>
                  {' '}— {metrics.worstOverrun.hoursOver.toLocaleString()} shop hours beyond the bid across{' '}
                  {metrics.worstOverrun.n} completed units. The estimate, not the shop, is the thing to fix.
                </p>
                {metrics.bestUnderrun && (
                  <p className="text-xs text-gray-600 mt-1">
                    {metrics.bestUnderrun.label} is coming in {Math.abs(metrics.bestUnderrun.variancePct)}% under —
                    that estimate is carrying slack worth reclaiming.
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Today's operational picture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Today&apos;s Jobs</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayJobs?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open Deficiencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{openFindings ?? 0}</div>
            {metrics.openCritical > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {metrics.openCritical} critical or major · {fmtUsdExact(metrics.exposureUsd)} modelled exposure
                <span className="block text-gray-400">
                  assumes {fmtUsdExact(COST_MODEL.emergencyRepairUsd)} emergency vs{' '}
                  {fmtUsdExact(COST_MODEL.plannedRepairUsd)} planned repair
                </span>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedThisMonth ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Latest Work Orders</CardTitle>
          <Link href="/work-orders" className="text-sm text-brand-ink hover:underline">View all</Link>
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
              {recentWorkOrders.map((wo: DbRow) => (
                <Link key={wo.id} href={`/work-orders/${wo.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <div className="font-medium text-gray-900">
                      {(wo.customer as { name: string } | null)?.name} — {(wo.location as { name: string } | null)?.name ?? 'No location'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {wo.work_type} · {wo.scheduled_date ? `scheduled ${wo.scheduled_date}` : 'unscheduled'}
                    </div>
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
