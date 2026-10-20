import { z } from 'zod'
import type { Dataset, EquipmentType } from '@/lib/data/types'
import { ASSUMPTIONS } from './assumptions'
import { clamp, round, safeDiv, sliceDataset, sum, truckRows } from './kpis'

export const SimulationInputSchema = z.object({
  site: z.enum(['all', 'A', 'B', 'C']).default('all'),
  days: z.coerce.number().int().min(7).max(30).default(30),
  waitingReductionPct: z.coerce.number().min(0).max(50).default(0),
  availabilityDeltaPts: z.coerce.number().min(-10).max(10).default(0),
  fuelReductionPct: z.coerce.number().min(0).max(30).default(0),
  downtimeReductionPct: z.coerce.number().min(0).max(50).default(0),
  routeEfficiencyPct: z.coerce.number().min(0).max(100).default(0),
  maintenanceIntervalChangePct: z.coerce.number().min(-30).max(30).default(0),
})
export type SimulationInput = z.infer<typeof SimulationInputSchema>

export const SIMULATION_FORMULAS = [
  'Unplanned downtime′ = D × (1 − downtimeReduction) × (1 + 0.5 × intervalChange)',
  'Planned maintenance′ = P × (1 − 0.6 × intervalChange)',
  'Truck operating hours′ = O + ΔD + ΔP + availabilityΔ × scheduled (capped at available hours)',
  'Truck queue hours′ = O′ × baseline queue share × (1 − waitingReduction)',
  'Haul rate′ = observed t/productive-h × (1 − dev′/200) / (1 − dev/200),  dev′ = dev × (1 − routeEfficiency)',
  'Tons′ = haul rate′ × (O′ − queue′)',
  'Fuel′ = observed fuel × modelled fuel′ / modelled fuel × (1 − fuelReduction)',
  'Cost = fuel × diesel price + Σ downtime h × hourly cost + operating h × operator cost',
]

const TRUCK_FUEL_RATE = 95
const PRODUCTION_CAP_FACTOR = 1.3

export interface SimMetric {
  key: string
  label: string
  unit: string
  baseline: number
  scenario: number
  delta: number
  deltaPct: number
  better: 'higher' | 'lower'
  kind: 'observed' | 'estimate'
}

export interface SimulationResult {
  input: SimulationInput
  period: { from: string; to: string; days: number }
  metrics: SimMetric[]
  formulas: string[]
  warnings: string[]
  annualizedBenefitUsd: number
}

export function runSimulation(ds: Dataset, rawInput: Partial<SimulationInput>): SimulationResult {
  const input = SimulationInputSchema.parse(rawInput)
  const s = sliceDataset(ds, { site: input.site, days: input.days })
  const warnings: string[] = []

  const w = input.waitingReductionPct / 100
  const a = input.availabilityDeltaPts / 100
  const f = input.fuelReductionPct / 100
  const d = input.downtimeReductionPct / 100
  const e = input.routeEfficiencyPct / 100
  const m = input.maintenanceIntervalChangePct / 100

  const typeOf = new Map(s.equipment.map((x) => [x.id, x.type as EquipmentType]))
  const trucks = truckRows(s.telemetry, s.equipment)
  const others = s.telemetry.filter((t) => typeOf.get(t.equipmentId) !== 'haul_truck')

  const St = sum(trucks, (t) => t.scheduledHours)
  const Dt = sum(trucks, (t) => t.unplannedDowntimeHours)
  const Pt = sum(trucks, (t) => t.plannedMaintenanceHours)
  const Ot = sum(trucks, (t) => t.operatingHours)
  const Wt = sum(trucks, (t) => t.waitingHours)
  const T = sum(s.production, (p) => p.actualTons)
  const dev = safeDiv(sum(trucks, (t) => t.routeDeviationPct * t.operatingHours), Ot)
  const Ft = sum(trucks, (t) => t.fuelLiters)
  const Fo = sum(others, (t) => t.fuelLiters)

  const downFactor = (1 - d) * (1 + 0.5 * m)
  const plannedFactor = 1 - 0.6 * m
  const Dt2 = Dt * downFactor
  const Pt2 = Pt * plannedFactor
  const maxOp = Math.max(0, St - Dt2 - Pt2)
  const Ot2 = clamp(Ot + (Dt - Dt2) + (Pt - Pt2) + a * St, 0, maxOp)
  const waitShare = safeDiv(Wt, Ot)
  const Wt2 = Ot2 * waitShare * (1 - w)
  const Ht = Ot - Wt
  const Ht2 = Ot2 - Wt2
  const dev2 = dev * (1 - e)
  const rate = safeDiv(T, Ht)
  const rate2 = rate * safeDiv(1 - dev2 / 200, 1 - dev / 200)
  let T2 = rate2 * Ht2
  if (T2 > T * PRODUCTION_CAP_FACTOR) {
    T2 = T * PRODUCTION_CAP_FACTOR
    warnings.push('Scenario output capped at +30% of observed tonnage; downstream crusher capacity would likely constrain further gains.')
  }

  const modelFt = (Ht * TRUCK_FUEL_RATE + Wt * ASSUMPTIONS.idleBurnLitersPerHour) * (1 + dev / 100)
  const modelFt2 = (Ht2 * TRUCK_FUEL_RATE + Wt2 * ASSUMPTIONS.idleBurnLitersPerHour) * (1 + dev2 / 100)
  const Ft2 = Ft * safeDiv(modelFt2, modelFt) * (1 - f)
  const Fo2 = Fo * (1 - f)
  const F = Ft + Fo
  const F2 = Ft2 + Fo2

  const D = sum(s.telemetry, (t) => t.unplannedDowntimeHours)
  const D2 = Dt2 + sum(others, (t) => t.unplannedDowntimeHours) * downFactor

  const downtimeCost = (factor: number) =>
    sum(s.telemetry, (t) => t.unplannedDowntimeHours * ASSUMPTIONS.downtimeCostPerHour[typeOf.get(t.equipmentId) ?? 'haul_truck']) * factor
  const opsHours = sum(s.telemetry, (t) => t.operatingHours)
  const opsHours2 = opsHours - Ot + Ot2
  const cost = F * ASSUMPTIONS.dieselPricePerLiter + downtimeCost(1) + opsHours * ASSUMPTIONS.operatorCostPerHour
  const cost2 = F2 * ASSUMPTIONS.dieselPricePerLiter + downtimeCost(downFactor) + opsHours2 * ASSUMPTIONS.operatorCostPerHour

  if (input.availabilityDeltaPts > 0 && Ot2 >= maxOp - 0.01) {
    warnings.push('Availability gain limited by remaining scheduled hours after maintenance.')
  }
  if (input.maintenanceIntervalChangePct > 0) {
    warnings.push('Extending maintenance intervals raises unplanned failure exposure; validate with reliability engineering before acting.')
  }

  const metric = (
    key: string,
    label: string,
    unit: string,
    baseline: number,
    scenario: number,
    better: SimMetric['better'],
    kind: SimMetric['kind'],
    digits = 1,
  ): SimMetric => ({
    key,
    label,
    unit,
    baseline: round(baseline, digits),
    scenario: round(scenario, digits),
    delta: round(scenario - baseline, digits),
    deltaPct: round(safeDiv(scenario - baseline, baseline) * 100, 1),
    better,
    kind,
  })

  const metrics: SimMetric[] = [
    metric('tons', 'Production output', 't', T, T2, 'higher', 'observed', 0),
    metric('fuelIntensity', 'Fuel intensity', 'L/t', safeDiv(F, T), safeDiv(F2, T2), 'lower', 'observed', 3),
    metric('downtime', 'Unplanned downtime', 'h', D, D2, 'lower', 'observed', 1),
    metric('productivity', 'Truck productivity', 't/op-h', safeDiv(T, Ot), safeDiv(T2, Ot2), 'higher', 'observed', 1),
    metric('cost', 'Operating cost', 'USD', cost, cost2, 'lower', 'estimate', 0),
    metric('costPerTon', 'Cost per ton', 'USD/t', safeDiv(cost, T), safeDiv(cost2, T2), 'lower', 'estimate', 2),
    metric('co2', 'CO2 emissions', 't', (F * ASSUMPTIONS.co2KgPerLiterDiesel) / 1000, (F2 * ASSUMPTIONS.co2KgPerLiterDiesel) / 1000, 'lower', 'estimate', 1),
  ]

  const benefit = (T2 - T) * ASSUMPTIONS.contributionMarginPerTon + (cost - cost2)
  return {
    input,
    period: { from: s.from, to: s.to, days: s.days },
    metrics,
    formulas: SIMULATION_FORMULAS,
    warnings,
    annualizedBenefitUsd: Math.round((benefit * 365) / s.days),
  }
}
