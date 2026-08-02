import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Boxes, AlertTriangle } from 'lucide-react'
import {
  ASSEMBLY_TYPE_LABELS,
  ASSEMBLY_STATUS_LABELS,
  ASSEMBLY_STATUS_COLORS,
  TRADE_LABELS,
  TRADE_COLORS,
} from '@/types/database'
import type { AssemblyType, AssemblyStatus, Trade, PrefabAssembly } from '@/types/database'

type AssemblyRow = PrefabAssembly & { project: { name: string; project_number: string | null } | null }
import AddAssemblyDialog from './AddAssemblyDialog'
import AdvanceStatusButton from './AdvanceStatusButton'

const PIPELINE: AssemblyStatus[] = ['modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed']

export default async function PrefabPage() {
  const supabase = await createClient()
  const { data: assemblies, error } = await supabase
    .from('prefab_assemblies')
    .select('*, project:projects(name, project_number)')
    .order('created_at', { ascending: false })

  const counts = new Map<AssemblyStatus, number>()
  for (const a of assemblies ?? []) {
    counts.set(a.status as AssemblyStatus, (counts.get(a.status as AssemblyStatus) ?? 0) + 1)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prefab Shop</h1>
          <p className="text-gray-500 mt-1">
            BIM-driven fabrication tracking — spools, duct, racks, and skids from model to install.
          </p>
        </div>
        <AddAssemblyDialog />
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3 mb-8">
        {PIPELINE.map((s) => (
          <Card key={s}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-500">
                {ASSEMBLY_STATUS_LABELS[s]}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold">{error ? '—' : counts.get(s) ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
            <p className="font-medium text-gray-900 mb-1">Prefab assemblies could not be loaded.</p>
            <p className="text-sm text-gray-500">
              This is a load failure, not an empty shop — refresh to try again. ({error.message})
            </p>
          </CardContent>
        </Card>
      ) : !assemblies?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Boxes className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-1">No prefab assemblies yet.</p>
            <p className="text-sm text-gray-400">
              Release assemblies from the BIM model to start tracking fabrication.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="divide-y">
              {assemblies.map((a: AssemblyRow) => (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                      {a.assembly_number}
                      {a.name && <span className="text-gray-500 font-normal"> — {a.name}</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {[
                        (a.project as { name: string } | null)?.name,
                        ASSEMBLY_TYPE_LABELS[a.assembly_type as AssemblyType],
                        a.install_location,
                        a.bim_reference && `BIM: ${a.bim_reference}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {a.trade && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRADE_COLORS[a.trade as Trade]}`}>
                        {TRADE_LABELS[a.trade as Trade]}
                      </span>
                    )}
                    {a.shop_hours_estimated != null && (
                      <span className="text-xs text-gray-400">
                        {a.shop_hours_actual != null
                          ? `${a.shop_hours_actual}h / ${a.shop_hours_estimated}h est`
                          : `${a.shop_hours_estimated}h est`}
                      </span>
                    )}
                    <Badge className={ASSEMBLY_STATUS_COLORS[a.status as AssemblyStatus]}>
                      {ASSEMBLY_STATUS_LABELS[a.status as AssemblyStatus]}
                    </Badge>
                    <AdvanceStatusButton assemblyId={a.id} status={a.status as AssemblyStatus} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
