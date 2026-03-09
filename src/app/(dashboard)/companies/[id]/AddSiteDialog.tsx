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

export default function AddSiteDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const { error } = await supabase.from('sites').insert({
      company_id: companyId,
      name: form.get('name') as string,
      address: form.get('address') as string || null,
      city: form.get('city') as string || null,
      state: form.get('state') as string || null,
      zip: form.get('zip') as string || null,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Site added')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Site
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Site / Location</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label htmlFor="name">Site Name *</Label>
            <Input id="name" name="name" placeholder="Main Plant - Building A" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="123 Industrial Blvd" />
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
              {loading ? 'Saving…' : 'Add Site'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
