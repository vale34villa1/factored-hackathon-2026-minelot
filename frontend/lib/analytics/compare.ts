import type { Dataset, SiteId } from '@/lib/data/types'
import { coreKpis, round, sliceDataset } from './kpis'
import { analyzeLean, leanWasteScore } from './lean'
import { aggregateRisk, scoreEquipmentRisk } from './risk'

export interface SiteSummary {
  siteId: SiteId
  name: string
  region: string
  productionEfficiency: number
  availability: number
  fuelIntensity: number
  downtimeHours: number
  waitingShare: number
  routeDeviationPct: number
  riskScore: number
  leanScore: number
  openIncidents: number
}

export function summarizeSite(ds: Dataset, siteId: SiteId, days: number): SiteSummary {
  const s = sliceDataset(ds, { site: siteId, days })
  const k = coreKpis(s)
  const site = ds.sites.find((x) => x.id === siteId)!
  return {
    siteId,
    name: site.name,
    region: site.region,
    productionEfficiency: round(k.productionEfficiency * 100, 1),
    availability: round(k.availability * 100, 1),
    fuelIntensity: round(k.fuelIntensity, 3),
    downtimeHours: round(k.downtimeHours, 1),
    waitingShare: round(k.waitingShare * 100, 1),
    routeDeviationPct: round(k.routeDeviationPct, 1),
    riskScore: aggregateRisk(scoreEquipmentRisk(s)),
    leanScore: leanWasteScore(analyzeLean(ds, s)),
    openIncidents: k.openIncidents,
  }
}

export const COMPARE_METRICS: {
  key: keyof SiteSummary
  label: string
  unit: string
  better: 'higher' | 'lower'
  evidenceHint: string
}[] = [
  { key: 'productionEfficiency', label: 'Production efficiency', unit: '%', better: 'higher', evidenceHint: 'production.json actual vs target tons' },
  { key: 'availability', label: 'Equipment availability', unit: '%', better: 'higher', evidenceHint: 'telemetry.json scheduled − downtime − planned' },
  { key: 'fuelIntensity', label: 'Fuel intensity', unit: 'L/t', better: 'lower', evidenceHint: 'telemetry.json fuel ÷ production.json tons' },
  { key: 'downtimeHours', label: 'Unplanned downtime', unit: 'h', better: 'lower', evidenceHint: 'telemetry.json unplanned downtime' },
  { key: 'waitingShare', label: 'Truck queue share', unit: '%', better: 'lower', evidenceHint: 'telemetry.json truck waiting ÷ operating' },
  { key: 'routeDeviationPct', label: 'Route deviation', unit: '%', better: 'lower', evidenceHint: 'telemetry.json route deviation' },
  { key: 'riskScore', label: 'Operational risk', unit: '/100', better: 'lower', evidenceHint: 'Prototype risk model (top-3 equipment)' },
  { key: 'leanScore', label: 'Lean waste score', unit: '/100', better: 'lower', evidenceHint: 'Lean engine, 9 categories' },
]

export function compareSites(ds: Dataset, days: number, siteIds: SiteId[] = ['A', 'B', 'C']) {
  const summaries = siteIds.map((id) => summarizeSite(ds, id, days))
  const transfers = COMPARE_METRICS.map((m) => {
    const sorted = [...summaries].sort((a, b) =>
      m.better === 'higher' ? (b[m.key] as number) - (a[m.key] as number) : (a[m.key] as number) - (b[m.key] as number),
    )
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const gap = round(Math.abs((best[m.key] as number) - (worst[m.key] as number)), 3)
    return {
      metric: m.key,
      label: m.label,
      unit: m.unit,
      bestSite: best.siteId,
      bestValue: best[m.key] as number,
      worstSite: worst.siteId,
      worstValue: worst[m.key] as number,
      gap,
      evidence: m.evidenceHint,
      note: `Site ${best.siteId} outperforms Site ${worst.siteId} on ${m.label.toLowerCase()} by ${gap} ${m.unit}. This is an observed difference, not evidence that one site's practices cause the other's results; confirm with on-site review before transferring practices.`,
    }
  })
  return { summaries, transfers }
}
