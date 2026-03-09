'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronUp, Save } from 'lucide-react'
import { NFPA70B_PARAMETERS, INFRARED_PARAMETERS } from '@/types/database'
import type { Asset, TestReading, ReportType } from '@/types/database'

type ReadingResult = 'pass' | 'fail' | 'marginal' | 'n/a'

interface LocalReading {
  id?: string
  parameter: string
  value: string
  unit: string
  result: ReadingResult | ''
  notes: string
}

interface LocalAsset {
  id?: string
  name: string
  equipment_type: string
  manufacturer: string
  model: string
  serial_number: string
  location: string
  install_date: string
  readings: LocalReading[]
  expanded: boolean
  saving: boolean
}

function defaultReadings(reportType: string | null): LocalReading[] {
  const params = reportType === 'nfpa_70b'
    ? NFPA70B_PARAMETERS
    : reportType === 'infrared'
    ? INFRARED_PARAMETERS
    : []
  return params.map(p => ({ parameter: p.parameter, value: '', unit: p.unit, result: '', notes: '' }))
}

function assetToLocal(a: Asset & { test_readings: TestReading[] }): LocalAsset {
  return {
    id: a.id,
    name: a.name,
    equipment_type: a.equipment_type ?? '',
    manufacturer: a.manufacturer ?? '',
    model: a.model ?? '',
    serial_number: a.serial_number ?? '',
    location: a.location ?? '',
    install_date: a.install_date ?? '',
    expanded: true,
    saving: false,
    readings: a.test_readings.map(r => ({
      id: r.id,
      parameter: r.parameter,
      value: r.value ?? '',
      unit: r.unit ?? '',
      result: (r.result as ReadingResult) ?? '',
      notes: r.notes ?? '',
    })),
  }
}

const resultColors: Record<ReadingResult, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  marginal: 'bg-orange-100 text-orange-700',
  'n/a': 'bg-gray-100 text-gray-600',
}

export default function AssetsEditor({
  reportId,
  reportType,
  initialAssets,
}: {
  reportId: string
  reportType: string | null
  initialAssets: (Asset & { test_readings: TestReading[] })[]
}) {
  const [assets, setAssets] = useState<LocalAsset[]>(initialAssets.map(assetToLocal))
  const supabase = createClient()

  function addAsset() {
    setAssets(prev => [...prev, {
      name: '',
      equipment_type: '',
      manufacturer: '',
      model: '',
      serial_number: '',
      location: '',
      install_date: '',
      expanded: true,
      saving: false,
      readings: defaultReadings(reportType),
    }])
  }

  function updateAsset(idx: number, field: keyof LocalAsset, value: unknown) {
    setAssets(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  function updateReading(assetIdx: number, readingIdx: number, field: keyof LocalReading, value: string) {
    setAssets(prev => prev.map((a, i) => {
      if (i !== assetIdx) return a
      return {
        ...a,
        readings: a.readings.map((r, j) => j === readingIdx ? { ...r, [field]: value } : r),
      }
    }))
  }

  function addReading(assetIdx: number) {
    setAssets(prev => prev.map((a, i) => {
      if (i !== assetIdx) return a
      return { ...a, readings: [...a.readings, { parameter: '', value: '', unit: '', result: '', notes: '' }] }
    }))
  }

  function removeReading(assetIdx: number, readingIdx: number) {
    setAssets(prev => prev.map((a, i) => {
      if (i !== assetIdx) return a
      return { ...a, readings: a.readings.filter((_, j) => j !== readingIdx) }
    }))
  }

  async function saveAsset(idx: number) {
    const asset = assets[idx]
    if (!asset.name.trim()) {
      toast.error('Asset name is required')
      return
    }
    updateAsset(idx, 'saving', true)

    let assetId = asset.id

    if (assetId) {
      // Update existing
      const { error } = await supabase.from('assets').update({
        name: asset.name,
        equipment_type: asset.equipment_type || null,
        manufacturer: asset.manufacturer || null,
        model: asset.model || null,
        serial_number: asset.serial_number || null,
        location: asset.location || null,
        install_date: asset.install_date || null,
        sort_order: idx,
      }).eq('id', assetId)
      if (error) { toast.error(error.message); updateAsset(idx, 'saving', false); return }
    } else {
      // Insert new
      const { data, error } = await supabase.from('assets').insert({
        report_id: reportId,
        name: asset.name,
        equipment_type: asset.equipment_type || null,
        manufacturer: asset.manufacturer || null,
        model: asset.model || null,
        serial_number: asset.serial_number || null,
        location: asset.location || null,
        install_date: asset.install_date || null,
        sort_order: idx,
      }).select().single()
      if (error) { toast.error(error.message); updateAsset(idx, 'saving', false); return }
      assetId = data.id
      setAssets(prev => prev.map((a, i) => i === idx ? { ...a, id: data.id } : a))
    }

    // Upsert readings
    for (const reading of asset.readings) {
      if (!reading.parameter.trim()) continue
      if (reading.id) {
        await supabase.from('test_readings').update({
          parameter: reading.parameter,
          value: reading.value || null,
          unit: reading.unit || null,
          result: reading.result || null,
          notes: reading.notes || null,
        }).eq('id', reading.id)
      } else {
        const { data: rd } = await supabase.from('test_readings').insert({
          asset_id: assetId,
          report_id: reportId,
          parameter: reading.parameter,
          value: reading.value || null,
          unit: reading.unit || null,
          result: reading.result || null,
          notes: reading.notes || null,
        }).select().single()
        if (rd) {
          setAssets(prev => prev.map((a, i) => {
            if (i !== idx) return a
            return {
              ...a,
              readings: a.readings.map(r =>
                r === reading ? { ...r, id: rd.id } : r
              ),
            }
          }))
        }
      }
    }

    updateAsset(idx, 'saving', false)
    toast.success(`${asset.name} saved`)
  }

  async function removeAsset(idx: number) {
    const asset = assets[idx]
    if (asset.id) {
      const { error } = await supabase.from('assets').delete().eq('id', asset.id)
      if (error) { toast.error(error.message); return }
    }
    setAssets(prev => prev.filter((_, i) => i !== idx))
    toast.success('Asset removed')
  }

  return (
    <div className="space-y-4">
      {assets.map((asset, idx) => (
        <Card key={asset.id ?? `new-${idx}`}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateAsset(idx, 'expanded', !asset.expanded)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {asset.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <CardTitle className="text-base">
                  {asset.name || <span className="text-gray-400 font-normal">New Asset</span>}
                </CardTitle>
                {asset.id && <Badge variant="outline" className="text-xs">Saved</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveAsset(idx)}
                  disabled={asset.saving}
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {asset.saving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAsset(idx)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {asset.expanded && (
            <CardContent className="space-y-4">
              {/* Asset Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Asset Name *</Label>
                  <Input value={asset.name} onChange={e => updateAsset(idx, 'name', e.target.value)} placeholder="Main Panel MDP-1" />
                </div>
                <div className="space-y-1">
                  <Label>Equipment Type</Label>
                  <Input value={asset.equipment_type} onChange={e => updateAsset(idx, 'equipment_type', e.target.value)} placeholder="Circuit Breaker, Transformer…" />
                </div>
                <div className="space-y-1">
                  <Label>Manufacturer</Label>
                  <Input value={asset.manufacturer} onChange={e => updateAsset(idx, 'manufacturer', e.target.value)} placeholder="Eaton, Siemens, GE…" />
                </div>
                <div className="space-y-1">
                  <Label>Model</Label>
                  <Input value={asset.model} onChange={e => updateAsset(idx, 'model', e.target.value)} placeholder="Model number" />
                </div>
                <div className="space-y-1">
                  <Label>Serial Number</Label>
                  <Input value={asset.serial_number} onChange={e => updateAsset(idx, 'serial_number', e.target.value)} placeholder="S/N" />
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  <Input value={asset.location} onChange={e => updateAsset(idx, 'location', e.target.value)} placeholder="Room 101, Building A…" />
                </div>
              </div>

              {/* Readings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Test Readings</Label>
                  <Button size="sm" variant="outline" onClick={() => addReading(idx)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Row
                  </Button>
                </div>
                {asset.readings.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No readings yet. Click &quot;Add Row&quot; to begin.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-gray-500">
                          <th className="text-left pb-2 font-medium w-[35%]">Parameter</th>
                          <th className="text-left pb-2 font-medium w-[20%]">Value</th>
                          <th className="text-left pb-2 font-medium w-[15%]">Unit</th>
                          <th className="text-left pb-2 font-medium w-[20%]">Result</th>
                          <th className="pb-2 w-[10%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {asset.readings.map((reading, rIdx) => (
                          <tr key={reading.id ?? `r-${rIdx}`} className="border-b last:border-0">
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.parameter}
                                onChange={e => updateReading(idx, rIdx, 'parameter', e.target.value)}
                                placeholder="Parameter name"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.value}
                                onChange={e => updateReading(idx, rIdx, 'value', e.target.value)}
                                placeholder="Value"
                                className="h-8 text-sm font-mono"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.unit}
                                onChange={e => updateReading(idx, rIdx, 'unit', e.target.value)}
                                placeholder="Unit"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Select
                                value={reading.result}
                                onValueChange={v => updateReading(idx, rIdx, 'result', v ?? '')}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(['pass', 'fail', 'marginal', 'n/a'] as ReadingResult[]).map(r => (
                                    <SelectItem key={r} value={r}>
                                      <span className={`px-1.5 py-0.5 rounded text-xs ${resultColors[r]}`}>
                                        {r.toUpperCase()}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1">
                              <button
                                type="button"
                                onClick={() => removeReading(idx, rIdx)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addAsset}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Asset
      </Button>
    </div>
  )
}
