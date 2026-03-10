import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Users, ChevronRight, Building2 } from 'lucide-react'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('*, locations(count), work_orders(count)')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer accounts</p>
        </div>
        <Link href="/customers/new">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </Link>
      </div>

      {!customers || customers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No customers yet.</p>
            <Link href="/customers/new">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Customer
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {customers.map((customer) => {
            const locationCount =
              (customer.locations as unknown as { count: number }[])?.[0]?.count ?? 0
            const workOrderCount =
              (customer.work_orders as unknown as { count: number }[])?.[0]?.count ?? 0

            return (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-yellow-100 rounded-lg p-2 mt-0.5">
                        <Building2 className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {[customer.billing_city, customer.billing_state]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          {customer.customer_type && (
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {customer.customer_type}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {locationCount} location{locationCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-400">
                            {workOrderCount} work order{workOrderCount !== 1 ? 's' : ''}
                          </span>
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
