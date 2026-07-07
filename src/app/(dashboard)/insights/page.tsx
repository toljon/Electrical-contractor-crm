import { createClient } from '@/lib/supabase/server'
import { getDb } from '@/lib/localdb/database'
import { getEngineContext } from '@/lib/localdb/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ASSEMBLY_TYPE_LABELS,
  PROJECT_PHASE_LABELS,
  SEVERITY_LABELS,
} from '@/types/database'
import type { AssemblyType, ProjectPhase, FindingSeverity } from '@/types/database'
import { AlertTriangle, AlertCircle, Info, Eye } from 'lucide-react'

// Chart ink & series tokens (validated: see dataviz reference palette;
// series-2 aqua is sub-3:1 on white, relieved by direct value labels)
const SERIES_1 = '#2a78d6' // estimated
const SERIES_2 = '#1baf7a' // actual
const GRID = '#e1e0d9'

const SEVERITY_STATUS: Record<FindingSeverity, { color: string; Icon: typeof AlertTriangle }> = {
  critical: { color: '#d03b3b', Icon: AlertTriangle },
  major: { color: '#ec835a', Icon: AlertCircle },
  minor: { color: '#fab219', Icon: Info },
  observation: { color: '#898781', Icon: Eye },
}

const fmtMoney = (cents: number) => {
  const d = cents / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 1_000) return `$${Math.round(d / 1_000)}K`
  return `$${d.toFixed(0)}`
}

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ctx = getEngineContext(user!.id)
  const db = getDb()
  const org = ctx.orgId

  // ── aggregates (direct SQL, org-scoped) ───────────────
  const hoursByType = db.prepare(`
    SELECT assembly_type,
           COUNT(*) AS n,
           SUM(shop_hours_estimated) AS est,
           SUM(shop_hours_actual) AS actual
    FROM prefab_assemblies
    WHERE org_id = ? AND shop_hours_actual IS NOT NULL AND shop_hours_estimated IS NOT NULL
    GROUP BY assembly_type
    ORDER BY est DESC
  `).all(org) as { assembly_type: AssemblyType; n: number; est: number; actual: number }[]

  const valueByPhase = db.prepare(`
    SELECT phase, SUM(contract_value_cents) AS value, COUNT(*) AS n
    FROM projects
    WHERE org_id = ? AND contract_value_cents IS NOT NULL
    GROUP BY phase
  `).all(org) as { phase: ProjectPhase; value: number; n: number }[]

  const shipped = db.prepare(`
    SELECT shipped_at FROM prefab_assemblies
    WHERE org_id = ? AND shipped_at IS NOT NULL
  `).all(org) as { shipped_at: string }[]

  const findingsBySeverity = db.prepare(`
    SELECT severity, COUNT(*) AS n
    FROM findings
    WHERE org_id = ? AND status IN ('open','quoted') AND severity IS NOT NULL
    GROUP BY severity
  `).all(org) as { severity: FindingSeverity; n: number }[]

  const backlog = (db.prepare(`
    SELECT COUNT(*) AS n FROM prefab_assemblies
    WHERE org_id = ? AND status IN ('modeled','released','in_fabrication','qc')
  `).get(org) as { n: number }).n

  const activeProjects = db.prepare(`
    SELECT COUNT(*) AS n, SUM(contract_value_cents) AS value
    FROM projects WHERE org_id = ? AND phase NOT IN ('closeout','warranty')
  `).get(org) as { n: number; value: number | null }

  // ── derived series ────────────────────────────────────
  const now = new Date()
  const WEEKS = 8
  const weekCounts = Array.from({ length: WEEKS }, () => 0)
  const shipped30 = shipped.filter((s) => {
    const days = (now.getTime() - new Date(s.shipped_at).getTime()) / 86_400_000
    if (days >= 0 && days < WEEKS * 7) weekCounts[WEEKS - 1 - Math.floor(days / 7)]++
    return days >= 0 && days <= 30
  }).length

  const totalEst = hoursByType.reduce((s, r) => s + r.est, 0)
  const totalActual = hoursByType.reduce((s, r) => s + r.actual, 0)
  const variancePct = totalEst ? Math.round(((totalActual - totalEst) / totalEst) * 100) : 0

  const phaseOrder: ProjectPhase[] = ['pursuit', 'preconstruction', 'coordination', 'fabrication', 'installation', 'commissioning', 'closeout', 'warranty']
  const phaseRows = phaseOrder
    .map((phase) => valueByPhase.find((r) => r.phase === phase))
    .filter((r): r is NonNullable<typeof r> => !!r)

  const maxHours = Math.max(...hoursByType.map((r) => Math.max(r.est, r.actual)), 1)
  const maxPhase = Math.max(...phaseRows.map((r) => r.value), 1)
  const maxWeek = Math.max(...weekCounts, 1)
  const severityOrder: FindingSeverity[] = ['critical', 'major', 'minor', 'observation']

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-gray-500 mt-1">
          What the shop, the projects, and the service fleet are telling us.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Active project pipeline</p>
            <p className="text-2xl font-semibold text-gray-900">{fmtMoney(activeProjects.value ?? 0)}</p>
            <p className="text-xs text-gray-500 mt-1">{activeProjects.n} projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Prefab backlog in shop</p>
            <p className="text-2xl font-semibold text-gray-900">{backlog}</p>
            <p className="text-xs text-gray-500 mt-1">assemblies modeled → QC</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Shipped last 30 days</p>
            <p className="text-2xl font-semibold text-gray-900">{shipped30}</p>
            <p className="text-xs text-gray-500 mt-1">assemblies to site</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">Shop hours vs estimate</p>
            <p className={`text-2xl font-semibold ${variancePct > 5 ? 'text-red-700' : 'text-gray-900'}`}>
              {variancePct > 0 ? '+' : ''}{variancePct}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(totalActual).toLocaleString()}h actual / {Math.round(totalEst).toLocaleString()}h est
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Est vs actual shop hours by assembly type */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Shop hours — estimated vs actual, by assembly type</CardTitle>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERIES_1 }} />
                  Estimated
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SERIES_2 }} />
                  Actual
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400">Completed assemblies only — the dataset that sharpens the next estimate.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hoursByType.map((r) => (
                <div key={r.assembly_type} title={`${ASSEMBLY_TYPE_LABELS[r.assembly_type]}: ${Math.round(r.est)}h estimated, ${Math.round(r.actual)}h actual (${r.n} assemblies)`}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-gray-700">{ASSEMBLY_TYPE_LABELS[r.assembly_type]}</span>
                    <span className="text-xs text-gray-400">{r.n} completed</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3.5 rounded-r"
                        style={{ width: `${(r.est / maxHours) * 100}%`, backgroundColor: SERIES_1, minWidth: 2 }}
                      />
                      <span className="text-xs text-gray-500 tabular-nums">{Math.round(r.est)}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3.5 rounded-r"
                        style={{ width: `${(r.actual / maxHours) * 100}%`, backgroundColor: SERIES_2, minWidth: 2 }}
                      />
                      <span className="text-xs text-gray-500 tabular-nums">
                        {Math.round(r.actual)}h
                        {r.actual > r.est * 1.05 && (
                          <span className="text-red-700 ml-1">+{Math.round(((r.actual - r.est) / r.est) * 100)}%</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!hoursByType.length && (
                <p className="text-sm text-gray-400 py-6 text-center">No completed assemblies with recorded hours yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline value by phase */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contract value by project phase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phaseRows.map((r) => (
                <div key={r.phase} className="flex items-center gap-3" title={`${PROJECT_PHASE_LABELS[r.phase]}: ${fmtMoney(r.value)} across ${r.n} project(s)`}>
                  <span className="text-sm text-gray-700 w-32 shrink-0">{PROJECT_PHASE_LABELS[r.phase]}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div
                      className="h-3.5 rounded-r"
                      style={{ width: `${(r.value / maxPhase) * 100}%`, backgroundColor: SERIES_1, minWidth: 2 }}
                    />
                    <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{fmtMoney(r.value)}</span>
                  </div>
                </div>
              ))}
              {!phaseRows.length && (
                <p className="text-sm text-gray-400 py-6 text-center">No projects yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weekly shipments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assemblies shipped per week</CardTitle>
            <p className="text-xs text-gray-400">Last {WEEKS} weeks — shop throughput</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-36 border-b pb-px" style={{ borderColor: GRID }}>
              {weekCounts.map((n, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                  title={`${n} shipped, ${WEEKS - 1 - i} week(s) ago`}
                >
                  <span className="text-xs text-gray-500 tabular-nums">{n || ''}</span>
                  <div
                    className="w-full max-w-6 rounded-t"
                    style={{ height: `${(n / maxWeek) * 100}%`, backgroundColor: SERIES_1, minHeight: n ? 3 : 0 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>{WEEKS} wks ago</span>
              <span>this week</span>
            </div>
          </CardContent>
        </Card>

        {/* Open findings by severity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open service findings</CardTitle>
            <p className="text-xs text-gray-400">Deficiencies awaiting quote or repair — each is a service revenue lead.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {severityOrder.map((sev) => {
                const n = findingsBySeverity.find((r) => r.severity === sev)?.n ?? 0
                const { color, Icon } = SEVERITY_STATUS[sev]
                return (
                  <div key={sev} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3">
                    <Icon className="h-5 w-5 shrink-0" style={{ color }} />
                    <div>
                      <p className="text-xl font-semibold text-gray-900">{n}</p>
                      <p className="text-xs text-gray-500">{SEVERITY_LABELS[sev]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
