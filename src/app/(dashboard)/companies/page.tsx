export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Building2, Phone, Mail, ChevronRight } from 'lucide-react'
import AddCompanyDialog from './AddCompanyDialog'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 mt-1">Your customer accounts</p>
        </div>
        <AddCompanyDialog />
      </div>

      {!companies || companies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No companies yet. Add your first customer.</p>
            <AddCompanyDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-yellow-100 rounded-lg p-2 mt-0.5">
                      <Building2 className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {[company.city, company.state].filter(Boolean).join(', ')}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {company.contact_name && (
                          <span className="text-sm text-gray-600">{company.contact_name}</span>
                        )}
                        {company.contact_phone && (
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="h-3 w-3" />
                            {company.contact_phone}
                          </span>
                        )}
                        {company.contact_email && (
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Mail className="h-3 w-3" />
                            {company.contact_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
