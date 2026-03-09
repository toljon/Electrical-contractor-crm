'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export default function AddCompanyDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('companies').insert({
      owner_id: user.id,
      name: form.get('name') as string,
      address: form.get('address') as string || null,
      city: form.get('city') as string || null,
      state: form.get('state') as string || null,
      zip: form.get('zip') as string || null,
      contact_name: form.get('contact_name') as string || null,
      contact_email: form.get('contact_email') as string || null,
      contact_phone: form.get('contact_phone') as string || null,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Company added')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
        <Plus className="h-4 w-4 mr-2" />
        Add Company
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="name">Company Name *</Label>
            <Input id="name" name="name" placeholder="Acme Electric" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" name="contact_name" placeholder="John Smith" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input id="contact_phone" name="contact_phone" placeholder="(555) 000-0000" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input id="contact_email" name="contact_email" type="email" placeholder="john@acme.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Street Address</Label>
            <Input id="address" name="address" placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" placeholder="Dallas" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="TX" maxLength={2} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" placeholder="75001" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900">
              {loading ? 'Saving…' : 'Add Company'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
