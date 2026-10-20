import { describe, expect, it } from 'vitest'
import { dataset } from '@/lib/data/dataset'
import { compareSites } from './compare'
import { coreKpis, productionEfficiency, sliceDataset } from './kpis'
import { analyzeLean } from './lean'
import { buildRecommendations } from './recommendations'
import { aggregateRisk, riskLevel, scoreEquipmentRisk } from './risk'
import { runSimulation } from './simulation'

describe('KPIs', () => {
  it('computes production efficiency and handles empty input', () => {
    expect(productionEfficiency([])).toBe(0)
    const s = sliceDataset(dataset, { site: 'A', days: 30 })
    const k = coreKpis(s)
    expect(k.productionEfficiency).toBeGreaterThan(0.7)
    expect(k.productionEfficiency).toBeLessThan(0.95)
    expect(k.availability).toBeGreaterThan(0)
    expect(k.availability).toBeLessThanOrEqual(1)
  })

  it('slices by site and date range', () => {
    const s = sliceDataset(dataset, { site: 'B', days: 7 })
    expect(s.telemetry.every((t) => t.siteId === 'B' && t.date >= s.from)).toBe(true)
    expect(new Set(s.telemetry.map((t) => t.date)).size).toBe(7)
  })
})

describe('Risk model', () => {
  it('maps scores to levels', () => {
    expect(riskLevel(75)).toBe('critical')
    expect(riskLevel(45)).toBe('high')
    expect(riskLevel(25)).toBe('medium')
    expect(riskLevel(5)).toBe('low')
  })

  it('flags T-24 as the top risk at Site A', () => {
    const risks = scoreEquipmentRisk(sliceDataset(dataset, { site: 'A', days: 30 }))
    expect(risks[0].code).toBe('T-24')
    expect(['critical', 'high']).toContain(risks[0].level)
    expect(risks[0].evidence.length).toBeGreaterThan(0)
  })

  it('ranks Site B lowest aggregate risk', () => {
    const score = (site: 'A' | 'B' | 'C') => aggregateRisk(scoreEquipmentRisk(sliceDataset(dataset, { site, days: 30 })))
    expect(score('B')).toBeLessThan(score('A'))
    expect(score('B')).toBeLessThan(score('C'))
  })
})

describe('Lean engine', () => {
  it('returns all 8 Lean wastes plus energy, with scores in range', () => {
    const wastes = analyzeLean(dataset, sliceDataset(dataset, { site: 'all', days: 30 }))
    expect(wastes).toHaveLength(9)
    for (const w of wastes) {
      expect(w.score).toBeGreaterThanOrEqual(0)
      expect(w.score).toBeLessThanOrEqual(100)
      expect(w.estimatedCostUsd).toBeGreaterThanOrEqual(0)
    }
  })

  it('shows higher waiting waste at Site A than Site B', () => {
    const waiting = (site: 'A' | 'B') =>
      analyzeLean(dataset, sliceDataset(dataset, { site, days: 30 })).find((w) => w.key === 'waiting')!.score
    expect(waiting('A')).toBeGreaterThan(waiting('B'))
  })
})

describe('Simulation', () => {
  it('returns the baseline unchanged with zero levers', () => {
    const r = runSimulation(dataset, { site: 'A' })
    for (const m of r.metrics) expect(m.delta).toBeCloseTo(0, 0)
  })

  it('increases tons when queue time is reduced', () => {
    const r = runSimulation(dataset, { site: 'A', waitingReductionPct: 20 })
    const tons = r.metrics.find((m) => m.key === 'tons')!
    expect(tons.scenario).toBeGreaterThan(tons.baseline)
  })

  it('reduces fuel intensity with fuel efficiency lever', () => {
    const r = runSimulation(dataset, { site: 'all', fuelReductionPct: 10 })
    const fi = r.metrics.find((m) => m.key === 'fuelIntensity')!
    expect(fi.scenario).toBeLessThan(fi.baseline)
  })

  it('rejects out-of-range inputs', () => {
    expect(() => runSimulation(dataset, { waitingReductionPct: 500 })).toThrow()
  })
})

describe('Recommendations', () => {
  it('produces ranked, evidence-backed recommendations that require approval', () => {
    const recs = buildRecommendations(dataset)
    expect(recs.length).toBeGreaterThan(3)
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].priorityScore).toBeGreaterThanOrEqual(recs[i].priorityScore)
    for (const r of recs) {
      expect(r.evidence.length).toBeGreaterThan(0)
      expect(r.requiresHumanApproval).toBe(true)
    }
    expect(recs.some((r) => r.id === 'REC-INSPECT-EQ-A-T24')).toBe(true)
  })
})

describe('Site comparison', () => {
  it('identifies Site B as best on queue share', () => {
    const { transfers } = compareSites(dataset, 30)
    expect(transfers.find((t) => t.metric === 'waitingShare')!.bestSite).toBe('B')
  })
})
