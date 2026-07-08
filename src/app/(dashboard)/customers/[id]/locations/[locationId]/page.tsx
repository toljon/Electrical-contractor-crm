import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Fan, MapPin } from 'lucide-react'
import { EQUIPMENT_TYPES, TRADE_LABELS, TRADE_COLORS } from '@/types/database'
import type { Trade, DbRow } from '@/types/database'
import AddEquipmentDialog from './AddEquipmentDialog'

const TYPE_LABELS = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t.value, t.label]))

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locationId: string }>
}) {
  const { id: customerId, locationId } = await params
  const supabase = await createClient()

  const [{ data: location }, { data: equipment }] = await Promise.all([
    supabase
      .from('locations')
      .select('*, customer:customers(name)')
      .eq('id', locationId)
      .single(),
    supabase
      .from('equipment')
      .select('*')
      .eq('location_id', locationId)
      .order('sort_order'),
  ])

  if (!location) notFound()
  const customer = location.customer as { name: string } | null

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <Link
        href={`/customers/${customerId}`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {customer?.name ?? 'Customer'}
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {[location.address, location.city, location.state].filter(Boolean).join(', ') ||
              'No address on file'}
          </div>
        </div>
        <AddEquipmentDialog customerId={customerId} locationId={locationId} />
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Equipment ({equipment?.length ?? 0})
      </h2>

      {!equipment?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Fan className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-1">No equipment at this location yet.</p>
            <p className="text-sm text-gray-400">
              Add the mechanical assets you service here — they become the checklist for
              inspection reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="divide-y">
              {equipment.map((eq: DbRow) => (
                <div key={eq.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {eq.name}
                      <span className="text-gray-500 font-normal">
                        {' '}— {TYPE_LABELS[eq.equipment_type] ?? eq.equipment_type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {[
                        eq.manufacturer,
                        eq.model,
                        eq.capacity_rating,
                        eq.serial_number && `S/N ${eq.serial_number}`,
                        eq.location_detail,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {eq.trade && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRADE_COLORS[eq.trade as Trade]}`}
                      >
                        {TRADE_LABELS[eq.trade as Trade]}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {eq.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
