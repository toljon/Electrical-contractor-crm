'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportType } from '@/types/database'

export default function NewReportPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <NewReportForm />
    </Suspense>
  )
}

interface WorkOrderData {
  id: string
  customer_id: string
  location_id: string | null
  customer: { name: string } | null
  location: { name: string } | null
}

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const workOrderId = searchParams.get('workOrderId') ?? ''

  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [testDate, setTestDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [reportNumber, setReportNumber] = useState('')
  const [ambientTempF, setAmbientTempF] = useState('')
  const [humidityPct, setHumidityPct] = useState('')
  const [weatherConditions, setWeatherConditions] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [technicianCerts, setTechnicianCerts] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch work order on mount
  useEffect(() => {
    async function loadWorkOrder() {
      if (!workOrderId) return
      const { data } = await supabase
        .from('work_orders')
        .select('id, customer_id, location_id, customer:customers(name), location:locations(name)')
        .eq('id', workOrderId)
        .single()
      if (data) {
        setWorkOrder(data as unknown as WorkOrderData)
      }
    }
    loadWorkOrder()
  }, [workOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate report number on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    setReportNumber(`VT-${today}-${Math.floor(1000 + Math.random() * 9000)}`)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!reportType) {
      toast.error('Please select a report type')
      return
    }
    if (!workOrderId) {
      toast.error('Work order is required')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get the user's org_id from their profile
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

    const { data, error } = await supabase
      .from('inspection_reports')
      .insert({
        org_id: profile.org_id,
        work_order_id: workOrderId,
        customer_id: workOrder?.customer_id ?? '',
        location_id: workOrder?.location_id ?? null,
        report_type: reportType,
        report_number: reportNumber || null,
        test_date: testDate,
        technician_name: technicianName || null,
        technician_certs: technicianCerts || null,
        notes: [
          ambientTempF && `Ambient Temp: ${ambientTempF}°F`,
          humidityPct && `Humidity: ${humidityPct}%`,
          weatherConditions && `Weather: ${weatherConditions}`,
        ]
          .filter(Boolean)
          .join('; ') || null,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Report created')
      router.push(`/reports/${data.id}/readings`)
    }
  }

  const customerName =
    (workOrder?.customer as { name: string } | null)?.name ?? 'Loading...'
  const locationName =
    (workOrder?.location as { name: string } | null)?.name ?? ''

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href={workOrderId ? `/work-orders/${workOrderId}` : '/reports'}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {workOrderId ? 'Back to Work Order' : 'Back to Reports'}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        New Inspection Report
      </h1>
      <p className="text-gray-500 mb-8">
        Set up report details — you will add test readings and findings next.
      </p>

      {workOrder && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm">
          <div className="font-medium text-gray-900">{customerName}</div>
          {locationName && (
            <div className="text-gray-500">{locationName}</div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Report Type */}
            <div className="space-y-1">
              <Label>Report Type *</Label>
              <Select
                value={reportType}
                onValueChange={(v) => setReportType((v ?? '') as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select report type..." />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(REPORT_TYPE_LABELS) as [
                      ReportType,
                      string,
                    ][]
                  ).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Date & Report Number */}
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
                <Label htmlFor="reportNumber">Report Number</Label>
                <Input
                  id="reportNumber"
                  value={reportNumber}
                  onChange={(e) => setReportNumber(e.target.value)}
                  placeholder="VT-YYYYMMDD-XXXX"
                />
              </div>
            </div>

            {/* Ambient Conditions */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="ambientTempF">Ambient Temp (F)</Label>
                <Input
                  id="ambientTempF"
                  type="number"
                  value={ambientTempF}
                  onChange={(e) => setAmbientTempF(e.target.value)}
                  placeholder="72"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="humidityPct">Humidity (%)</Label>
                <Input
                  id="humidityPct"
                  type="number"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(e.target.value)}
                  placeholder="45"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="weatherConditions">Weather</Label>
                <Input
                  id="weatherConditions"
                  value={weatherConditions}
                  onChange={(e) => setWeatherConditions(e.target.value)}
                  placeholder="Clear, Indoor, etc."
                />
              </div>
            </div>

            {/* Technician Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="technicianName">Technician Name</Label>
                <Input
                  id="technicianName"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="technicianCerts">Certifications</Label>
                <Input
                  id="technicianCerts"
                  value={technicianCerts}
                  onChange={(e) => setTechnicianCerts(e.target.value)}
                  placeholder="NETA Level III, PE, etc."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(
                    workOrderId
                      ? `/work-orders/${workOrderId}`
                      : '/reports'
                  )
                }
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                {loading ? 'Creating...' : 'Create Report & Add Readings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
