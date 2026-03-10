'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, Plus, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { ReadingResult } from '@/types/database'

interface EquipmentItem {
  id: string
  name: string
  equipment_type: string
}

interface LocalReading {
  id?: string
  parameter: string
  value: string
  unit: string
  result: ReadingResult | ''
}

interface EquipmentWithReadings {
  equipment: EquipmentItem
  readings: LocalReading[]
  saving: boolean
}

const resultColors: Record<ReadingResult, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  marginal: 'bg-orange-100 text-orange-700',
  'n/a': 'bg-gray-100 text-gray-600',
}

export default function ReadingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: reportId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [equipmentList, setEquipmentList] = useState<EquipmentWithReadings[]>(
    []
  )
  const [loadingInit, setLoadingInit] = useState(true)

  // Load equipment and existing readings on mount
  useEffect(() => {
    async function loadData() {
      // First get the report to find its location_id
      const { data: report } = await supabase
        .from('inspection_reports')
        .select('location_id, org_id')
        .eq('id', reportId)
        .single()

      if (!report?.location_id) {
        setLoadingInit(false)
        return
      }

      // Fetch equipment at that location
      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name, equipment_type')
        .eq('location_id', report.location_id)
        .eq('status', 'active')
        .order('sort_order')

      if (!equipment || equipment.length === 0) {
        setLoadingInit(false)
        return
      }

      // Fetch existing readings for this report
      const { data: existingReadings } = await supabase
        .from('test_readings')
        .select('*')
        .eq('report_id', reportId)
        .order('sort_order')

      // Map equipment with their existing readings
      const mapped: EquipmentWithReadings[] = equipment.map((eq) => {
        const eqReadings = (existingReadings ?? [])
          .filter((r) => r.equipment_id === eq.id)
          .map((r) => ({
            id: r.id,
            parameter: r.parameter,
            value: r.value ?? '',
            unit: r.unit ?? '',
            result: (r.result as ReadingResult) ?? '',
          }))
        return {
          equipment: eq,
          readings: eqReadings,
          saving: false,
        }
      })

      setEquipmentList(mapped)
      setLoadingInit(false)
    }
    loadData()
  }, [reportId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addReading(eqIdx: number) {
    setEquipmentList((prev) =>
      prev.map((item, i) => {
        if (i !== eqIdx) return item
        return {
          ...item,
          readings: [
            ...item.readings,
            { parameter: '', value: '', unit: '', result: '' },
          ],
        }
      })
    )
  }

  function updateReading(
    eqIdx: number,
    rIdx: number,
    field: keyof LocalReading,
    value: string
  ) {
    setEquipmentList((prev) =>
      prev.map((item, i) => {
        if (i !== eqIdx) return item
        return {
          ...item,
          readings: item.readings.map((r, j) =>
            j === rIdx ? { ...r, [field]: value } : r
          ),
        }
      })
    )
  }

  function removeReading(eqIdx: number, rIdx: number) {
    const reading = equipmentList[eqIdx].readings[rIdx]
    if (reading.id) {
      // Delete from DB
      supabase
        .from('test_readings')
        .delete()
        .eq('id', reading.id)
        .then(({ error }) => {
          if (error) toast.error(error.message)
        })
    }
    setEquipmentList((prev) =>
      prev.map((item, i) => {
        if (i !== eqIdx) return item
        return {
          ...item,
          readings: item.readings.filter((_, j) => j !== rIdx),
        }
      })
    )
  }

  async function saveEquipmentReadings(eqIdx: number) {
    const item = equipmentList[eqIdx]

    setEquipmentList((prev) =>
      prev.map((it, i) => (i === eqIdx ? { ...it, saving: true } : it))
    )

    // Get org_id
    const { data: report } = await supabase
      .from('inspection_reports')
      .select('org_id')
      .eq('id', reportId)
      .single()

    const orgId = report?.org_id

    for (let rIdx = 0; rIdx < item.readings.length; rIdx++) {
      const reading = item.readings[rIdx]
      if (!reading.parameter.trim()) continue

      if (reading.id) {
        // Update
        await supabase
          .from('test_readings')
          .update({
            parameter: reading.parameter,
            value: reading.value || null,
            unit: reading.unit || null,
            result: reading.result || null,
            sort_order: rIdx,
          })
          .eq('id', reading.id)
      } else {
        // Insert
        const { data: rd } = await supabase
          .from('test_readings')
          .insert({
            org_id: orgId,
            report_id: reportId,
            equipment_id: item.equipment.id,
            parameter: reading.parameter,
            value: reading.value || null,
            unit: reading.unit || null,
            result: reading.result || null,
            sort_order: rIdx,
          })
          .select()
          .single()

        if (rd) {
          setEquipmentList((prev) =>
            prev.map((it, i) => {
              if (i !== eqIdx) return it
              return {
                ...it,
                readings: it.readings.map((r, j) =>
                  j === rIdx ? { ...r, id: rd.id } : r
                ),
              }
            })
          )
        }
      }
    }

    setEquipmentList((prev) =>
      prev.map((it, i) => (i === eqIdx ? { ...it, saving: false } : it))
    )
    toast.success(`Readings saved for ${item.equipment.name}`)
  }

  if (loadingInit) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Loading equipment...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href={`/reports/${reportId}`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Report
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Readings</h1>
          <p className="text-gray-500 mt-1">
            Record test measurements for each piece of equipment at this
            location.
          </p>
        </div>
        <Link href={`/reports/${reportId}/findings`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            Continue to Findings
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      {equipmentList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-2">
              No equipment found at this location.
            </p>
            <p className="text-sm text-gray-400">
              Add equipment to the location first, then come back to enter
              readings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {equipmentList.map((item, eqIdx) => (
            <Card key={item.equipment.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      {item.equipment.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {item.equipment.equipment_type}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveEquipmentReadings(eqIdx)}
                    disabled={item.saving}
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {item.saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {item.readings.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">
                    No readings yet. Click &quot;Add Reading&quot; to begin.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-gray-500">
                          <th className="text-left pb-2 font-medium w-[35%]">
                            Parameter
                          </th>
                          <th className="text-left pb-2 font-medium w-[20%]">
                            Value
                          </th>
                          <th className="text-left pb-2 font-medium w-[15%]">
                            Unit
                          </th>
                          <th className="text-left pb-2 font-medium w-[20%]">
                            Result
                          </th>
                          <th className="pb-2 w-[10%]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.readings.map((reading, rIdx) => (
                          <tr
                            key={reading.id ?? `r-${rIdx}`}
                            className="border-b last:border-0"
                          >
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.parameter}
                                onChange={(e) =>
                                  updateReading(
                                    eqIdx,
                                    rIdx,
                                    'parameter',
                                    e.target.value
                                  )
                                }
                                placeholder="Parameter name"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.value}
                                onChange={(e) =>
                                  updateReading(
                                    eqIdx,
                                    rIdx,
                                    'value',
                                    e.target.value
                                  )
                                }
                                placeholder="Value"
                                className="h-8 text-sm font-mono"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Input
                                value={reading.unit}
                                onChange={(e) =>
                                  updateReading(
                                    eqIdx,
                                    rIdx,
                                    'unit',
                                    e.target.value
                                  )
                                }
                                placeholder="Unit"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <Select
                                value={reading.result}
                                onValueChange={(v) =>
                                  updateReading(
                                    eqIdx,
                                    rIdx,
                                    'result',
                                    v ?? ''
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="--" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    [
                                      'pass',
                                      'fail',
                                      'marginal',
                                      'n/a',
                                    ] as ReadingResult[]
                                  ).map((r) => (
                                    <SelectItem key={r} value={r}>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-xs ${resultColors[r]}`}
                                      >
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
                                onClick={() => removeReading(eqIdx, rIdx)}
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
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addReading(eqIdx)}
                    className="border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Reading
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex justify-end mt-8">
        <Link href={`/reports/${reportId}/findings`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            Continue to Findings
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
