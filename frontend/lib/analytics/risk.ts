import type { Dataset, EvidenceRef, IncidentRecord, Severity, SiteId } from '@/lib/data/types'
import { ASSUMPTIONS } from './assumptions'
import { clamp, round, safeDiv, shiftDate, sliceDataset, sum, type Filter, type Slice } from './kpis'

/**
 * PROTOTYPE risk scoring model — not a validated mining safety standard.
 *   score = 100 × likelihood × severity × exposure
 *   likelihood = Σ weight_i × factor_i  (each factor normalised 0–1)
 *   severity   = min(5, criticality + incident bump) / 5
 *   exposure   = 0.4 + 0.6 × (operating hours / scheduled hours)
 */
export const RISK_MODEL = {
  weights: { downtime: 0.3, condition: 0.25, workOrders: 0.2, incidents: 0.25 },
  downtimeRateCeiling: 0.2,
  vibration: { floor: 2.5, ceiling: 6.5 },
  temperature: { floor: 90, ceiling: 115 },
  openWorkOrderCeiling: 2,
  incidentWeight: { low: 0.1, medium: 0.25, high: 0.5, critical: 1 } satisfies Record<Severity, number>,
  openIncidentMultiplier: 1.5,
  severityBump: { low: 0, medium: 0, high: 1, critical: 2 } satisfies Record<Severity, number>,
  levels: { critical: 60, high: 40, medium: 20 },
} as const

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_MODEL.levels.critical) return 'critical'
  if (score >= RISK_MODEL.levels.high) return 'high'
  if (score >= RISK_MODEL.levels.medium) return 'medium'
  return 'low'
}

export interface RiskFactor {
  key: keyof typeof RISK_MODEL.weights
  label: string
  normalized: number
  contribution: number
  detail: string
}

export interface EquipmentRisk {
  equipmentId: string
  code: string
  type: string
  siteId: SiteId
  score: number
  level: RiskLevel
  likelihood: number
  severity: number
  exposure: number
  factors: RiskFactor[]
  evidence: EvidenceRef[]
  mitigation: string
}

function incidentLoad(incidents: IncidentRecord[]) {
  return incidents.reduce(
    (s, i) =>
      s +
      RISK_MODEL.incidentWeight[i.severity] * (i.status === 'open' ? RISK_MODEL.openIncidentMultiplier : 1),
    0,
  )
}

const MITIGATIONS: Record<RiskFactor['key'], string> = {
  condition: 'Schedule condition-based inspection (vibration / thermal) before next shift; supervisor sign-off required to return to service.',
  downtime: 'Review failure history and bring forward planned maintenance; verify spare parts availability.',
  workOrders: 'Expedite open corrective and predictive work orders; confirm backlog owner and due date.',
  incidents: 'Run critical control verification and close out open incident investigations within 24 h.',
}

export function scoreEquipmentRisk(s: Slice): EquipmentRisk[] {
  const results: EquipmentRisk[] = []
  for (const eq of s.equipment) {
    const tel = s.telemetry.filter((t) => t.equipmentId === eq.id).sort((a, b) => a.date.localeCompare(b.date))
    if (tel.length === 0) continue
    const scheduled = sum(tel, (t) => t.scheduledHours)
    const downtime = sum(tel, (t) => t.unplannedDowntimeHours)
    const operating = sum(tel, (t) => t.operatingHours)
    const recent = tel.slice(-3)
    const vib = safeDiv(sum(recent, (t) => t.vibrationIndex), recent.length)
    const temp = safeDiv(sum(recent, (t) => t.engineTempMaxC), recent.length)
    const openWos = s.maintenance.filter(
      (m) => m.equipmentId === eq.id && m.status === 'open' && m.type !== 'preventive',
    )
    const incidents = s.incidents.filter((i) => i.equipmentId === eq.id)

    const dNorm = clamp(safeDiv(downtime, scheduled) / RISK_MODEL.downtimeRateCeiling)
    const vNorm = clamp((vib - RISK_MODEL.vibration.floor) / (RISK_MODEL.vibration.ceiling - RISK_MODEL.vibration.floor))
    const tNorm = clamp((temp - RISK_MODEL.temperature.floor) / (RISK_MODEL.temperature.ceiling - RISK_MODEL.temperature.floor))
    const cNorm = Math.max(vNorm, tNorm)
    const wNorm = clamp(openWos.length / RISK_MODEL.openWorkOrderCeiling)
    const iNorm = clamp(incidentLoad(incidents))

    const w = RISK_MODEL.weights
    const factors: RiskFactor[] = [
      {
        key: 'downtime',
        label: 'Unplanned downtime',
        normalized: dNorm,
        contribution: w.downtime * dNorm,
        detail: `${round(downtime, 1)} h unplanned (${round(safeDiv(downtime, scheduled) * 100, 1)}% of scheduled)`,
      },
      {
        key: 'condition',
        label: 'Condition monitoring',
        normalized: cNorm,
        contribution: w.condition * cNorm,
        detail: `Vibration ${round(vib, 2)} (threshold ${ASSUMPTIONS.benchmarks.vibrationThreshold}), max temp ${round(temp, 1)} °C (3-day avg)`,
      },
      {
        key: 'workOrders',
        label: 'Open work orders',
        normalized: wNorm,
        contribution: w.workOrders * wNorm,
        detail: `${openWos.length} open corrective/predictive work order(s)`,
      },
      {
        key: 'incidents',
        label: 'Incident history',
        normalized: iNorm,
        contribution: w.incidents * iNorm,
        detail: `${incidents.length} incident(s), ${incidents.filter((i) => i.status === 'open').length} open`,
      },
    ]
    const likelihood = clamp(sum(factors, (f) => f.contribution))
    const bump = incidents.reduce((m, i) => Math.max(m, RISK_MODEL.severityBump[i.severity]), 0)
    const severity = Math.min(5, eq.criticality + bump) / 5
    const exposure = 0.4 + 0.6 * clamp(safeDiv(operating, scheduled))
    const score = Math.round(100 * likelihood * severity * exposure)

    const peakTel = [...tel].sort((a, b) => b.unplannedDowntimeHours - a.unplannedDowntimeHours)[0]
    const latest = tel[tel.length - 1]
    const evidence: EvidenceRef[] = [
      {
        dataset: 'telemetry',
        recordId: latest.id,
        label: `Latest telemetry for ${eq.code}`,
        value: `vibration ${latest.vibrationIndex}, temp ${latest.engineTempMaxC} °C`,
        timestamp: latest.date,
      },
      {
        dataset: 'telemetry',
        recordId: peakTel.id,
        label: `Peak downtime day for ${eq.code}`,
        value: `${peakTel.unplannedDowntimeHours} h unplanned`,
        timestamp: peakTel.date,
      },
      ...openWos.map<EvidenceRef>((m) => ({
        dataset: 'maintenance',
        recordId: m.id,
        label: m.description,
        value: `${m.type}, ${m.priority} priority, ${m.status}`,
        timestamp: m.openedDate,
      })),
      ...incidents.map<EvidenceRef>((i) => ({
        dataset: 'incidents',
        recordId: i.id,
        label: i.description,
        value: `${i.severity}, ${i.status}`,
        timestamp: i.date,
      })),
    ]
    const dominant = [...factors].sort((a, b) => b.contribution - a.contribution)[0]
    results.push({
      equipmentId: eq.id,
      code: eq.code,
      type: eq.type,
      siteId: eq.siteId,
      score,
      level: riskLevel(score),
      likelihood: round(likelihood, 3),
      severity: round(severity, 2),
      exposure: round(exposure, 3),
      factors,
      evidence,
      mitigation: MITIGATIONS[dominant.key],
    })
  }
  return results.sort((a, b) => b.score - a.score)
}

/** Aggregate operational risk = mean of the top-3 equipment risk scores in scope. */
export function aggregateRisk(risks: EquipmentRisk[]): number {
  const top = risks.slice(0, 3)
  return top.length ? Math.round(safeDiv(sum(top, (r) => r.score), top.length)) : 0
}

export function riskDistribution(risks: EquipmentRisk[]) {
  const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low']
  return levels.map((level) => ({ level, count: risks.filter((r) => r.level === level).length }))
}

export function riskTrend(ds: Dataset, filter: Filter, windows = 4) {
  const siteIds: SiteId[] = filter.site === 'all' ? ['A', 'B', 'C'] : [filter.site]
  const step = Math.max(1, Math.floor(filter.days / windows))
  const points: Record<string, number | string>[] = []
  for (let w = windows - 1; w >= 0; w--) {
    const end = shiftDate(ds.meta.endDate, -w * step)
    const point: Record<string, number | string> = { date: end }
    for (const siteId of siteIds) {
      point[siteId] = aggregateRisk(scoreEquipmentRisk(sliceDataset(ds, { site: siteId, days: 7 }, end)))
    }
    points.push(point)
  }
  return points
}
