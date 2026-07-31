'use client'

import { useState, useEffect } from 'react'
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
import { ASSEMBLY_TYPE_LABELS, TRADE_LABELS } from '@/types/database'
import type { AssemblyType, Trade } from '@/types/database'

interface ProjectOption {
  id: string
  name: string
}

export default function AddAssemblyDialog() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const [projectId, setProjectId] = useState('')
  const [assemblyNumber, setAssemblyNumber] = useState('')
  const [name, setName] = useState('')
  const [assemblyType, setAssemblyType] = useState('pipe_spool')
  const [trade, setTrade] = useState('')
  const [bimReference, setBimReference] = useState('')
  const [installLocation, setInstallLocation] = useState('')
  const [shopHoursEstimated, setShopHoursEstimated] = useState('')
  const [scheduledShipDate, setScheduledShipDate] = useState('')
  const [hoursSuggestion, setHoursSuggestion] = useState<{ median: number; n: number } | null>(null)

  // Data-driven estimating: suggest shop hours from historical actuals
  // of the same assembly type (and trade, when selected).
  useEffect(() => {
    if (!open || !assemblyType) return
    let cancelled = false
    async function loadSuggestion() {
      let query = supabase
        .from('prefab_assemblies')
        .select('shop_hours_actual')
        .eq('assembly_type', assemblyType)
        .not('shop_hours_actual', 'is', null)
      if (trade) query = query.eq('trade', trade)
      const { data } = await query
      if (cancelled) return
      const actuals = ((data ?? []) as Array<{ shop_hours_actual: number }>)
        .map((r) => r.shop_hours_actual)
        .filter((h) => h != null)
        .sort((a, b) => a - b)
      if (actuals.length < 3) {
        setHoursSuggestion(null)
        return
      }
      const mid = Math.floor(actuals.length / 2)
      const median =
        actuals.length % 2 ? actuals[mid] : (actuals[mid - 1] + actuals[mid]) / 2
      setHoursSuggestion({ median: Math.round(median * 10) / 10, n: actuals.length })
    }
    loadSuggestion()
    return () => {
      cancelled = true
    }
  }, [open, assemblyType, trade]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    async function loadProjects() {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')
      setProjects(data ?? [])
    }
    loadProjects()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) {
      toast.error('Project is required')
      return
    }
    if (!assemblyNumber.trim()) {
      toast.error('Assembly number is required')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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

    const { error } = await supabase.from('prefab_assemblies').insert({
      org_id: profile.org_id,
      project_id: projectId,
      assembly_number: assemblyNumber,
      name: name || null,
      assembly_type: assemblyType,
      trade: trade || null,
      bim_reference: bimReference || null,
      install_location: installLocation || null,
      shop_hours_estimated: shopHoursEstimated
        ? parseFloat(shopHoursEstimated)
        : null,
      scheduled_ship_date: scheduledShipDate || null,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Assembly added')
    setOpen(false)
    setAssemblyNumber('')
    setName('')
    setBimReference('')
    setInstallLocation('')
    setShopHoursEstimated('')
    setScheduledShipDate('')
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-ink hover:bg-ink-hover text-white font-semibold"
      >
        <Plus className="h-4 w-4 mr-2" />
        New Assembly
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Prefab Assembly</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="asmNumber">Assembly # *</Label>
              <Input
                id="asmNumber"
                value={assemblyNumber}
                onChange={(e) => setAssemblyNumber(e.target.value)}
                placeholder="SP-L3-014"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="asmName">Name</Label>
              <Input
                id="asmName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CHW riser, Level 3"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={assemblyType} onValueChange={(v) => setAssemblyType(v ?? 'pipe_spool')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ASSEMBLY_TYPE_LABELS) as [AssemblyType, string][]).map(
                    ([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="asmBim">BIM Reference</Label>
              <Input
                id="asmBim"
                value={bimReference}
                onChange={(e) => setBimReference(e.target.value)}
                placeholder="Revit element / spool dwg"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="asmLoc">Install Location</Label>
              <Input
                id="asmLoc"
                value={installLocation}
                onChange={(e) => setInstallLocation(e.target.value)}
                placeholder="Level 3, Zone B"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="asmHours">Est. Shop Hours</Label>
              <Input
                id="asmHours"
                type="number"
                min="0"
                step="0.5"
                value={shopHoursEstimated}
                onChange={(e) => setShopHoursEstimated(e.target.value)}
                placeholder={hoursSuggestion ? String(hoursSuggestion.median) : '16'}
              />
              {hoursSuggestion && (
                <button
                  type="button"
                  onClick={() => setShopHoursEstimated(String(hoursSuggestion.median))}
                  className="text-xs text-brand-ink hover:underline text-left"
                >
                  Shop median: {hoursSuggestion.median}h across {hoursSuggestion.n} completed —
                  use it
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="asmShip">Scheduled Ship Date</Label>
              <Input
                id="asmShip"
                type="date"
                value={scheduledShipDate}
                onChange={(e) => setScheduledShipDate(e.target.value)}
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
              {loading ? 'Adding...' : 'Add Assembly'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
