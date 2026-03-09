export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, MapPin, Phone, Mail } from 'lucide-react'
import AddSiteDialog from './AddSiteDialog'
import { REPORT_TYPE_LABELS } from '@/types/database'
import type { ReportStatus, ReportType } from '@/types/database'

const statusColors: Record<ReportStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: company }, { data: sites }, { data: reports }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('sites').select('*').eq('company_id', id).order('name'),
    supabase
      .from('test_reports')
      .select('*, site:sites(name)')
      .eq('company_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!company) notFound()

  return (
    <div className="p-8">
      <Link href="/companies" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Companies
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {(company.city || company.state) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[company.address, company.city, company.state, company.zip].filter(Boolean).join(', ')}
              </span>
            )}
            {company.contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {company.contact_phone}
              </span>
            )}
            {company.contact_email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {company.contact_email}
              </span>
            )}
          </div>
        </div>
        <Link href={`/reports/new?company_id=${id}`}>
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sites */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Sites / Locations</CardTitle>
              <AddSiteDialog companyId={id} />
            </CardHeader>
            <CardContent>
              {!sites || sites.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No sites yet</p>
              ) : (
                <div className="space-y-2">
                  {sites.map((site) => (
                    <div key={site.id} className="p-2 rounded bg-gray-50 text-sm">
                      <div className="font-medium">{site.name}</div>
                      {site.address && <div className="text-gray-500 text-xs">{site.address}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reports */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {!reports || reports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No reports for this company yet</p>
              ) : (
                <div className="divide-y">
                  {reports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/reports/${report.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {(report.site as { name: string } | null)?.name ?? 'No site'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {REPORT_TYPE_LABELS[report.report_type as ReportType] ?? report.report_type} &middot; {report.test_date}
                        </div>
                      </div>
                      <Badge className={statusColors[report.status as ReportStatus]}>
                        {report.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
