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
import {
  PROJECT_PHASE_LABELS,
  PROJECT_MARKET_LABELS,
  TRADE_LABELS,
} from '@/types/database'
import type { ProjectPhase, ProjectMarket, Trade } from '@/types/database'

export default function AddProjectDialog() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [generalContractor, setGeneralContractor] = useState('')
  const [city, setCity] = useState('Boston')
  const [market, setMarket] = useState('')
  const [phase, setPhase] = useState('preconstruction')
  const [trades, setTrades] = useState<Trade[]>([])
  const [contractValue, setContractValue] = useState('')
  const [bimModelUrl, setBimModelUrl] = useState('')

  function toggleTrade(t: Trade) {
    setTrades((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Project name is required')
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

    const { error } = await supabase.from('projects').insert({
      org_id: profile.org_id,
      name,
      project_number: projectNumber || null,
      general_contractor: generalContractor || null,
      city: city || null,
      market: market || null,
      phase,
      trades: trades.length ? trades : null,
      contract_value_cents: contractValue
        ? Math.round(parseFloat(contractValue) * 100)
        : null,
      bim_model_url: bimModelUrl || null,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Project created')
    setOpen(false)
    setName('')
    setProjectNumber('')
    setGeneralContractor('')
    setMarket('')
    setTrades([])
    setContractValue('')
    setBimModelUrl('')
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-ink hover:bg-ink-hover text-white font-semibold"
      >
        <Plus className="h-4 w-4 mr-2" />
        New Project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="projName">Project Name *</Label>
            <Input
              id="projName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kendall Square Lab Tower"
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="projNumber">Project #</Label>
              <Input
                id="projNumber"
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder="26-104"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="projGC">General Contractor</Label>
              <Input
                id="projGC"
                value={generalContractor}
                onChange={(e) => setGeneralContractor(e.target.value)}
                placeholder="Turner, Suffolk..."
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="projCity">City</Label>
              <Input
                id="projCity"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Market</Label>
              <Select value={market} onValueChange={(v) => setMarket(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select market..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROJECT_MARKET_LABELS) as [ProjectMarket, string][]).map(
                    ([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Trades</Label>
            <div className="flex gap-2">
              {(Object.entries(TRADE_LABELS) as [Trade, string][]).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleTrade(val)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    trades.includes(val)
                      ? 'bg-ink border-ink text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Phase</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v ?? 'preconstruction')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROJECT_PHASE_LABELS) as [ProjectPhase, string][]).map(
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
              <Label htmlFor="projValue">Contract Value ($)</Label>
              <Input
                id="projValue"
                type="number"
                min="0"
                step="1000"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="12500000"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="projBim">BIM Model URL</Label>
            <Input
              id="projBim"
              type="url"
              value={bimModelUrl}
              onChange={(e) => setBimModelUrl(e.target.value)}
              placeholder="https://acc.autodesk.com/..."
            />
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
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
