import type { Dataset, EvidenceRef, SiteId } from '@/lib/data/types'
import { ASSUMPTIONS } from './assumptions'
import { clamp, round, sliceDataset, type Filter } from './kpis'
import { analyzeLean, type Confidence, type LeanKey } from './lean'
import { scoreEquipmentRisk } from './risk'
import { runSimulation } from './simulation'

export type RecommendationStatus = 'proposed' | 'approved' | 'in_progress' | 'completed' | 'dismissed'
export type Feasibility = 'high' | 'medium' | 'low'

export interface Recommendation {
  id: string
  title: string
  siteId: SiteId
  category: 'safety' | 'maintenance' | 'lean' | 'energy'
  rationale: string
  riskAddressed: string
  expectedImpact: string
  estimatedCostUsd: number
  annualBenefitUsd: number | null
  roi: number | null
  feasibility: Feasibility
  confidence: Confidence
  team: string
  safetyRelevance: number
  priorityScore: number
  evidence: EvidenceRef[]
  requiresHumanApproval: true
}

const FEAS: Record<Feasibility, number> = { high: 1, medium: 0.6, low: 0.3 }

/** Priority = 0.35·safety + 0.25·impact + 0.20·ROI + 0.10·feasibility + 0.10·(1 − cost). All terms 0–1. */
export const PRIORITY_WEIGHTS = { safety: 0.35, impact: 0.25, roi: 0.2, feasibility: 0.1, cost: 0.1 }

function priority(r: Omit<Recommendation, 'priorityScore'>, impactNorm: number) {
  const roiNorm = r.roi === null ? 0.3 : clamp(r.roi / 10)
  const costNorm = clamp(r.estimatedCostUsd / 100_000)
  const p = PRIORITY_WEIGHTS
  return Math.round(
    100 *
      (p.safety * r.safetyRelevance +
        p.impact * impactNorm +
        p.roi * roiNorm +
        p.feasibility * FEAS[r.feasibility] +
        p.cost * (1 - costNorm)),
  )
}

const roiOf = (benefit: number | null, cost: number) => (benefit === null || cost <= 0 ? null : round((benefit - cost) / cost, 1))

export function buildRecommendations(ds: Dataset, filter: Filter = { site: 'all', days: 30 }): Recommendation[] {
  const out: Recommendation[] = []
  const siteIds: SiteId[] = filter.site === 'all' ? ['A', 'B', 'C'] : [filter.site]
  const allSlice = sliceDataset(ds, filter)
  const risks = scoreEquipmentRisk(allSlice)

  const push = (r: Omit<Recommendation, 'priorityScore' | 'requiresHumanApproval'>, impactNorm: number) => {
    const base = { ...r, requiresHumanApproval: true as const }
    out.push({ ...base, priorityScore: priority(base, impactNorm) })
  }

  for (const risk of risks.filter((x) => x.level === 'critical' || x.level === 'high')) {
    const eq = ds.equipment.find((e) => e.id === risk.equipmentId)!
    const hourly = ASSUMPTIONS.downtimeCostPerHour[eq.type]
    const downtimeFactor = risk.factors.find((f) => f.key === 'downtime')!
    const recentDowntime = allSlice.telemetry
      .filter((t) => t.equipmentId === eq.id)
      .slice(-7)
      .reduce((s, t) => s + t.unplannedDowntimeHours, 0)
    const cost = Math.round(6 * hourly + 3500)
    const benefit = Math.round(recentDowntime * 0.5 * hourly * (365 / 7) * 0.25)
    const dominant = [...risk.factors].sort((a, b) => b.contribution - a.contribution)[0]
    push(
      {
        id: `REC-INSPECT-${eq.id}`,
        title: `Inspect ${eq.code} at Site ${eq.siteId} before next shift`,
        siteId: eq.siteId,
        category: risk.factors.find((f) => f.key === 'incidents')!.normalized > 0.5 ? 'safety' : 'maintenance',
        rationale: `${eq.code} has a ${risk.level} risk score of ${risk.score}/100. Dominant factor: ${dominant.label.toLowerCase()} — ${dominant.detail}. ${downtimeFactor.detail}.`,
        riskAddressed: `Equipment failure / safety exposure on ${eq.code} (${eq.type.replace('_', ' ')})`,
        expectedImpact: `Avoid an estimated 50% of recent unplanned downtime (${round(recentDowntime, 1)} h in last 7 days).`,
        estimatedCostUsd: cost,
        annualBenefitUsd: benefit,
        roi: roiOf(benefit, cost),
        feasibility: 'high',
        confidence: 'medium',
        team: 'Maintenance & Reliability',
        safetyRelevance: clamp(0.5 + risk.severity * 0.5),
        evidence: risk.evidence,
      },
      clamp(risk.score / 80),
    )
  }

  for (const siteId of siteIds) {
    const slice = sliceDataset(ds, { site: siteId, days: filter.days })
    const lean = Object.fromEntries(analyzeLean(ds, slice).map((w) => [w.key, w])) as Record<LeanKey, ReturnType<typeof analyzeLean>[number]>

    if (lean.waiting.score >= 35) {
      const sim = runSimulation(ds, { site: siteId, days: filter.days, waitingReductionPct: 15 })
      const cost = 25_000
      push(
        {
          id: `REC-DISPATCH-${siteId}`,
          title: `Rebalance truck–shovel dispatch at Site ${siteId}`,
          siteId,
          category: 'lean',
          rationale: `Truck queue share is ${lean.waiting.value}% vs benchmark ${lean.waiting.benchmark}.`,
          riskAddressed: 'Queue congestion at loading units (productivity and near-miss exposure)',
          expectedImpact: `Simulated 15% queue reduction: ${sim.metrics[0].delta >= 0 ? '+' : ''}${sim.metrics[0].delta.toLocaleString('en-US')} t over ${filter.days} days.`,
          estimatedCostUsd: cost,
          annualBenefitUsd: sim.annualizedBenefitUsd,
          roi: roiOf(sim.annualizedBenefitUsd, cost),
          feasibility: 'high',
          confidence: 'medium',
          team: 'Mine Operations / Dispatch',
          safetyRelevance: ds.incidents.some((i) => i.siteId === siteId && i.description.toLowerCase().includes('queue')) ? 0.6 : 0.3,
          evidence: lean.waiting.evidence,
        },
        clamp(lean.waiting.score / 100),
      )
    }

    if (lean.transportation.score >= 35) {
      const sim = runSimulation(ds, { site: siteId, days: filter.days, routeEfficiencyPct: 40 })
      const cost = 40_000
      push(
        {
          id: `REC-ROUTE-${siteId}`,
          title: `Haul road survey and route compliance at Site ${siteId}`,
          siteId,
          category: 'energy',
          rationale: `Route deviation is ${lean.transportation.value}% vs ${lean.transportation.benchmark}.`,
          riskAddressed: 'Excess haul distance, fuel and tyre wear',
          expectedImpact: `Simulated 40% deviation reduction: fuel intensity ${sim.metrics[1].deltaPct}%.`,
          estimatedCostUsd: cost,
          annualBenefitUsd: sim.annualizedBenefitUsd,
          roi: roiOf(sim.annualizedBenefitUsd, cost),
          feasibility: 'medium',
          confidence: 'medium',
          team: 'Mine Planning & Roads',
          safetyRelevance: 0.25,
          evidence: lean.transportation.evidence,
        },
        clamp(lean.transportation.score / 100),
      )
    }

    if (lean.motion.score >= 40) {
      const cost = 18_000
      const benefit = Math.round((lean.motion.estimatedCostUsd * 0.4 * 365) / filter.days)
      push(
        {
          id: `REC-CYCLE-${siteId}`,
          title: `Loading cycle coaching and fragmentation review at Site ${siteId}`,
          siteId,
          category: 'lean',
          rationale: `Loading cycle averages ${lean.motion.value} s vs ${lean.motion.benchmark}.`,
          riskAddressed: 'Excess motion at loading units',
          expectedImpact: 'Recover an estimated 40% of excess cycle time.',
          estimatedCostUsd: cost,
          annualBenefitUsd: benefit,
          roi: roiOf(benefit, cost),
          feasibility: 'high',
          confidence: 'low',
          team: 'Operations Training',
          safetyRelevance: 0.15,
          evidence: lean.motion.evidence,
        },
        clamp(lean.motion.score / 100),
      )
    }

    if (lean.extraProcessing.score >= 50) {
      const cost = 15_000
      const benefit = Math.round((lean.extraProcessing.estimatedCostUsd * 0.5 * 365) / filter.days)
      push(
        {
          id: `REC-DRILL-${siteId}`,
          title: `Drill pattern QA audit at Site ${siteId}`,
          siteId,
          category: 'lean',
          rationale: `Re-drill rate is ${lean.extraProcessing.value}% vs ${lean.extraProcessing.benchmark}.`,
          riskAddressed: 'Extra processing and downstream dilution',
          expectedImpact: 'Halve the re-drill rate (model estimate).',
          estimatedCostUsd: cost,
          annualBenefitUsd: benefit,
          roi: roiOf(benefit, cost),
          feasibility: 'high',
          confidence: 'medium',
          team: 'Drill & Blast',
          safetyRelevance: 0.1,
          evidence: lean.extraProcessing.evidence,
        },
        clamp(lean.extraProcessing.score / 100),
      )
    }

    if (lean.talent.score >= 30) {
      push(
        {
          id: `REC-RCA-${siteId}`,
          title: `5-Why root-cause program for repeat failures at Site ${siteId}`,
          siteId,
          category: 'maintenance',
          rationale: lean.talent.impact,
          riskAddressed: 'Repeat equipment failures; frontline knowledge not captured',
          expectedImpact: 'Reduce repeat failure modes. Benefit not estimated: insufficient data on RCA effectiveness.',
          estimatedCostUsd: 8_000,
          annualBenefitUsd: null,
          roi: null,
          feasibility: 'high',
          confidence: 'low',
          team: 'Reliability Engineering',
          safetyRelevance: 0.35,
          evidence: lean.talent.evidence,
        },
        clamp(lean.talent.score / 100),
      )
    }
  }

  for (const inc of allSlice.incidents.filter((i) => i.status === 'open' && (i.severity === 'critical' || i.severity === 'high'))) {
    push(
      {
        id: `REC-HSE-${inc.id}`,
        title: `Critical control verification for ${inc.id} (Site ${inc.siteId})`,
        siteId: inc.siteId,
        category: 'safety',
        rationale: `Open ${inc.severity} incident: ${inc.description}`,
        riskAddressed: 'Personnel and asset safety (HSE-PR-01)',
        expectedImpact: 'Close investigation and verify critical controls within 24 h. Financial ROI not applicable.',
        estimatedCostUsd: 2_500,
        annualBenefitUsd: null,
        roi: null,
        feasibility: 'high',
        confidence: 'high',
        team: 'HSE',
        safetyRelevance: inc.severity === 'critical' ? 1 : 0.85,
        evidence: [
          { dataset: 'incidents', recordId: inc.id, label: inc.description, value: `${inc.severity}, ${inc.status}`, timestamp: inc.date },
          { dataset: 'knowledge', recordId: 'DOC-007', label: 'Escalation procedure (HSE-PR-01)' },
        ],
      },
      inc.severity === 'critical' ? 0.8 : 0.6,
    )
  }

  return out.sort((a, b) => b.priorityScore - a.priorityScore)
}
