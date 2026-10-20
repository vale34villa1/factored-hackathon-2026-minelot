import type { Dataset } from '@/lib/data/types'
import { coreKpis, dailyProduction, downtimeByEquipment, recentEvents, round, sliceDataset, type Filter } from './kpis'
import { analyzeLean, leanWasteScore, valueLeakage } from './lean'
import { buildRecommendations } from './recommendations'
import { aggregateRisk, riskDistribution, scoreEquipmentRisk } from './risk'

export function buildOverview(ds: Dataset, filter: Filter) {
  const s = sliceDataset(ds, filter)
  const k = coreKpis(s)
  const risks = scoreEquipmentRisk(s)
  const lean = analyzeLean(ds, s)
  const recs = buildRecommendations(ds, filter).slice(0, 4)
  return {
    period: { from: s.from, to: s.to, days: s.days },
    site: filter.site,
    kpis: {
      riskScore: aggregateRisk(risks),
      productionEfficiency: round(k.productionEfficiency * 100, 1),
      availability: round(k.availability * 100, 1),
      leanWasteScore: leanWasteScore(lean),
      fuelIntensity: round(k.fuelIntensity, 3),
      valueLeakageUsd: Math.round(valueLeakage(lean)),
      openCriticalIncidents: k.openCriticalIncidents,
      actualTons: k.actualTons,
      targetTons: k.targetTons,
      downtimeHours: round(k.downtimeHours, 1),
      waitingShare: round(k.waitingShare * 100, 1),
    },
    productionTrend: dailyProduction(s),
    downtime: downtimeByEquipment(s).slice(0, 8),
    riskDistribution: riskDistribution(risks),
    topRisks: risks.slice(0, 5).map((r) => ({ equipmentId: r.equipmentId, code: r.code, siteId: r.siteId, score: r.score, level: r.level })),
    lean: lean.map((w) => ({ key: w.key, name: w.name, score: w.score, estimatedCostUsd: w.estimatedCostUsd })),
    events: recentEvents(s),
    recommendations: recs.map((r) => ({ id: r.id, title: r.title, siteId: r.siteId, priorityScore: r.priorityScore, category: r.category, roi: r.roi })),
  }
}

export type Overview = ReturnType<typeof buildOverview>
