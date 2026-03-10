'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NewCustomerPage() {
  const [name, setName] = useState('')
  const [dba, setDba] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('net30')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingState, setBillingState] = useState('')
  const [billingZip, setBillingZip] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Customer name is required')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      toast.error('No organization found. Please complete setup first.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        org_id: profile.org_id,
        name: name.trim(),
        dba: dba.trim() || null,
        customer_type: customerType || null,
        payment_terms: paymentTerms,
        billing_address: billingAddress.trim() || null,
        billing_city: billingCity.trim() || null,
        billing_state: billingState.trim() || null,
        billing_zip: billingZip.trim() || null,
        notes: notes.trim() || null,
        status: 'active',
      })
      .select()
      .single()

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Customer created')
      router.push(`/customers/${data.id}`)
    }
  }

  return (
    <div className="p-8">
      <Link href="/customers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Customer</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Electric Corp"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dba">DBA (Doing Business As)</Label>
                <Input
                  id="dba"
                  value={dba}
                  onChange={(e) => setDba(e.target.value)}
                  placeholder="Optional alternate name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer Type</Label>
                <Select value={customerType} onValueChange={(v) => setCustomerType(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="utility">Utility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={(v) => setPaymentTerms(v ?? 'net30')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select terms..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="billingAddress">Billing Address</Label>
              <Input
                id="billingAddress"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 col-span-2 md:col-span-2">
                <Label htmlFor="billingCity">City</Label>
                <Input
                  id="billingCity"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="Boston"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="billingState">State</Label>
                <Input
                  id="billingState"
                  value={billingState}
                  onChange={(e) => setBillingState(e.target.value)}
                  placeholder="MA"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="billingZip">Zip</Label>
                <Input
                  id="billingZip"
                  value={billingZip}
                  onChange={(e) => setBillingZip(e.target.value)}
                  placeholder="02101"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this customer..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                {loading ? 'Creating...' : 'Create Customer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
