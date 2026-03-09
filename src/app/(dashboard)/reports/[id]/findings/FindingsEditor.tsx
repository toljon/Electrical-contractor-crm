'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'
import { SEVERITY_LABELS } from '@/types/database'
import type { Finding, FindingSeverity, Asset } from '@/types/database'

interface LocalFinding {
  id?: string
  severity: FindingSeverity | ''
  description: string
  recommendation: string
  asset_id: string
  saving: boolean
}

const severityColors: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  observation: 'bg-blue-100 text-blue-700',
}

export default function FindingsEditor({
  reportId,
  initialFindings,
  assets,
}: {
  reportId: string
  initialFindings: Finding[]
  assets: Pick<Asset, 'id' | 'name'>[]
}) {
  const [findings, setFindings] = useState<LocalFinding[]>(
    initialFindings.map(f => ({
      id: f.id,
      severity: f.severity,
      description: f.description,
      recommendation: f.recommendation ?? '',
      asset_id: f.asset_id ?? '',
      saving: false,
    }))
  )
  const supabase = createClient()

  function addFinding() {
    setFindings(prev => [...prev, { severity: '', description: '', recommendation: '', asset_id: '', saving: false }])
  }

  function update(idx: number, field: keyof LocalFinding, value: string | boolean | null) {
    setFindings(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  async function saveFinding(idx: number) {
    const finding = findings[idx]
    if (!finding.severity) { toast.error('Severity is required'); return }
    if (!finding.description.trim()) { toast.error('Description is required'); return }

    update(idx, 'saving', true)

    const payload = {
      report_id: reportId,
      severity: finding.severity,
      description: finding.description,
      recommendation: finding.recommendation || null,
      asset_id: finding.asset_id || null,
      sort_order: idx,
    }

    if (finding.id) {
      const { error } = await supabase.from('findings').update(payload).eq('id', finding.id)
      update(idx, 'saving', false)
      if (error) { toast.error(error.message); return }
    } else {
      const { data, error } = await supabase.from('findings').insert(payload).select().single()
      update(idx, 'saving', false)
      if (error) { toast.error(error.message); return }
      setFindings(prev => prev.map((f, i) => i === idx ? { ...f, id: data.id } : f))
    }

    toast.success('Finding saved')
  }

  async function removeFinding(idx: number) {
    const finding = findings[idx]
    if (finding.id) {
      const { error } = await supabase.from('findings').delete().eq('id', finding.id)
      if (error) { toast.error(error.message); return }
    }
    setFindings(prev => prev.filter((_, i) => i !== idx))
    toast.success('Finding removed')
  }

  return (
    <div className="space-y-4">
      {findings.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No findings yet. Click &ldquo;Add Finding&rdquo; below, or proceed to preview if there are no issues.
        </div>
      )}

      {findings.map((finding, idx) => (
        <Card key={finding.id ?? `new-${idx}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {finding.severity ? (
                  <Badge className={severityColors[finding.severity as FindingSeverity]}>
                    {SEVERITY_LABELS[finding.severity as FindingSeverity]}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">New Finding</span>
                )}
                {finding.id && <Badge variant="outline" className="text-xs">Saved</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveFinding(idx)}
                  disabled={finding.saving}
                  className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {finding.saving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFinding(idx)}
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
                <Select value={finding.severity} onValueChange={v => update(idx, 'severity', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['critical', 'major', 'minor', 'observation'] as FindingSeverity[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={`px-1.5 py-0.5 rounded text-xs mr-2 ${severityColors[s]}`}>
                          {SEVERITY_LABELS[s]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {assets.length > 0 && (
                <div className="space-y-1">
                  <Label>Related Asset</Label>
                  <Select value={finding.asset_id} onValueChange={v => update(idx, 'asset_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset (optional)…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {assets.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
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
                onChange={e => update(idx, 'description', e.target.value)}
                placeholder="Describe the issue found…"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>Recommendation</Label>
              <Textarea
                value={finding.recommendation}
                onChange={e => update(idx, 'recommendation', e.target.value)}
                placeholder="Recommended corrective action…"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addFinding} className="w-full border-dashed">
        <Plus className="h-4 w-4 mr-2" />
        Add Finding
      </Button>
    </div>
  )
}
