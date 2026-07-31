'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { EQUIPMENT_TYPES, TRADE_LABELS } from '@/types/database'
import type { Trade } from '@/types/database'

export default function AddEquipmentDialog({
  customerId,
  locationId,
}: {
  customerId: string
  locationId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const [trade, setTrade] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [capacityRating, setCapacityRating] = useState('')
  const [locationDetail, setLocationDetail] = useState('')

  function handleTypeChange(v: string) {
    setEquipmentType(v)
    // default the trade from the equipment taxonomy
    const entry = EQUIPMENT_TYPES.find((t) => t.value === v)
    if (entry) setTrade(entry.trade)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Equipment tag / name is required')
      return
    }
    if (!equipmentType) {
      toast.error('Equipment type is required')
      return
    }
    setLoading(true)

    const { error } = await supabase.from('equipment').insert({
      customer_id: customerId,
      location_id: locationId,
      name,
      equipment_type: equipmentType,
      trade: trade || null,
      manufacturer: manufacturer || null,
      model: model || null,
      serial_number: serialNumber || null,
      capacity_rating: capacityRating || null,
      location_detail: locationDetail || null,
      status: 'active',
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Equipment added')
    setOpen(false)
    setName('')
    setEquipmentType('')
    setTrade('')
    setManufacturer('')
    setModel('')
    setSerialNumber('')
    setCapacityRating('')
    setLocationDetail('')
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-ink hover:bg-ink-hover text-white font-semibold"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Equipment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Equipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eqName">Tag / Name *</Label>
              <Input
                id="eqName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AHU-3"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <Select value={equipmentType} onValueChange={(v) => handleTypeChange(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Trade</Label>
              <Select value={trade} onValueChange={(v) => setTrade(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trade..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TRADE_LABELS) as [Trade, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="eqCapacity">Capacity</Label>
              <Input
                id="eqCapacity"
                value={capacityRating}
                onChange={(e) => setCapacityRating(e.target.value)}
                placeholder="15,000 CFM / 450 tons"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eqMfr">Manufacturer</Label>
              <Input
                id="eqMfr"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Trane, Carrier..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eqModel">Model</Label>
              <Input
                id="eqModel"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="eqSerial">Serial Number</Label>
              <Input
                id="eqSerial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eqLocDetail">Location Detail</Label>
              <Input
                id="eqLocDetail"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="Penthouse, Room 101..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-ink hover:bg-ink-hover text-white font-semibold"
            >
              {loading ? 'Adding...' : 'Add Equipment'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
