'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Upload,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { SEVERITY_LABELS } from '@/types/database'
import type { FindingSeverity } from '@/types/database'

interface EquipmentOption {
  id: string
  name: string
}

interface LocalPhoto {
  id: string
  storage_path: string
  caption: string | null
}

interface LocalFinding {
  id?: string
  severity: FindingSeverity | ''
  description: string
  standardRef: string
  recommendation: string
  equipmentId: string
  saving: boolean
  photos: LocalPhoto[]
}

const severityColors: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  observation: 'bg-blue-100 text-blue-700',
}

export default function FindingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: reportId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [findings, setFindings] = useState<LocalFinding[]>([])
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [completing, setCompleting] = useState(false)

  // Load existing findings and equipment on mount
  useEffect(() => {
    async function loadData() {
      // Get report to find location
      const { data: report } = await supabase
        .from('inspection_reports')
        .select('location_id')
        .eq('id', reportId)
        .single()

      // Fetch equipment at the location
      if (report?.location_id) {
        const { data: eq } = await supabase
          .from('equipment')
          .select('id, name')
          .eq('location_id', report.location_id)
          .eq('status', 'active')
          .order('sort_order')
        setEquipment(eq ?? [])
      }

      // Fetch existing findings with photos
      const { data: existingFindings } = await supabase
        .from('findings')
        .select('*')
        .eq('report_id', reportId)
        .order('sort_order')

      // Fetch photos for all findings
      const findingIds = (existingFindings ?? [])
        .map((f) => f.id)
        .filter(Boolean)
      let photosMap: Record<string, LocalPhoto[]> = {}
      if (findingIds.length > 0) {
        const { data: photos } = await supabase
          .from('photos')
          .select('id, finding_id, storage_path, caption')
          .in('finding_id', findingIds)
        if (photos) {
          for (const p of photos) {
            const fid = p.finding_id as string
            if (!photosMap[fid]) photosMap[fid] = []
            photosMap[fid].push({
              id: p.id,
              storage_path: p.storage_path,
              caption: p.caption,
            })
          }
        }
      }

      if (existingFindings) {
        setFindings(
          existingFindings.map((f) => ({
            id: f.id,
            severity: (f.severity as FindingSeverity) ?? '',
            description: f.description ?? '',
            standardRef: f.standard_ref ?? '',
            recommendation: f.recommendation ?? '',
            equipmentId: f.equipment_id ?? '',
            saving: false,
            photos: photosMap[f.id] ?? [],
          }))
        )
      }

      setLoadingInit(false)
    }
    loadData()
  }, [reportId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addFinding() {
    setFindings((prev) => [
      ...prev,
      {
        severity: '',
        description: '',
        standardRef: '',
        recommendation: '',
        equipmentId: '',
        saving: false,
        photos: [],
      },
    ])
  }

  function updateFinding(
    idx: number,
    field: keyof LocalFinding,
    value: string | boolean
  ) {
    setFindings((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f))
    )
  }

  async function saveFinding(idx: number) {
    const finding = findings[idx]
    if (!finding.severity) {
      toast.error('Severity is required')
      return
    }
    if (!finding.description.trim()) {
      toast.error('Description is required')
      return
    }

    updateFinding(idx, 'saving', true)

    // Get org_id
    const { data: report } = await supabase
      .from('inspection_reports')
      .select('org_id')
      .eq('id', reportId)
      .single()

    const payload = {
      report_id: reportId,
      org_id: report?.org_id,
      severity: finding.severity,
      description: finding.description,
      standard_ref: finding.standardRef || null,
      recommendation: finding.recommendation || null,
      equipment_id: finding.equipmentId || null,
      sort_order: idx,
    }

    if (finding.id) {
      const { error } = await supabase
        .from('findings')
        .update(payload)
        .eq('id', finding.id)
      updateFinding(idx, 'saving', false)
      if (error) {
        toast.error(error.message)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('findings')
        .insert(payload)
        .select()
        .single()
      updateFinding(idx, 'saving', false)
      if (error) {
        toast.error(error.message)
        return
      }
      setFindings((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, id: data.id } : f))
      )
    }

    toast.success('Finding saved')
  }

  async function removeFinding(idx: number) {
    const finding = findings[idx]
    if (finding.id) {
      const { error } = await supabase
        .from('findings')
        .delete()
        .eq('id', finding.id)
      if (error) {
        toast.error(error.message)
        return
      }
    }
    setFindings((prev) => prev.filter((_, i) => i !== idx))
    toast.success('Finding removed')
  }

  async function handlePhotoUpload(idx: number, file: File) {
    const finding = findings[idx]
    if (!finding.id) {
      toast.error('Save the finding first before uploading photos')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('report_id', reportId)
    formData.append('finding_id', finding.id)

    try {
      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Upload failed')
      }
      const { photo } = await res.json()
      setFindings((prev) =>
        prev.map((f, i) => {
          if (i !== idx) return f
          return {
            ...f,
            photos: [
              ...f.photos,
              {
                id: photo.id,
                storage_path: photo.storage_path,
                caption: photo.caption,
              },
            ],
          }
        })
      )
      toast.success('Photo uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function handleCompleteReport() {
    setCompleting(true)
    try {
      // Call the AI generate endpoint
      const res = await fetch(`/api/reports/${reportId}/generate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        // If endpoint doesn't exist yet, just proceed
        if (res.status !== 404) {
          throw new Error(
            json.error ?? 'Summary generation failed'
          )
        }
      }
      toast.success('Report completed')
      router.push(`/reports/${reportId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete')
      setCompleting(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Loading findings...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link
        href={`/reports/${reportId}/readings`}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Readings
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Findings</h1>
          <p className="text-gray-500 mt-1">
            Document deficiencies with severity, description, and
            recommendations.
          </p>
        </div>
      </div>

      {findings.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No findings yet. Click &ldquo;Add Finding&rdquo; below, or complete
          the report if there are no issues.
        </div>
      )}

      <div className="space-y-4">
        {findings.map((finding, idx) => (
          <FindingCard
            key={finding.id ?? `new-${idx}`}
            finding={finding}
            idx={idx}
            equipment={equipment}
            onUpdate={updateFinding}
            onSave={saveFinding}
            onRemove={removeFinding}
            onPhotoUpload={handlePhotoUpload}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addFinding}
        className="w-full border-dashed mt-4"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Finding
      </Button>

      {/* Complete Report */}
      <div className="mt-8 bg-gray-900 rounded-xl p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-1">
          Ready to complete the report?
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          This will generate an AI executive summary and finalize the report.
        </p>
        <Button
          onClick={handleCompleteReport}
          disabled={completing}
          size="lg"
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-8"
        >
          {completing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Summary...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Complete Report
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function FindingCard({
  finding,
  idx,
  equipment,
  onUpdate,
  onSave,
  onRemove,
  onPhotoUpload,
}: {
  finding: LocalFinding
  idx: number
  equipment: EquipmentOption[]
  onUpdate: (idx: number, field: keyof LocalFinding, value: string | boolean) => void
  onSave: (idx: number) => void
  onRemove: (idx: number) => void
  onPhotoUpload: (idx: number, file: File) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {finding.severity ? (
              <Badge
                className={
                  severityColors[finding.severity as FindingSeverity]
                }
              >
                {SEVERITY_LABELS[finding.severity as FindingSeverity]}
              </Badge>
            ) : (
              <span className="text-sm text-gray-400">New Finding</span>
            )}
            {finding.id && (
              <Badge variant="outline" className="text-xs">
                Saved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => onSave(idx)}
              disabled={finding.saving}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {finding.saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(idx)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Severity *</Label>
            <Select
              value={finding.severity}
              onValueChange={(v) => onUpdate(idx, 'severity', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select severity..." />
              </SelectTrigger>
              <SelectContent>
                {(
                  ['critical', 'major', 'minor', 'observation'] as FindingSeverity[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs mr-2 ${severityColors[s]}`}
                    >
                      {SEVERITY_LABELS[s]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {equipment.length > 0 && (
            <div className="space-y-1">
              <Label>Related Equipment</Label>
              <Select
                value={finding.equipmentId}
                onValueChange={(v) =>
                  onUpdate(idx, 'equipmentId', v === 'none' ? '' : v ?? '')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {equipment.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label>Description *</Label>
          <Textarea
            value={finding.description}
            onChange={(e) => onUpdate(idx, 'description', e.target.value)}
            placeholder="Describe the issue found..."
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Standard Reference</Label>
            <Input
              value={finding.standardRef}
              onChange={(e) =>
                onUpdate(idx, 'standardRef', e.target.value)
              }
              placeholder="NFPA 70B 11.17.2, NETA 7.3.1..."
            />
          </div>
          <div className="space-y-1">
            <Label>Recommendation</Label>
            <Input
              value={finding.recommendation}
              onChange={(e) =>
                onUpdate(idx, 'recommendation', e.target.value)
              }
              placeholder="Recommended corrective action..."
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <Label>Photos</Label>
          {finding.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {finding.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-gray-100 rounded px-3 py-1.5 text-xs text-gray-600"
                >
                  {photo.caption ??
                    photo.storage_path.split('/').pop() ??
                    'Photo'}
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPhotoUpload(idx, file)
              e.target.value = ''
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!finding.id}
            className="border-dashed"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            {finding.id ? 'Upload Photo' : 'Save finding first'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
