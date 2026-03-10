import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, MapPin, Building2, ChevronRight, Wrench, ClipboardList } from 'lucide-react'
import type { WorkOrderStatus } from '@/types/database'
import { STATUS_COLORS } from '@/types/database'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: locations }, { data: workOrders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('locations')
      .select('*, equipment(count)')
      .eq('customer_id', id)
      .order('name'),
    supabase
      .from('work_orders')
      .select('*, location:locations(name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!customer) notFound()

  return (
    <div className="p-8">
      <Link href="/customers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 rounded-lg p-2">
              <Building2 className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              {customer.dba && (
                <p className="text-sm text-gray-500">DBA: {customer.dba}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            {(customer.billing_city || customer.billing_state) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[customer.billing_city, customer.billing_state].filter(Boolean).join(', ')}
              </span>
            )}
            {customer.customer_type && (
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">
                {customer.customer_type}
              </span>
            )}
          </div>
        </div>
        <Link href={`/work-orders/new?customerId=${id}`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Locations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Locations</CardTitle>
            <Link href={`/customers/${id}/locations/new`}>
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!locations || locations.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No locations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => {
                  const equipmentCount =
                    (loc.equipment as unknown as { count: number }[])?.[0]?.count ?? 0

                  return (
                    <Link
                      key={loc.id}
                      href={`/customers/${id}/locations/${loc.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-sm text-gray-900">{loc.name}</div>
                        <div className="text-xs text-gray-500">
                          {[loc.city, loc.state].filter(Boolean).join(', ')}
                          {equipmentCount > 0 && (
                            <span className="ml-2">
                              · {equipmentCount} equipment
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Work Orders</CardTitle>
            <Link href={`/work-orders?customerId=${id}`} className="text-sm text-yellow-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!workOrders || workOrders.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No work orders yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {workOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders/${wo.id}`}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {(wo.location as { name: string } | null)?.name ?? 'No location'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {wo.work_type} · {wo.scheduled_date ?? 'Unscheduled'}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[wo.status as WorkOrderStatus]}`}
                    >
                      {(wo.status as string).replace('_', ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
