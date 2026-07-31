import { getDb } from '@/lib/localdb/database'
import { ASSEMBLY_TYPE_LABELS } from '@/types/database'
import type { AssemblyType } from '@/types/database'

/**
 * Executive aggregates shared by the dashboard and the insights page.
 *
 * Both surfaces quote the same numbers to the same audience, so they read from
 * one place — a pipeline figure that disagrees with itself across two tabs is
 * worse than no figure at all.
 */

/**
 * Cost assumptions used to express open deficiencies in money.
 *
 * These are MODELLED RATES, not TG Gallagher's figures — TGG does not publish
 * labour rates and nothing here is derived from their data. They exist so the
 * operational picture can be stated commercially, and every surface that uses
 * them states the assumption on screen next to the number.
 */
export const COST_MODEL = {
  /** Assumed all-in cost of a planned corrective repair, per finding. */
  plannedRepairUsd: 1_800,
  /**
   * Assumed cost of the same repair once the equipment has failed: off-hours
   * labour, expedited parts, and the disruption of an unplanned outage.
   */
  emergencyRepairUsd: 7_500,
} as const

/**
 * Variance below which an assembly type is treated as on-estimate. Set at 3%:
 * tight enough that a genuinely drifting estimate surfaces, loose enough that
 * ordinary job-to-job noise doesn't get reported as a finding.
 */
export const VARIANCE_THRESHOLD = 0.03

export type HoursByType = {
  assembly_type: AssemblyType
  n: number
  est: number
  actual: number
}

/** A single plain-language conclusion drawn from the est-vs-actual data. */
export type ShopFinding = {
  label: string
  variancePct: number
  hoursOver: number
  n: number
  direction: 'over' | 'under'
}

export type ExecMetrics = {
  activeProjects: { n: number; value: number }
  backlog: number
  shipped30: number
  hoursByType: HoursByType[]
  totalEst: number
  totalActual: number
  variancePct: number
  /** Worst over-run by assembly type, if any type is more than 5% over. */
  worstOverrun: ShopFinding | null
  /** Best under-run, i.e. an estimate carrying slack worth reclaiming. */
  bestUnderrun: ShopFinding | null
  openCritical: number
  /** Modelled cost of letting open critical/major findings run to failure. */
  exposureUsd: number
}

function toFinding(r: HoursByType, direction: 'over' | 'under'): ShopFinding {
  return {
    label: ASSEMBLY_TYPE_LABELS[r.assembly_type],
    variancePct: Math.round(((r.actual - r.est) / r.est) * 100),
    hoursOver: Math.round(r.actual - r.est),
    n: r.n,
    direction,
  }
}

export function getExecMetrics(orgId: string): ExecMetrics {
  const db = getDb()

  const hoursByType = db.prepare(`
    SELECT assembly_type,
           COUNT(*) AS n,
           SUM(shop_hours_estimated) AS est,
           SUM(shop_hours_actual) AS actual
    FROM prefab_assemblies
    WHERE org_id = ? AND shop_hours_actual IS NOT NULL AND shop_hours_estimated IS NOT NULL
    GROUP BY assembly_type
    ORDER BY est DESC
  `).all(orgId) as HoursByType[]

  const backlog = (db.prepare(`
    SELECT COUNT(*) AS n FROM prefab_assemblies
    WHERE org_id = ? AND status IN ('modeled','released','in_fabrication','qc')
  `).get(orgId) as { n: number }).n

  const activeRow = db.prepare(`
    SELECT COUNT(*) AS n, SUM(contract_value_cents) AS value
    FROM projects WHERE org_id = ? AND phase NOT IN ('closeout','warranty')
  `).get(orgId) as { n: number; value: number | null }

  const shipped = db.prepare(`
    SELECT shipped_at FROM prefab_assemblies
    WHERE org_id = ? AND shipped_at IS NOT NULL
  `).all(orgId) as { shipped_at: string }[]

  const openCritical = (db.prepare(`
    SELECT COUNT(*) AS n FROM findings
    WHERE org_id = ? AND status IN ('open','quoted') AND severity IN ('critical','major')
  `).get(orgId) as { n: number }).n

  const now = Date.now()
  const shipped30 = shipped.filter((s) => {
    const days = (now - new Date(s.shipped_at).getTime()) / 86_400_000
    return days >= 0 && days <= 30
  }).length

  const totalEst = hoursByType.reduce((s, r) => s + r.est, 0)
  const totalActual = hoursByType.reduce((s, r) => s + r.actual, 0)
  const variancePct = totalEst ? Math.round(((totalActual - totalEst) / totalEst) * 100) : 0

  // Rank by percentage variance rather than absolute hours: a small assembly
  // type running 20% hot is a worse estimating problem than a large one at 3%,
  // and it is the estimate that this page exists to correct.
  const withVariance = hoursByType.filter((r) => r.est > 0)
  const over = withVariance
    .filter((r) => r.actual > r.est * (1 + VARIANCE_THRESHOLD))
    .sort((a, b) => (b.actual - b.est) / b.est - (a.actual - a.est) / a.est)[0]
  const under = withVariance
    .filter((r) => r.actual < r.est * (1 - VARIANCE_THRESHOLD))
    .sort((a, b) => (a.actual - a.est) / a.est - (b.actual - b.est) / b.est)[0]

  return {
    activeProjects: { n: activeRow.n, value: activeRow.value ?? 0 },
    backlog,
    shipped30,
    hoursByType,
    totalEst,
    totalActual,
    variancePct,
    worstOverrun: over ? toFinding(over, 'over') : null,
    bestUnderrun: under ? toFinding(under, 'under') : null,
    openCritical,
    exposureUsd:
      openCritical * (COST_MODEL.emergencyRepairUsd - COST_MODEL.plannedRepairUsd),
  }
}

export const fmtMoneyCents = (cents: number) => {
  const d = cents / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 1_000) return `$${Math.round(d / 1_000)}K`
  return `$${d.toFixed(0)}`
}

export const fmtUsd = (usd: number) => {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`
  return `$${usd.toFixed(0)}`
}

/**
 * Exact dollars, for figures a reader may try to reconcile against each other.
 * Rounding the rate assumptions to $8K and $2K makes the arithmetic behind an
 * exposure total stop adding up, which is the fastest way to lose a CFO.
 */
export const fmtUsdExact = (usd: number) => `$${Math.round(usd).toLocaleString('en-US')}`
