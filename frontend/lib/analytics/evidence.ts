import type { Dataset, DatasetName, KnowledgeDoc } from '@/lib/data/types'
import { DATASET_FILES } from '@/lib/data/dataset'

export interface EvidenceRecord {
  dataset: DatasetName
  source: string
  recordId: string
  siteId: string | null
  timestamp: string | null
  summary: string
  calculation: string
  limitations: string
}

const CALC: Record<DatasetName, string> = {
  telemetry: 'Raw daily equipment record. Used in availability, utilisation, downtime rate, queue share, fuel intensity and risk factors.',
  production: 'Raw shift record. Used in production efficiency, defects, overproduction and inventory indicators.',
  maintenance: 'Work order. Used in open work-order risk factor and repeat-failure (talent) proxy.',
  incidents: 'HSE incident. Used in incident-history risk factor and severity bump.',
  equipment: 'Asset master record. Criticality feeds risk severity.',
  knowledge: 'Synthetic reference document. Retrieved by keyword match; provides benchmarks only, never instructions.',
}

const LIMITS: Record<DatasetName, string> = {
  telemetry: 'Synthetic, daily granularity; no sensor-level sampling.',
  production: 'Synthetic; two shifts per day; grade not reconciled with plant.',
  maintenance: 'Synthetic; failure modes simplified.',
  incidents: 'Synthetic; descriptions illustrative only.',
  equipment: 'Synthetic fleet.',
  knowledge: 'Synthetic documents written for this demo; not real company standards.',
}

export function buildEvidenceIndex(ds: Dataset): EvidenceRecord[] {
  const eqCode = new Map(ds.equipment.map((e) => [e.id, e.code]))
  const rec = (dataset: DatasetName, recordId: string, siteId: string | null, timestamp: string | null, summary: string): EvidenceRecord => ({
    dataset,
    source: DATASET_FILES[dataset],
    recordId,
    siteId,
    timestamp,
    summary,
    calculation: CALC[dataset],
    limitations: LIMITS[dataset],
  })
  return [
    ...ds.incidents.map((i) => rec('incidents', i.id, i.siteId, i.date, `[${i.severity}/${i.status}] ${i.description}`)),
    ...ds.maintenance.map((m) =>
      rec('maintenance', m.id, m.siteId, m.openedDate, `${eqCode.get(m.equipmentId)} · ${m.type} · ${m.description} · ${m.downtimeHours} h · $${m.costUsd.toLocaleString('en-US')} · ${m.status}`),
    ),
    ...ds.production.map((p) =>
      rec('production', p.id, p.siteId, p.date, `${p.shift} shift · ${p.actualTons.toLocaleString('en-US')} / ${p.targetTons.toLocaleString('en-US')} t · rework ${p.reworkTons} t · stockpile ${p.stockpileTons.toLocaleString('en-US')} t`),
    ),
    ...ds.telemetry.map((t) =>
      rec(
        'telemetry',
        t.id,
        t.siteId,
        t.date,
        `${eqCode.get(t.equipmentId)} · op ${t.operatingHours} h · down ${t.unplannedDowntimeHours} h · wait ${t.waitingHours} h · fuel ${t.fuelLiters.toLocaleString('en-US')} L · vib ${t.vibrationIndex}`,
      ),
    ),
    ...ds.equipment.map((e) => rec('equipment', e.id, e.siteId, e.commissioned, `${e.code} · ${e.type.replace('_', ' ')} · ${e.model} · criticality ${e.criticality}/5`)),
    ...ds.knowledge.map((k) => rec('knowledge', k.id, null, null, `${k.title}: ${k.content}`)),
  ]
}

/** Lightweight keyword retrieval over the synthetic knowledge base. */
export function retrieveDocs(docs: KnowledgeDoc[], query: string, k = 3): KnowledgeDoc[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ]+/)
    .filter((t) => t.length > 2)
  if (!terms.length) return []
  return docs
    .map((d) => {
      const hay = `${d.title} ${d.tags.join(' ')} ${d.content}`.toLowerCase()
      const score = terms.reduce((s, t) => s + (d.tags.some((tag) => tag.includes(t)) ? 3 : 0) + (hay.includes(t) ? 1 : 0), 0)
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.d)
}
