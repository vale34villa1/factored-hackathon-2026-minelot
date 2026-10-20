import type {
  Dataset,
  Equipment,
  IncidentRecord,
  MaintenanceRecord,
  ProductionRecord,
  Site,
  SiteId,
  TelemetryRecord,
} from '@/lib/data/types'

export type SiteFilter = SiteId | 'all'

export interface Filter {
  site: SiteFilter
  days: number
}

export interface Slice {
  from: string
  to: string
  days: number
  site: SiteFilter
  sites: Site[]
  equipment: Equipment[]
  telemetry: TelemetryRecord[]
  production: ProductionRecord[]
  maintenance: MaintenanceRecord[]
  incidents: IncidentRecord[]
}

export const clamp = (v: number, min = 0, max = 1) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min)
export const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0)
export const safeDiv = (a: number, b: number) => (b === 0 || !Number.isFinite(b) ? 0 : a / b)
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

export function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

export function sliceDataset(ds: Dataset, filter: Filter, endDate = ds.meta.endDate): Slice {
  const days = Math.max(1, Math.round(filter.days))
  const to = endDate
  const from = shiftDate(to, -(days - 1))
  const inSite = (siteId: SiteId) => filter.site === 'all' || siteId === filter.site
  const inRange = (date: string) => date >= from && date <= to
  return {
    from,
    to,
    days,
    site: filter.site,
    sites: ds.sites.filter((s) => inSite(s.id)),
    equipment: ds.equipment.filter((e) => inSite(e.siteId)),
    telemetry: ds.telemetry.filter((t) => inSite(t.siteId) && inRange(t.date)),
    production: ds.production.filter((p) => inSite(p.siteId) && inRange(p.date)),
    maintenance: ds.maintenance.filter(
      (m) => inSite(m.siteId) && m.openedDate <= to && (m.openedDate >= from || m.status === 'open'),
    ),
    incidents: ds.incidents.filter((i) => inSite(i.siteId) && (inRange(i.date) || (i.status === 'open' && i.date <= to))),
  }
}

export function productionEfficiency(rows: ProductionRecord[]): number {
  return safeDiv(sum(rows, (r) => r.actualTons), sum(rows, (r) => r.targetTons))
}

export function availableHours(t: TelemetryRecord) {
  return t.scheduledHours - t.unplannedDowntimeHours - t.plannedMaintenanceHours
}

export function equipmentAvailability(rows: TelemetryRecord[]): number {
  return safeDiv(sum(rows, availableHours), sum(rows, (r) => r.scheduledHours))
}

export function equipmentUtilization(rows: TelemetryRecord[]): number {
  return safeDiv(sum(rows, (r) => r.operatingHours), sum(rows, availableHours))
}

export function downtimeRate(rows: TelemetryRecord[]): number {
  return safeDiv(sum(rows, (r) => r.unplannedDowntimeHours), sum(rows, (r) => r.scheduledHours))
}

export function fuelIntensity(tel: TelemetryRecord[], prod: ProductionRecord[]): number {
  return safeDiv(sum(tel, (r) => r.fuelLiters), sum(prod, (r) => r.actualTons))
}

export function truckRows(tel: TelemetryRecord[], equipment: Equipment[]) {
  const trucks = new Set(equipment.filter((e) => e.type === 'haul_truck').map((e) => e.id))
  return tel.filter((t) => trucks.has(t.equipmentId))
}

export function waitingShare(truckTel: TelemetryRecord[]): number {
  return safeDiv(sum(truckTel, (r) => r.waitingHours), sum(truckTel, (r) => r.operatingHours))
}

export function routeDeviation(truckTel: TelemetryRecord[]): number {
  return safeDiv(
    sum(truckTel, (r) => r.routeDeviationPct * r.operatingHours),
    sum(truckTel, (r) => r.operatingHours),
  )
}

export interface CoreKpis {
  productionEfficiency: number
  actualTons: number
  targetTons: number
  availability: number
  utilization: number
  downtimeRate: number
  downtimeHours: number
  fuelIntensity: number
  fuelLiters: number
  waitingShare: number
  routeDeviationPct: number
  openCriticalIncidents: number
  openIncidents: number
}

export function coreKpis(s: Slice): CoreKpis {
  const trucks = truckRows(s.telemetry, s.equipment)
  return {
    productionEfficiency: productionEfficiency(s.production),
    actualTons: sum(s.production, (r) => r.actualTons),
    targetTons: sum(s.production, (r) => r.targetTons),
    availability: equipmentAvailability(s.telemetry),
    utilization: equipmentUtilization(s.telemetry),
    downtimeRate: downtimeRate(s.telemetry),
    downtimeHours: sum(s.telemetry, (r) => r.unplannedDowntimeHours),
    fuelIntensity: fuelIntensity(s.telemetry, s.production),
    fuelLiters: sum(s.telemetry, (r) => r.fuelLiters),
    waitingShare: waitingShare(trucks),
    routeDeviationPct: routeDeviation(trucks),
    openCriticalIncidents: s.incidents.filter(
      (i) => i.status === 'open' && (i.severity === 'critical' || i.severity === 'high'),
    ).length,
    openIncidents: s.incidents.filter((i) => i.status === 'open').length,
  }
}

export function dailyProduction(s: Slice) {
  const byDate = new Map<string, { date: string; actual: number; target: number }>()
  for (const p of s.production) {
    const row = byDate.get(p.date) ?? { date: p.date, actual: 0, target: 0 }
    row.actual += p.actualTons
    row.target += p.targetTons
    byDate.set(p.date, row)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function downtimeByEquipment(s: Slice) {
  const eqById = new Map(s.equipment.map((e) => [e.id, e]))
  const totals = new Map<string, { unplanned: number; planned: number }>()
  for (const t of s.telemetry) {
    const row = totals.get(t.equipmentId) ?? { unplanned: 0, planned: 0 }
    row.unplanned += t.unplannedDowntimeHours
    row.planned += t.plannedMaintenanceHours
    totals.set(t.equipmentId, row)
  }
  return [...totals.entries()]
    .map(([id, v]) => {
      const eq = eqById.get(id)
      return {
        equipmentId: id,
        label: eq ? `${eq.code} (${eq.siteId})` : id,
        unplanned: round(v.unplanned, 1),
        planned: round(v.planned, 1),
      }
    })
    .sort((a, b) => b.unplanned - a.unplanned)
}

export function recentEvents(s: Slice, limit = 8) {
  const eqById = new Map(s.equipment.map((e) => [e.id, e]))
  const events = [
    ...s.incidents.map((i) => ({
      id: i.id,
      dataset: 'incidents' as const,
      date: i.date,
      siteId: i.siteId,
      title: i.description,
      equipment: i.equipmentId ? (eqById.get(i.equipmentId)?.code ?? null) : null,
      severity: i.severity,
      status: i.status,
    })),
    ...s.maintenance
      .filter((m) => m.type !== 'preventive')
      .map((m) => ({
        id: m.id,
        dataset: 'maintenance' as const,
        date: m.openedDate,
        siteId: m.siteId,
        title: m.description,
        equipment: eqById.get(m.equipmentId)?.code ?? null,
        severity: m.priority === 'high' ? ('high' as const) : ('medium' as const),
        status: m.status,
      })),
  ]
  return events.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, limit)
}
