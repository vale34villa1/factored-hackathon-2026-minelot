export type SiteId = 'A' | 'B' | 'C'
export type EquipmentType = 'haul_truck' | 'shovel' | 'loader' | 'drill'
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Site {
  id: SiteId
  name: string
  region: string
  mineType: string
  targetTonsPerShift: number
  crusherCapacityPerShift: number
}

export interface Equipment {
  id: string
  siteId: SiteId
  code: string
  type: EquipmentType
  model: string
  criticality: number
  commissioned: string
}

export interface TelemetryRecord {
  id: string
  date: string
  siteId: SiteId
  equipmentId: string
  scheduledHours: number
  operatingHours: number
  unplannedDowntimeHours: number
  plannedMaintenanceHours: number
  waitingHours: number
  fuelLiters: number
  tonsHauled: number
  routeDeviationPct: number
  cycleTimeSec: number | null
  redrillPct: number | null
  vibrationIndex: number
  engineTempMaxC: number
}

export interface ProductionRecord {
  id: string
  date: string
  siteId: SiteId
  shift: 'Day' | 'Night'
  targetTons: number
  actualTons: number
  crusherFeedTons: number
  reworkTons: number
  stockpileTons: number
  oreGradePct: number
}

export interface MaintenanceRecord {
  id: string
  siteId: SiteId
  equipmentId: string
  openedDate: string
  closedDate: string | null
  type: 'corrective' | 'preventive' | 'predictive'
  priority: 'low' | 'medium' | 'high'
  failureMode: string | null
  description: string
  downtimeHours: number
  costUsd: number
  status: 'open' | 'closed'
}

export interface IncidentRecord {
  id: string
  siteId: SiteId
  equipmentId: string | null
  date: string
  severity: Severity
  category: string
  description: string
  status: 'open' | 'closed'
}

export interface KnowledgeDoc {
  id: string
  title: string
  type: string
  tags: string[]
  content: string
}

export interface DatasetMeta {
  name: string
  version: string
  seed: number
  synthetic: boolean
  startDate: string
  endDate: string
  generatedBy: string
  notice: string
}

export interface Dataset {
  meta: DatasetMeta
  sites: Site[]
  equipment: Equipment[]
  telemetry: TelemetryRecord[]
  production: ProductionRecord[]
  maintenance: MaintenanceRecord[]
  incidents: IncidentRecord[]
  knowledge: KnowledgeDoc[]
}

export type DatasetName = 'telemetry' | 'production' | 'maintenance' | 'incidents' | 'equipment' | 'knowledge'

export interface EvidenceRef {
  dataset: DatasetName
  recordId: string
  label: string
  value?: string
  timestamp?: string
}
