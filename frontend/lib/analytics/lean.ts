import type { Dataset, EvidenceRef, TelemetryRecord } from '@/lib/data/types'
import { ASSUMPTIONS } from './assumptions'
import { clamp, fuelIntensity, round, safeDiv, sliceDataset, sum, truckRows, type Slice } from './kpis'

export type LeanKey =
  | 'defects'
  | 'overproduction'
  | 'waiting'
  | 'talent'
  | 'transportation'
  | 'inventory'
  | 'motion'
  | 'extraProcessing'
  | 'energy'

export type Confidence = 'high' | 'medium' | 'low'

export interface LeanWaste {
  key: LeanKey
  name: string
  group: 'lean' | 'energy'
  indicator: string
  value: number
  unit: string
  benchmark: string
  score: number
  estimatedCostUsd: number
  impact: string
  recommendation: string
  confidence: Confidence
  assumptions: string[]
  evidence: EvidenceRef[]
}

const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

function byType(s: Slice, types: string[]): TelemetryRecord[] {
  const ids = new Set(s.equipment.filter((e) => types.includes(e.type)).map((e) => e.id))
  return s.telemetry.filter((t) => ids.has(t.equipmentId))
}

function topBy<T extends { id: string }>(rows: T[], pick: (r: T) => number, n = 2) {
  return [...rows].sort((a, b) => pick(b) - pick(a)).slice(0, n)
}

/** Best (lowest) fuel intensity among all sites for the same period — used as an internal benchmark. */
function bestSiteFuelIntensity(ds: Dataset, days: number, endDate: string) {
  const values = ds.sites.map((site) => {
    const sl = sliceDataset(ds, { site: site.id, days }, endDate)
    return { siteId: site.id, value: fuelIntensity(sl.telemetry, sl.production) }
  })
  return values.sort((a, b) => a.value - b.value)[0]
}

export function analyzeLean(ds: Dataset, s: Slice): LeanWaste[] {
  const trucks = truckRows(s.telemetry, s.equipment)
  const loaders = byType(s, ['shovel', 'loader'])
  const drills = byType(s, ['drill'])
  const actual = sum(s.production, (p) => p.actualTons)
  const b = ASSUMPTIONS.benchmarks
  const diesel = ASSUMPTIONS.dieselPricePerLiter

  // Waiting
  const truckOp = sum(trucks, (t) => t.operatingHours)
  const waitH = sum(trucks, (t) => t.waitingHours)
  const waitShare = safeDiv(waitH, truckOp)
  const excessWaitH = Math.max(0, waitH - truckOp * (b.waitingSharePct / 100))
  const truckRate = safeDiv(sum(trucks, (t) => t.tonsHauled), truckOp - waitH)
  const waitCost =
    waitH * (ASSUMPTIONS.operatorCostPerHour + ASSUMPTIONS.idleBurnLitersPerHour * diesel) +
    excessWaitH * truckRate * ASSUMPTIONS.contributionMarginPerTon

  // Defects (off-spec / rehandled material)
  const rework = sum(s.production, (p) => p.reworkTons)
  const reworkShare = safeDiv(rework, actual)

  // Overproduction (mined beyond crusher feed)
  const excessMined = sum(s.production, (p) => Math.max(0, p.actualTons - p.crusherFeedTons))
  const overShare = safeDiv(excessMined, actual)

  // Inventory (stockpile cover in shifts of crusher capacity)
  const coverRows = s.production.map((p) => {
    const site = s.sites.find((x) => x.id === p.siteId)
    return safeDiv(p.stockpileTons, site?.crusherCapacityPerShift ?? 1)
  })
  const cover = safeDiv(sum(coverRows, (v) => v), coverRows.length)
  const avgCapacity = safeDiv(sum(s.sites, (x) => x.crusherCapacityPerShift), s.sites.length)
  const excessStock = Math.max(0, (cover - ASSUMPTIONS.stockpileTargetShifts) * avgCapacity * s.sites.length)

  // Transportation
  const truckFuel = sum(trucks, (t) => t.fuelLiters)
  const dev = safeDiv(sum(trucks, (t) => t.routeDeviationPct * t.operatingHours), truckOp)
  const extraFuel = sum(trucks, (t) => t.fuelLiters * (t.routeDeviationPct / (100 + t.routeDeviationPct)))

  // Motion (loading cycle excess)
  const cycleRows = loaders.filter((t) => t.cycleTimeSec !== null)
  const cycle = safeDiv(sum(cycleRows, (t) => t.cycleTimeSec ?? 0), cycleRows.length)
  const loaderOp = sum(loaders, (t) => t.operatingHours)
  const motionLostH = loaderOp * Math.max(0, safeDiv(cycle - b.shovelCycleSec, cycle))
  const motionCost = motionLostH * (ASSUMPTIONS.operatorCostPerHour + 120 * diesel)

  // Extra processing (re-drill)
  const redrill = safeDiv(sum(drills, (t) => t.redrillPct ?? 0), drills.length)
  const drillOp = sum(drills, (t) => t.operatingHours)
  const redrillCost = drillOp * (redrill / 100) * (ASSUMPTIONS.operatorCostPerHour + 45 * diesel)

  // Non-utilised talent (repeat failures without RCA — proxy)
  const corrective = s.maintenance.filter((m) => m.type === 'corrective' && m.failureMode)
  const seen = new Map<string, number>()
  const repeats = corrective
    .sort((x, y) => x.openedDate.localeCompare(y.openedDate))
    .filter((m) => {
      const key = `${m.equipmentId}|${m.failureMode}`
      const n = (seen.get(key) ?? 0) + 1
      seen.set(key, n)
      return n > 1
    })
  const repeatShare = safeDiv(repeats.length, corrective.length)

  // Energy & fuel
  const allWait = sum(s.telemetry, (t) => t.waitingHours)
  const idleLiters = allWait * ASSUMPTIONS.idleBurnLitersPerHour
  const totalFuel = sum(s.telemetry, (t) => t.fuelLiters)
  const fi = fuelIntensity(s.telemetry, s.production)
  const best = bestSiteFuelIntensity(ds, s.days, s.to)
  const fiGap = safeDiv(fi - best.value, best.value)
  const idleShare = safeDiv(idleLiters, totalFuel)

  const lastProd = s.production[s.production.length - 1]
  const prodEvidence = (label: string, rows = s.production): EvidenceRef[] =>
    topBy(rows, (p) => p.reworkTons).map((p) => ({
      dataset: 'production',
      recordId: p.id,
      label,
      value: `${p.actualTons.toLocaleString('en-US')} t actual, ${p.reworkTons} t rework, stockpile ${p.stockpileTons.toLocaleString('en-US')} t`,
      timestamp: p.date,
    }))
  const telEvidence = (rows: TelemetryRecord[], pick: (t: TelemetryRecord) => number, label: string, fmt: (t: TelemetryRecord) => string) =>
    topBy(rows, pick).map<EvidenceRef>((t) => ({ dataset: 'telemetry', recordId: t.id, label, value: fmt(t), timestamp: t.date }))

  const wastes: LeanWaste[] = [
    {
      key: 'waiting',
      name: 'Waiting',
      group: 'lean',
      indicator: 'Truck queue time / operating hours',
      value: round(waitShare * 100, 1),
      unit: '%',
      benchmark: `< ${b.waitingSharePct}% (SOP-DSP-04)`,
      score: Math.round(clamp((waitShare - 0.04) / 0.16) * 100),
      estimatedCostUsd: Math.round(waitCost),
      impact: `${round(waitH, 0)} truck-hours spent in queue; ${round(excessWaitH, 0)} h above benchmark ≈ ${Math.round(excessWaitH * truckRate).toLocaleString('en-US')} t of haulage capacity.`,
      recommendation: 'Rebalance truck–shovel assignments in dispatch and review loading unit cycle times.',
      confidence: 'high',
      assumptions: ['Operator cost and idle fuel burn per queued hour', `Lost capacity valued at $${ASSUMPTIONS.contributionMarginPerTon}/t contribution margin`],
      evidence: [
        ...telEvidence(trucks, (t) => t.waitingHours, 'High truck queue day', (t) => `${t.waitingHours} h waiting of ${t.operatingHours} h operating`),
        { dataset: 'knowledge', recordId: 'DOC-001', label: 'Queue benchmark (SOP-DSP-04)' },
      ],
    },
    {
      key: 'defects',
      name: 'Defects',
      group: 'lean',
      indicator: 'Off-spec / rehandled tonnage share',
      value: round(reworkShare * 100, 2),
      unit: '%',
      benchmark: '< 1.0% (internal target)',
      score: Math.round(clamp((reworkShare - 0.005) / 0.035) * 100),
      estimatedCostUsd: Math.round(rework * ASSUMPTIONS.rehandleCostPerTon),
      impact: `${Math.round(rework).toLocaleString('en-US')} t rehandled due to dilution or misrouting.`,
      recommendation: 'Tighten ore-control mark-up and dig-face supervision; audit truck destination compliance.',
      confidence: 'medium',
      assumptions: [`Rehandle cost $${ASSUMPTIONS.rehandleCostPerTon}/t`, 'Rework tonnage recorded per shift is complete'],
      evidence: prodEvidence('Highest rework shift'),
    },
    {
      key: 'overproduction',
      name: 'Overproduction',
      group: 'lean',
      indicator: 'Tons mined beyond crusher feed',
      value: round(overShare * 100, 1),
      unit: '%',
      benchmark: '< 5% of mined tons',
      score: Math.round(clamp(overShare / 0.1) * 100),
      estimatedCostUsd: Math.round(excessMined * ASSUMPTIONS.rehandleCostPerTon),
      impact: `${Math.round(excessMined).toLocaleString('en-US')} t sent to stockpile instead of direct feed.`,
      recommendation: 'Align mine plan to crusher capacity; shift excess fleet hours to waste stripping or maintenance.',
      confidence: 'medium',
      assumptions: ['Material sent to stockpile is later rehandled', `Rehandle cost $${ASSUMPTIONS.rehandleCostPerTon}/t`],
      evidence: [
        ...topBy(s.production, (p) => p.actualTons - p.crusherFeedTons).map<EvidenceRef>((p) => ({
          dataset: 'production',
          recordId: p.id,
          label: 'Shift with largest mined-vs-feed gap',
          value: `${p.actualTons.toLocaleString('en-US')} t mined vs ${p.crusherFeedTons.toLocaleString('en-US')} t crusher feed`,
          timestamp: p.date,
        })),
        { dataset: 'knowledge', recordId: 'DOC-009', label: 'Stockpile policy (PLN-PL-05)' },
      ],
    },
    {
      key: 'inventory',
      name: 'Inventory',
      group: 'lean',
      indicator: 'ROM stockpile cover (shifts of crusher feed)',
      value: round(cover, 2),
      unit: 'shifts',
      benchmark: `≤ ${ASSUMPTIONS.stockpileTargetShifts} shifts (PLN-PL-05)`,
      score: Math.round(clamp((cover - ASSUMPTIONS.stockpileTargetShifts) / 1.5) * 100),
      estimatedCostUsd: Math.round(excessStock * ASSUMPTIONS.rehandleCostPerTon),
      impact: `Average stockpile exceeds target cover by ≈ ${Math.round(excessStock).toLocaleString('en-US')} t. May overlap with overproduction.`,
      recommendation: 'Draw down stockpile during crusher-limited shifts; review blend plan.',
      confidence: 'medium',
      assumptions: ['Excess inventory valued at rehandle cost only (no working-capital charge)'],
      evidence: lastProd
        ? [
            {
              dataset: 'production',
              recordId: lastProd.id,
              label: 'Latest stockpile level',
              value: `${lastProd.stockpileTons.toLocaleString('en-US')} t`,
              timestamp: lastProd.date,
            },
            { dataset: 'knowledge', recordId: 'DOC-009', label: 'Stockpile policy (PLN-PL-05)' },
          ]
        : [],
    },
    {
      key: 'transportation',
      name: 'Transportation',
      group: 'lean',
      indicator: 'Haul route deviation vs planned distance',
      value: round(dev, 1),
      unit: '%',
      benchmark: `< ${b.routeDeviationPct}% (OPS-MAN-07)`,
      score: Math.round(clamp((dev - 3) / 12) * 100),
      estimatedCostUsd: Math.round(extraFuel * diesel),
      impact: `≈ ${Math.round(extraFuel).toLocaleString('en-US')} L of truck fuel attributable to extra haul distance.`,
      recommendation: 'Survey haul road condition and verify dispatch route assignments.',
      confidence: 'medium',
      assumptions: ['Fuel scales linearly with route deviation', `Diesel $${diesel}/L`],
      evidence: [
        ...telEvidence(trucks, (t) => t.routeDeviationPct, 'Highest route deviation', (t) => `${t.routeDeviationPct}% deviation, ${t.fuelLiters.toLocaleString('en-US')} L`),
        { dataset: 'knowledge', recordId: 'DOC-004', label: 'Route compliance (OPS-MAN-07)' },
      ],
    },
    {
      key: 'motion',
      name: 'Motion',
      group: 'lean',
      indicator: 'Loading unit cycle time',
      value: round(cycle, 1),
      unit: 's',
      benchmark: `${b.shovelCycleSec} s reference (OPS-BM-03)`,
      score: Math.round(clamp((cycle - b.shovelCycleSec) / 8) * 100),
      estimatedCostUsd: Math.round(motionCost),
      impact: `≈ ${round(motionLostH, 0)} loading-unit hours lost to excess swing/spot motion.`,
      recommendation: 'Operator coaching on swing–dump technique; review fragmentation and truck spotting.',
      confidence: 'medium',
      assumptions: ['Excess cycle time is recoverable motion', 'Blended loading-unit fuel 120 L/h'],
      evidence: [
        ...telEvidence(cycleRows, (t) => t.cycleTimeSec ?? 0, 'Slowest loading cycle', (t) => `${t.cycleTimeSec} s cycle`),
        { dataset: 'knowledge', recordId: 'DOC-005', label: 'Cycle benchmark (OPS-BM-03)' },
      ],
    },
    {
      key: 'extraProcessing',
      name: 'Extra processing',
      group: 'lean',
      indicator: 'Re-drill rate',
      value: round(redrill, 1),
      unit: '%',
      benchmark: `< ${b.redrillPct}% (DB-QA-09)`,
      score: Math.round(clamp((redrill - 2) / 8) * 100),
      estimatedCostUsd: Math.round(redrillCost),
      impact: `≈ ${round(drillOp * (redrill / 100), 0)} drill-hours spent re-drilling holes.`,
      recommendation: 'Audit pattern mark-up and hole collapse; stem holes faster after drilling.',
      confidence: 'medium',
      assumptions: ['Re-drill time proportional to re-drill rate', 'Drill fuel 45 L/h'],
      evidence: [
        ...telEvidence(drills, (t) => t.redrillPct ?? 0, 'Highest re-drill day', (t) => `${t.redrillPct}% re-drill`),
        { dataset: 'knowledge', recordId: 'DOC-006', label: 'Drill QA (DB-QA-09)' },
      ],
    },
    {
      key: 'talent',
      name: 'Non-utilized talent',
      group: 'lean',
      indicator: 'Repeat failures without root-cause record (proxy)',
      value: round(repeatShare * 100, 0),
      unit: '%',
      benchmark: '< 15% of corrective work orders',
      score: Math.round(clamp(repeatShare / 0.5) * 100),
      estimatedCostUsd: Math.round(sum(repeats, (m) => m.costUsd)),
      impact: `${repeats.length} of ${corrective.length} corrective work orders repeat an earlier failure mode on the same asset.`,
      recommendation: 'Run 5-Why sessions with operators and maintainers for each repeat failure mode.',
      confidence: 'low',
      assumptions: ['Repeat failures used as a proxy; the dataset has no direct measure of talent utilisation', 'Cost = direct repair cost of repeat work orders'],
      evidence: [
        ...repeats.slice(0, 3).map<EvidenceRef>((m) => ({
          dataset: 'maintenance',
          recordId: m.id,
          label: `Repeat failure: ${m.failureMode}`,
          value: `${m.downtimeHours} h, ${usd(m.costUsd)}`,
          timestamp: m.openedDate,
        })),
        { dataset: 'knowledge', recordId: 'DOC-008', label: 'CI program (CI-PR-02)' },
      ],
    },
    {
      key: 'energy',
      name: 'Energy & fuel',
      group: 'energy',
      indicator: 'Fuel intensity vs best site',
      value: round(fi, 3),
      unit: 'L/t',
      benchmark: `${round(best.value, 3)} L/t (Site ${best.siteId}, same period)`,
      score: Math.round(clamp(fiGap / 0.25) * 70 + clamp(idleShare / 0.05) * 30),
      estimatedCostUsd: Math.round(idleLiters * diesel),
      impact: `${Math.round(idleLiters).toLocaleString('en-US')} L burned idling (${round(idleShare * 100, 1)}% of fuel) ≈ ${round((idleLiters * ASSUMPTIONS.co2KgPerLiterDiesel) / 1000, 1)} t CO2.`,
      recommendation: 'Enforce idle shutdown in queues >5 min and target queue reduction at loading units.',
      confidence: 'medium',
      assumptions: [`Idle burn ${ASSUMPTIONS.idleBurnLitersPerHour} L/h`, `CO2 ${ASSUMPTIONS.co2KgPerLiterDiesel} kg/L`, 'Cost counts idle fuel only'],
      evidence: [
        ...telEvidence(s.telemetry, (t) => t.waitingHours, 'Highest idle day', (t) => `${t.waitingHours} h idle, ${t.fuelLiters.toLocaleString('en-US')} L`),
        { dataset: 'knowledge', recordId: 'DOC-003', label: 'Idle guideline (ENV-GL-02)' },
      ],
    },
  ]
  return wastes
}

export function leanWasteScore(wastes: LeanWaste[]): number {
  return wastes.length ? Math.round(safeDiv(sum(wastes, (w) => w.score), wastes.length)) : 0
}

export function valueLeakage(wastes: LeanWaste[]): number {
  return sum(wastes, (w) => w.estimatedCostUsd)
}
