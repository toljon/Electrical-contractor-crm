export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import NewReportForm from './NewReportForm'

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  const { company_id } = await searchParams
  const supabase = await createClient()

  const [{ data: companies }, { data: sites }] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('sites').select('id, name, company_id').order('name'),
  ])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Report</h1>
      <p className="text-gray-500 mb-8">Set up the basics — you&apos;ll add assets, readings, and findings next.</p>
      <NewReportForm
        companies={companies ?? []}
        sites={sites ?? []}
        defaultCompanyId={company_id}
      />
    </div>
  )
}
