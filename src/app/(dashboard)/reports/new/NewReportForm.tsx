'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportType } from '@/types/database'

interface Company { id: string; name: string }
interface Site { id: string; name: string; company_id: string }

interface Props {
  companies: Company[]
  sites: Site[]
  defaultCompanyId?: string
}

export default function NewReportForm({ companies, sites, defaultCompanyId }: Props) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? '')
  const [siteId, setSiteId] = useState('')
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0])
  const [techName, setTechName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filteredSites = sites.filter((s) => !companyId || s.company_id === companyId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reportType) {
      toast.error('Please select a report type')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Generate report number: VT-YYYYMMDD-XXXX
    const reportNumber = `VT-${testDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`

    const { data, error } = await supabase
      .from('test_reports')
      .insert({
        owner_id: user.id,
        company_id: companyId || null,
        site_id: siteId || null,
        report_type: reportType,
        report_number: reportNumber,
        test_date: testDate,
        technician_name: techName || null,
        notes: notes || null,
        status: 'draft',
      })
      .select()
      .single()

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Report created')
      router.push(`/reports/${data.id}/assets`)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v ?? ''); setSiteId('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Site / Location</Label>
              <Select value={siteId} onValueChange={(v) => setSiteId(v ?? '')} disabled={!companyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Report Type *</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="testDate">Test Date *</Label>
              <Input
                id="testDate"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="techName">Technician Name</Label>
              <Input
                id="techName"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">General Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Site conditions, overall summary, special observations…"
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
              {loading ? 'Creating…' : 'Create Report & Add Assets →'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
