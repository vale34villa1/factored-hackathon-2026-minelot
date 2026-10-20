import { compareSites } from '@/lib/analytics/compare'
import { retrieveDocs } from '@/lib/analytics/evidence'
import { round, sliceDataset, type SiteFilter } from '@/lib/analytics/kpis'
import { analyzeLean, valueLeakage } from '@/lib/analytics/lean'
import { buildOverview } from '@/lib/analytics/overview'
import { buildRecommendations } from '@/lib/analytics/recommendations'
import { scoreEquipmentRisk } from '@/lib/analytics/risk'
import { runSimulation } from '@/lib/analytics/simulation'
import { dataset } from '@/lib/data/dataset'

export type OfflineIntent = 'risk' | 'lean' | 'simulate' | 'compare' | 'recommend' | 'overview'

export interface OfflineAnswer {
  tool: string
  text: string
}

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const ids = (refs: { recordId: string }[], n = 4) =>
  refs.slice(0, n).map((r) => r.recordId).join(', ') || 'n/a'

function parseSite(q: string): SiteFilter {
  const m = q.match(/\b(?:site|sitio)\s*([abc])\b/i)
  return m ? (m[1].toUpperCase() as SiteFilter) : 'all'
}

function parseDays(q: string): number {
  const m = q.match(/(\d{1,2})\s*(?:d\b|days?|d[ií]as?)/i)
  if (m) return Math.min(30, Math.max(7, Number(m[1])))
  if (/week|semana/i.test(q)) return 7
  return 30
}

function parsePct(q: string): number | null {
  const m = q.match(/(\d{1,2}(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) : null
}

export function detectIntent(q: string): OfflineIntent {
  const s = q.toLowerCase()
  if (/simulat|what[- ]if|escenario|reduc/.test(s)) return 'simulate'
  if (/compar|learn from|best[- ]perform|benchmark|mejor sitio|aprender/.test(s)) return 'compare'
  if (/risk|riesgo|maintenance|mantenimiento|equipment|equipo|failure|falla/.test(s)) return 'risk'
  if (/lean|waste|desperdicio|money|losing|dinero|cost|costo|leak/.test(s)) return 'lean'
  if (/recommend|recomend|action|acci[oó]n|priorit/.test(s)) return 'recommend'
  return 'overview'
}

const label = (site: SiteFilter) => (site === 'all' ? 'all sites' : `Site ${site}`)

function answerRisk(site: SiteFilter, days: number): string {
  const risks = scoreEquipmentRisk(sliceDataset(dataset, { site, days })).slice(0, 5)
  if (!risks.length) return `No equipment records for ${label(site)} in the last ${days} days.`
  const top = risks[0]
  const lines = risks.map((r) => {
    const f = [...r.factors].sort((a, b) => b.contribution - a.contribution)[0]
    return `- **${r.code}** (Site ${r.siteId}, ${r.type}): risk **${r.score}/100** (${r.level}). Main driver: ${f.label} — ${f.detail}`
  })
  return [
    `**${top.code}** at Site ${top.siteId} should be inspected first: risk score **${top.score}/100** (${top.level}).`,
    '',
    ...lines,
    '',
    `Suggested mitigation for ${top.code}: ${top.mitigation}`,
    `Evidence: ${ids(top.evidence)}`,
  ].join('\n')
}

function answerLean(site: SiteFilter, days: number): string {
  const wastes = analyzeLean(dataset, sliceDataset(dataset, { site, days })).sort(
    (a, b) => b.estimatedCostUsd - a.estimatedCostUsd,
  )
  const top = wastes[0]
  return [
    `The largest estimated loss for ${label(site)} is **${top.name}** at about **${usd(top.estimatedCostUsd)}** over ${days} days (total leakage ${usd(valueLeakage(wastes))}, estimate).`,
    '',
    ...wastes.slice(0, 4).map(
      (w) => `- **${w.name}**: ${w.indicator} = ${w.value} ${w.unit} (score ${w.score}/100, ~${usd(w.estimatedCostUsd)}, ${w.confidence} confidence)`,
    ),
    '',
    `Recommended next step: ${top.recommendation}`,
    `Evidence: ${ids(top.evidence, 3)}`,
  ].join('\n')
}

function answerSimulation(q: string, site: SiteFilter, days: number): string {
  const pct = parsePct(q) ?? 15
  const s = q.toLowerCase()
  const lever = /fuel|combustible/.test(s)
    ? { fuelReductionPct: Math.min(30, pct) }
    : /downtime|parada|detenci/.test(s)
      ? { downtimeReductionPct: Math.min(50, pct) }
      : { waitingReductionPct: Math.min(50, pct) }
  const r = runSimulation(dataset, { site, days, ...lever })
  const leverName = Object.keys(lever)[0].replace(/Pct$/, '').replace(/([A-Z])/g, ' $1').toLowerCase()
  return [
    `Simulated a **${pct}% ${leverName}** for ${label(site)} over ${days} days. Annualised benefit: **${usd(r.annualizedBenefitUsd)}** (deterministic model, not a forecast).`,
    '',
    ...r.metrics.map(
      (m) => `- **${m.label}**: ${round(m.baseline, 2)} → ${round(m.scenario, 2)} ${m.unit} (${m.deltaPct > 0 ? '+' : ''}${round(m.deltaPct, 1)}%, ${m.kind})`,
    ),
    ...(r.warnings.length ? ['', ...r.warnings.map((w) => `- Warning: ${w}`)] : []),
    '',
    'Open the What-if simulator to adjust every lever.',
  ].join('\n')
}

function answerCompare(site: SiteFilter, days: number): string {
  const { summaries, transfers } = compareSites(dataset, days)
  const best = [...summaries].sort((a, b) => b.productionEfficiency - a.productionEfficiency)[0]
  const focus = site === 'all' ? summaries.sort((a, b) => a.productionEfficiency - b.productionEfficiency)[0].siteId : site
  const relevant = transfers.filter((t) => t.worstSite === focus && t.bestSite !== focus)
  return [
    `**Site ${best.siteId}** leads on production efficiency (${best.productionEfficiency}%). Gaps for Site ${focus}:`,
    '',
    ...(relevant.length
      ? relevant.slice(0, 5).map((t) => `- **${t.label}**: Site ${t.bestSite} ${t.bestValue} ${t.unit} vs Site ${t.worstSite} ${t.worstValue} ${t.unit} (gap ${t.gap})`)
      : [`- Site ${focus} is not the weakest site on any tracked metric.`]),
    '',
    ...summaries.map(
      (x) => `- Site ${x.siteId}: efficiency ${x.productionEfficiency}%, availability ${x.availability}%, queue ${x.waitingShare}%, risk ${x.riskScore}/100`,
    ),
    '',
    'These are observed differences, not proof of causation; validate on site before transferring practices.',
  ].join('\n')
}

function answerRecommend(site: SiteFilter, days: number): string {
  const recs = buildRecommendations(dataset, { site, days }).slice(0, 5)
  return [
    `Top priorities for ${label(site)} (all require human approval):`,
    '',
    ...recs.map(
      (r) =>
        `- **${r.title}** (Site ${r.siteId}, ${r.category}): priority ${r.priorityScore}, cost ${usd(r.estimatedCostUsd)}${r.roi != null ? `, ROI ${r.roi}x` : ''}. ${r.expectedImpact}`,
    ),
    '',
    `Evidence: ${recs.flatMap((r) => r.evidence.slice(0, 1)).map((e) => e.recordId).join(', ')}`,
  ].join('\n')
}

function answerOverview(site: SiteFilter, days: number): string {
  const o = buildOverview(dataset, { site, days })
  const k = o.kpis
  const shortfall = k.targetTons - k.actualTons
  return [
    `${label(site)}, ${o.period.from} → ${o.period.to}: production efficiency **${k.productionEfficiency}%** (${shortfall > 0 ? `${shortfall.toLocaleString('en-US')} t below target` : 'on target'}), operational risk **${k.riskScore}/100**.`,
    '',
    `- Equipment availability: ${k.availability}% (${k.downtimeHours} h downtime)`,
    `- Truck queue share: ${k.waitingShare}%`,
    `- Fuel intensity: ${k.fuelIntensity} L/t`,
    `- Estimated Lean value leakage: ${usd(k.valueLeakageUsd)}`,
    `- Open high/critical incidents: ${k.openCriticalIncidents}`,
    '',
    `Highest-risk equipment: ${o.topRisks.slice(0, 3).map((r) => `${r.code} (${r.score})`).join(', ')}.`,
    `Top action: ${o.recommendations[0]?.title ?? 'none'}.`,
  ].join('\n')
}

export function answerOffline(question: string): OfflineAnswer {
  const site = parseSite(question)
  const days = parseDays(question)
  const intent = detectIntent(question)
  const body = {
    risk: () => ({ tool: 'getRisk', text: answerRisk(site, days) }),
    lean: () => ({ tool: 'getLeanWaste', text: answerLean(site, days) }),
    simulate: () => ({ tool: 'runSimulation', text: answerSimulation(question, site, days) }),
    compare: () => ({ tool: 'compareSites', text: answerCompare(site, days) }),
    recommend: () => ({ tool: 'getRecommendations', text: answerRecommend(site, days) }),
    overview: () => ({ tool: 'getOverview', text: answerOverview(site, days) }),
  }[intent]()
  const doc = retrieveDocs(dataset.knowledge, question, 1)[0]
  const ref = doc ? `\nReference: ${doc.title} (${doc.id}).` : ''
  return { tool: body.tool, text: `${body.text}${ref}\n\n_Offline mode: answer generated directly by the analytics engine (synthetic data)._` }
}
