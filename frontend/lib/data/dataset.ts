import meta from '@/data/meta.json'
import sites from '@/data/sites.json'
import equipment from '@/data/equipment.json'
import telemetry from '@/data/telemetry.json'
import production from '@/data/production.json'
import maintenance from '@/data/maintenance.json'
import incidents from '@/data/incidents.json'
import knowledge from '@/data/knowledge.json'
import type { Dataset } from './types'

export const dataset: Dataset = {
  meta,
  sites,
  equipment,
  telemetry,
  production,
  maintenance,
  incidents,
  knowledge,
} as unknown as Dataset

export const DATASET_FILES: Record<string, string> = {
  telemetry: 'data/telemetry.json',
  production: 'data/production.json',
  maintenance: 'data/maintenance.json',
  incidents: 'data/incidents.json',
  equipment: 'data/equipment.json',
  knowledge: 'data/knowledge.json',
}
