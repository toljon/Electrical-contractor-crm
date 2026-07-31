import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'
import {
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_COLORS,
  PROJECT_MARKET_LABELS,
  TRADE_LABELS,
  TRADE_COLORS,
} from '@/types/database'
import type { ProjectPhase, ProjectMarket, Trade, Project } from '@/types/database'
import AddProjectDialog from './AddProjectDialog'

function formatValue(cents: number | null) {
  if (cents == null) return null
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`
  return `$${dollars.toFixed(0)}`
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">
            Commercial construction projects — preconstruction through warranty.
          </p>
        </div>
        <AddProjectDialog />
      </div>

      {!projects?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-1">No projects yet.</p>
            <p className="text-sm text-gray-400">
              Add your first project to start tracking BIM coordination and prefab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((p: Project) => (
            <Card key={p.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {p.name}
                      {p.project_number && (
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          #{p.project_number}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {[p.general_contractor && `GC: ${p.general_contractor}`, p.city]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                  <Badge className={PROJECT_PHASE_COLORS[p.phase as ProjectPhase]}>
                    {PROJECT_PHASE_LABELS[p.phase as ProjectPhase]}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {(p.trades as Trade[] | null)?.map((t) => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRADE_COLORS[t]}`}>
                      {TRADE_LABELS[t]}
                    </span>
                  ))}
                  {p.market && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {PROJECT_MARKET_LABELS[p.market as ProjectMarket]}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-gray-500">
                    {formatValue(p.contract_value_cents) ?? 'Value TBD'}
                    {p.target_completion && ` · Target ${p.target_completion}`}
                  </span>
                  {p.bim_model_url && (
                    <a
                      href={p.bim_model_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-ink hover:underline text-xs font-medium"
                    >
                      BIM Model ↗
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
