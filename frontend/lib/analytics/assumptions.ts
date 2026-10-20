import type { EquipmentType } from '@/lib/data/types'

/**
 * Modelling assumptions used to translate observed (synthetic) operational
 * measurements into estimated financial and environmental values.
 * These are illustrative and must be replaced with site-specific figures.
 */
export const ASSUMPTIONS = {
  dieselPricePerLiter: 1.15,
  co2KgPerLiterDiesel: 2.68,
  contributionMarginPerTon: 14,
  rehandleCostPerTon: 2.4,
  idleBurnLitersPerHour: 28,
  operatorCostPerHour: 62,
  stockpileTargetShifts: 1.5,
  downtimeCostPerHour: {
    haul_truck: 850,
    shovel: 2400,
    loader: 700,
    drill: 520,
  } satisfies Record<EquipmentType, number>,
  benchmarks: {
    waitingSharePct: 8,
    routeDeviationPct: 8,
    shovelCycleSec: 32,
    redrillPct: 5,
    vibrationThreshold: 5,
    unplannedDowntime7dHours: 8,
  },
} as const

export const ASSUMPTION_LABELS: { key: string; label: string; value: string }[] = [
  { key: 'diesel', label: 'Diesel price', value: `$${ASSUMPTIONS.dieselPricePerLiter}/L` },
  { key: 'co2', label: 'CO2 factor (diesel)', value: `${ASSUMPTIONS.co2KgPerLiterDiesel} kg/L` },
  { key: 'margin', label: 'Contribution margin', value: `$${ASSUMPTIONS.contributionMarginPerTon}/t moved` },
  { key: 'rehandle', label: 'Rehandle cost', value: `$${ASSUMPTIONS.rehandleCostPerTon}/t` },
  { key: 'idle', label: 'Idle fuel burn', value: `${ASSUMPTIONS.idleBurnLitersPerHour} L/h` },
  { key: 'operator', label: 'Operator cost', value: `$${ASSUMPTIONS.operatorCostPerHour}/h` },
  { key: 'downtime', label: 'Downtime cost (truck / shovel)', value: '$850/h / $2,400/h' },
]
