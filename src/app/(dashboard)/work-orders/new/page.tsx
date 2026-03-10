'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface Customer {
  id: string
  name: string
}

interface Location {
  id: string
  name: string
  customer_id: string
}

interface Technician {
  id: string
  full_name: string | null
}

export default function NewWorkOrderPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <NewWorkOrderForm />
    </Suspense>
  )
}

function NewWorkOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)

  const [customerId, setCustomerId] = useState(searchParams.get('customerId') ?? '')
  const [locationId, setLocationId] = useState('')
  const [workType, setWorkType] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('normal')
  const [specialInstructions, setSpecialInstructions] = useState('')

  // Load customers on mount
  useEffect(() => {
    async function loadCustomers() {
      const { data } = await supabase
        .from('customers')
        .select('id, name')
        .order('name')
      setCustomers(data ?? [])
    }
    loadCustomers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load locations when customer changes
  useEffect(() => {
    async function loadLocations() {
      if (!customerId) {
        setLocations([])
        return
      }
      const { data } = await supabase
        .from('locations')
        .select('id, name, customer_id')
        .eq('customer_id', customerId)
        .order('name')
      setLocations(data ?? [])
    }
    loadLocations()
  }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load technicians on mount
  useEffect(() => {
    async function loadTechnicians() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'technician')
        .order('full_name')
      setTechnicians(data ?? [])
    }
    loadTechnicians()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!customerId) {
      toast.error('Please select a customer')
      return
    }
    if (!workType) {
      toast.error('Please select a work type')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get the user's org_id from their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      toast.error('No organization found for your account')
      setLoading(false)
      return
    }

    // Generate order number: WO-YYYYMMDD-XXXX
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const orderNumber = `WO-${today}-${Math.floor(1000 + Math.random() * 9000)}`

    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        org_id: profile.org_id,
        customer_id: customerId,
        location_id: locationId || null,
        assigned_to: assignedTo || null,
        order_number: orderNumber,
        work_type: workType,
        status: assignedTo ? 'assigned' : 'created',
        scheduled_date: scheduledDate || null,
        priority,
        special_instructions: specialInstructions || null,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Work order created')
      router.push(`/work-orders/${data.id}`)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/work-orders"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Work Orders
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Work Order</h1>
      <p className="text-gray-500 mb-8">
        Create a work order to schedule and track field work.
      </p>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Customer & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer *</Label>
                <Select
                  value={customerId}
                  onValueChange={(v) => {
                    setCustomerId(v ?? '')
                    setLocationId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Select
                  value={locationId}
                  onValueChange={(v) => setLocationId(v ?? '')}
                  disabled={!customerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Work Type *</Label>
                <Select value={workType} onValueChange={(v) => setWorkType(v ?? 'inspection')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select work type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? 'normal')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scheduled Date & Assigned To */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="scheduledDate">Scheduled Date</Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Assigned Technician</Label>
                <Select
                  value={assignedTo}
                  onValueChange={(v) => setAssignedTo(v ?? '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name ?? 'Unnamed'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Access codes, safety notes, specific requirements..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/work-orders')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                {loading ? 'Creating...' : 'Create Work Order'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
