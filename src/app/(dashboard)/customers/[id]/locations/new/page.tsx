'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function NewLocationPage() {
  const { id: customerId } = useParams<{ id: string }>()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [siteContact, setSiteContact] = useState('')
  const [sitePhone, setSitePhone] = useState('')
  const [accessNotes, setAccessNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Location name is required')
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

    const { error } = await supabase
      .from('locations')
      .insert({
        org_id: profile.org_id,
        customer_id: customerId,
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        site_contact: siteContact.trim() || null,
        site_phone: sitePhone.trim() || null,
        access_notes: accessNotes.trim() || null,
      })

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Location added')
      router.push(`/customers/${customerId}`)
    }
  }

  return (
    <div className="p-8">
      <Link
        href={`/customers/${customerId}`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customer
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Location</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main Campus — Building A"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="456 Industrial Blvd"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1 col-span-2 md:col-span-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Boston"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="MA"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="zip">Zip</Label>
                <Input
                  id="zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="02101"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="siteContact">Site Contact</Label>
                <Input
                  id="siteContact"
                  value={siteContact}
                  onChange={(e) => setSiteContact(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sitePhone">Site Phone</Label>
                <Input
                  id="sitePhone"
                  value={sitePhone}
                  onChange={(e) => setSitePhone(e.target.value)}
                  placeholder="(617) 555-0123"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="accessNotes">Access Notes</Label>
              <Textarea
                id="accessNotes"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                placeholder="Gate code, parking instructions, PPE requirements..."
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
                {loading ? 'Adding...' : 'Add Location'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
