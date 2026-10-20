// Seeded generator for the MINeLOT synthetic demo dataset.
// Every record is SYNTHETIC. Re-running with the same seed produces identical output.
// Usage: node scripts/generate-data.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEED = 20261018
const DAYS = 30
const END_DATE = '2026-10-18'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const between = (min, max) => min + (max - min) * rand()
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const chance = (p) => rand() < p

function dateList() {
  const end = new Date(`${END_DATE}T00:00:00Z`)
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (DAYS - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

const sites = [
  {
    id: 'A',
    name: 'Site A',
    region: 'Northern Highlands (synthetic)',
    mineType: 'Open-pit copper',
    targetTonsPerShift: 7600,
    crusherCapacityPerShift: 7000,
    profile: { waiting: [0.14, 0.19], routeDev: [10, 14], cycleSec: 36, redrill: 4.2, rework: 0.016 },
  },
  {
    id: 'B',
    name: 'Site B',
    region: 'Central Plateau (synthetic)',
    mineType: 'Open-pit copper',
    targetTonsPerShift: 7600,
    crusherCapacityPerShift: 7900,
    profile: { waiting: [0.055, 0.08], routeDev: [4, 6], cycleSec: 31, redrill: 3.1, rework: 0.009 },
  },
  {
    id: 'C',
    name: 'Site C',
    region: 'Southern Valley (synthetic)',
    mineType: 'Open-pit copper-gold',
    targetTonsPerShift: 7600,
    crusherCapacityPerShift: 7300,
    profile: { waiting: [0.1, 0.13], routeDev: [7, 9], cycleSec: 38, redrill: 8.8, rework: 0.034 },
  },
]

const fleet = {
  A: [
    ['T-24', 'haul_truck', 'CAT 793F', 4],
    ['T-31', 'haul_truck', 'CAT 793F', 4],
    ['T-17', 'haul_truck', 'Komatsu 930E', 4],
    ['SH-01', 'shovel', 'P&H 4100XPC', 5],
    ['L-05', 'loader', 'CAT 994K', 3],
    ['D-07', 'drill', 'Epiroc Pit Viper 271', 3],
  ],
  B: [
    ['T-40', 'haul_truck', 'CAT 793F', 4],
    ['T-42', 'haul_truck', 'Komatsu 930E', 4],
    ['T-45', 'haul_truck', 'Komatsu 930E', 4],
    ['SH-02', 'shovel', 'P&H 4100XPC', 5],
    ['L-08', 'loader', 'CAT 994K', 3],
    ['D-11', 'drill', 'Epiroc Pit Viper 271', 3],
  ],
  C: [
    ['T-51', 'haul_truck', 'CAT 793F', 4],
    ['T-53', 'haul_truck', 'CAT 793F', 4],
    ['T-58', 'haul_truck', 'Komatsu 930E', 4],
    ['SH-03', 'shovel', 'Komatsu PC8000', 5],
    ['L-12', 'loader', 'CAT 994K', 3],
    ['D-14', 'drill', 'Sandvik DR416i', 3],
  ],
}

const FUEL_RATE = { haul_truck: 95, shovel: 180, loader: 62, drill: 45 }
const IDLE_BURN = 28
const TRUCK_RATE_TPH = 285

const equipment = []
for (const site of sites) {
  fleet[site.id].forEach(([code, type, model, criticality], idx) => {
    equipment.push({
      id: `EQ-${site.id}-${code.replace('-', '')}`,
      siteId: site.id,
      code,
      type,
      model,
      criticality,
      commissioned: `${2014 + ((idx * 3 + site.id.charCodeAt(0)) % 8)}-0${1 + (idx % 9)}-15`,
      pmOffset: idx % 7,
    })
  })
}

const dates = dateList()
const telemetry = []
const failureEvents = []

const FAILURE_MODES = {
  haul_truck: ['hydraulic pump wear', 'tyre damage', 'brake overheating', 'electrical fault'],
  shovel: ['swing brake failure', 'hoist rope wear', 'electrical fault'],
  loader: ['hydraulic hose rupture', 'tyre damage'],
  drill: ['bit wear', 'compressor fault'],
}

const sh03FailDays = new Set(dates.filter(() => chance(0.26)))

for (const eq of equipment) {
  const site = sites.find((s) => s.id === eq.siteId)
  dates.forEach((date, d) => {
    const scheduled = 22
    let downtime = between(0, 1.2)
    let vibration = between(2.2, 3.2)
    let temp = between(84, 94)
    let failureMode = null

    const isT24 = eq.code === 'T-24'
    const isSH03 = eq.code === 'SH-03'

    if (isT24 && d >= 17) {
      const p = d - 17
      downtime += 0.6 + p * 0.45 + between(0, 0.8)
      vibration = 3.2 + p * 0.28 + between(0, 0.3)
      temp = 95 + p * 1.4 + between(0, 2)
      if (p === 5 || p === 10) failureMode = 'hydraulic pump wear'
    } else if (isSH03 && sh03FailDays.has(date)) {
      downtime += between(4, 8.5)
      failureMode = chance(0.6) ? 'swing brake failure' : 'electrical fault'
      vibration = between(3.8, 5.2)
    } else if (chance(0.045)) {
      downtime += between(3, 7)
      const modes = FAILURE_MODES[eq.type]
      failureMode = modes[Math.floor(rand() * modes.length)]
    }
    if (failureMode) failureEvents.push({ eq, date, downtime: round(downtime, 1), failureMode })

    const planned = (d + eq.pmOffset) % 7 === 0 ? 4 : 0
    const standby = between(0, 0.5)
    const operating = Math.max(0, scheduled - downtime - planned - standby)

    let waitingShare
    if (eq.type === 'haul_truck') {
      waitingShare = between(...site.profile.waiting)
      if (site.id === 'A' && d >= 20) waitingShare += 0.02
      if (site.id === 'C' && sh03FailDays.has(date)) waitingShare += 0.09
    } else {
      waitingShare = between(0.03, 0.06)
    }
    const waiting = operating * waitingShare
    const routeDev = eq.type === 'haul_truck' ? between(...site.profile.routeDev) : 0
    const productive = operating - waiting

    let tons = 0
    if (eq.type === 'haul_truck') {
      tons = productive * TRUCK_RATE_TPH * (1 - routeDev / 100 / 2) * between(0.95, 1.04)
    }
    const fuel = (productive * FUEL_RATE[eq.type] + waiting * IDLE_BURN) * (1 + routeDev / 100)

    telemetry.push({
      id: `TEL-${eq.siteId}-${eq.code.replace('-', '')}-${date}`,
      date,
      siteId: eq.siteId,
      equipmentId: eq.id,
      scheduledHours: scheduled,
      operatingHours: round(operating, 2),
      unplannedDowntimeHours: round(downtime, 2),
      plannedMaintenanceHours: planned,
      waitingHours: round(waiting, 2),
      fuelLiters: Math.round(fuel),
      tonsHauled: Math.round(tons),
      routeDeviationPct: round(routeDev, 1),
      cycleTimeSec: eq.type === 'shovel' || eq.type === 'loader' ? round(site.profile.cycleSec * between(0.95, 1.07), 1) : null,
      redrillPct: eq.type === 'drill' ? round(site.profile.redrill * between(0.85, 1.15), 1) : null,
      vibrationIndex: round(vibration, 2),
      engineTempMaxC: round(temp, 1),
    })
  })
}

const production = []
for (const site of sites) {
  let stockpile = 14000
  dates.forEach((date) => {
    const dayTons = telemetry
      .filter((t) => t.siteId === site.id && t.date === date)
      .reduce((s, t) => s + t.tonsHauled, 0)
    const daySplit = between(0.5, 0.54)
    ;[
      ['Day', dayTons * daySplit],
      ['Night', dayTons * (1 - daySplit)],
    ].forEach(([shift, tons]) => {
      const actual = Math.round(tons)
      const crusherFeed = Math.min(actual + Math.max(0, stockpile - 12000) * 0.15, site.crusherCapacityPerShift)
      stockpile = stockpile + actual - crusherFeed
      production.push({
        id: `PRD-${site.id}-${date}-${shift === 'Day' ? 'D' : 'N'}`,
        date,
        siteId: site.id,
        shift,
        targetTons: site.targetTonsPerShift,
        actualTons: actual,
        crusherFeedTons: Math.round(crusherFeed),
        reworkTons: Math.round(actual * site.profile.rework * between(0.8, 1.2)),
        stockpileTons: Math.round(stockpile),
        oreGradePct: round(between(0.48, 0.66), 2),
      })
    })
  })
}

const HOURLY_DOWNTIME_COST = { haul_truck: 850, shovel: 2400, loader: 700, drill: 520 }
let woSeq = 1001
const maintenance = []
for (const ev of failureEvents) {
  const closed = ev.eq.code === 'T-24' && ev.date >= '2026-10-12' ? null : ev.date
  maintenance.push({
    id: `WO-${woSeq++}`,
    siteId: ev.eq.siteId,
    equipmentId: ev.eq.id,
    openedDate: ev.date,
    closedDate: closed,
    type: 'corrective',
    priority: ev.downtime > 6 ? 'high' : 'medium',
    failureMode: ev.failureMode,
    description: `Corrective repair: ${ev.failureMode}`,
    downtimeHours: ev.downtime,
    costUsd: Math.round(ev.downtime * HOURLY_DOWNTIME_COST[ev.eq.type] * 0.35 + between(2000, 9000)),
    status: closed ? 'closed' : 'open',
  })
}
for (const eq of equipment) {
  dates.forEach((date, d) => {
    if ((d + eq.pmOffset) % 14 === 0) {
      maintenance.push({
        id: `WO-${woSeq++}`,
        siteId: eq.siteId,
        equipmentId: eq.id,
        openedDate: date,
        closedDate: date,
        type: 'preventive',
        priority: 'low',
        failureMode: null,
        description: 'Scheduled preventive service (PM-250h)',
        downtimeHours: 4,
        costUsd: Math.round(between(1500, 3500)),
        status: 'closed',
      })
    }
  })
}
maintenance.push({
  id: `WO-${woSeq++}`,
  siteId: 'A',
  equipmentId: 'EQ-A-T24',
  openedDate: '2026-10-15',
  closedDate: null,
  type: 'predictive',
  priority: 'high',
  failureMode: 'hydraulic pump wear',
  description: 'Vibration index trending above 5.0 threshold. Hydraulic pump inspection requested.',
  downtimeHours: 0,
  costUsd: 0,
  status: 'open',
})
maintenance.sort((a, b) => a.openedDate.localeCompare(b.openedDate))

const incidentSeeds = [
  ['A', 'EQ-A-T24', '2026-10-14', 'high', 'equipment', 'Hydraulic oil leak detected on T-24 during pre-start inspection.', 'open'],
  ['A', 'EQ-A-SH01', '2026-10-09', 'medium', 'near-miss', 'Truck queue congestion at SH-01 loading zone; two trucks within minimum separation distance.', 'closed'],
  ['A', 'EQ-A-SH01', '2026-10-16', 'medium', 'near-miss', 'Repeat queue congestion at SH-01 during night shift change.', 'open'],
  ['A', null, '2026-09-27', 'low', 'environmental', 'Dust suppression water cart unavailable for 3 hours on main haul road.', 'closed'],
  ['A', 'EQ-A-T17', '2026-10-03', 'low', 'equipment', 'Tyre pressure alarm on T-17, resolved in field.', 'closed'],
  ['B', 'EQ-B-T42', '2026-09-30', 'low', 'near-miss', 'Light vehicle entered haul road without radio call; stopped by spotter.', 'closed'],
  ['B', null, '2026-10-11', 'low', 'environmental', 'Minor hydrocarbon spill (<20 L) at refuelling bay, contained.', 'closed'],
  ['B', 'EQ-B-D11', '2026-10-05', 'medium', 'personnel', 'Drill helper minor hand injury during rod change (first aid).', 'closed'],
  ['C', 'EQ-C-SH03', '2026-10-01', 'high', 'equipment', 'SH-03 swing brake failure during loading cycle; area isolated.', 'closed'],
  ['C', 'EQ-C-SH03', '2026-10-13', 'high', 'equipment', 'SH-03 repeat swing brake fault; root cause not yet confirmed.', 'open'],
  ['C', 'EQ-C-T53', '2026-10-07', 'critical', 'near-miss', 'Proximity alarm: haul truck T-53 and light vehicle at intersection 4.', 'open'],
  ['C', 'EQ-C-D14', '2026-09-24', 'medium', 'equipment', 'Compressor overheating on D-14; drilling stopped 5 hours.', 'closed'],
  ['C', null, '2026-10-17', 'medium', 'environmental', 'Pit dewatering pump outage; bench flooding risk flagged.', 'open'],
  ['C', 'EQ-C-L12', '2026-09-29', 'low', 'personnel', 'Operator fatigue report on extended night shift.', 'closed'],
]
const incidents = incidentSeeds.map(([siteId, equipmentId, date, severity, category, description, status], i) => ({
  id: `INC-${2041 + i}`,
  siteId,
  equipmentId,
  date,
  severity,
  category,
  description,
  status,
}))

const knowledge = [
  {
    id: 'DOC-001',
    title: 'Truck Dispatch & Queue Management Procedure (SOP-DSP-04)',
    type: 'procedure',
    tags: ['waiting', 'queue', 'dispatch', 'shovel', 'production'],
    content:
      'Queue time at loading units should remain below 8% of truck operating hours. When queue time exceeds 12% for more than two consecutive shifts, the dispatcher must rebalance truck-shovel assignments and review shovel cycle times.',
  },
  {
    id: 'DOC-002',
    title: 'Maintenance Prioritisation Standard (MNT-STD-11)',
    type: 'policy',
    tags: ['maintenance', 'downtime', 'inspection', 'vibration', 'risk'],
    content:
      'Equipment with a vibration index above 5.0 or more than 8 hours of unplanned downtime in a rolling 7-day window must be scheduled for inspection before the next shift. Safety-critical findings require supervisor sign-off before return to service.',
  },
  {
    id: 'DOC-003',
    title: 'Fuel Idle Reduction Guideline (ENV-GL-02)',
    type: 'policy',
    tags: ['fuel', 'energy', 'idle', 'waiting', 'emissions'],
    content:
      'Engines idling longer than 5 minutes in queue consume approximately 25-30 litres per hour. Idle reduction and queue control are the primary levers for fuel intensity improvement.',
  },
  {
    id: 'DOC-004',
    title: 'Haul Route Compliance Manual (OPS-MAN-07)',
    type: 'manual',
    tags: ['route', 'transportation', 'fuel', 'haul'],
    content:
      'Route deviation above 8% of planned haul distance indicates non-optimal routing or road condition issues. Survey road conditions and verify dispatch route assignments before attributing deviation to operator behaviour.',
  },
  {
    id: 'DOC-005',
    title: 'Loading Unit Performance Benchmarks (OPS-BM-03)',
    type: 'manual',
    tags: ['shovel', 'cycle', 'motion', 'loading'],
    content:
      'Reference shovel swing-load cycle is 32 seconds for 4100-class shovels in blasted material. Cycles above 35 seconds suggest excess motion, poor fragmentation, or truck spotting issues.',
  },
  {
    id: 'DOC-006',
    title: 'Drill & Blast Quality Assurance (DB-QA-09)',
    type: 'procedure',
    tags: ['drill', 'redrill', 'extra processing', 'fragmentation', 'defects'],
    content:
      'Re-drill rate should remain below 5% of drilled holes. Elevated re-drill rates are associated with collapsed holes, poor pattern marking, and increased dilution downstream.',
  },
  {
    id: 'DOC-007',
    title: 'Incident Escalation & Critical Risk Controls (HSE-PR-01)',
    type: 'procedure',
    tags: ['safety', 'incident', 'risk', 'near-miss', 'proximity'],
    content:
      'Critical and high-severity incidents must be investigated within 24 hours. Repeat incidents on the same asset trigger a critical control verification. No automated system may override a safety stop.',
  },
  {
    id: 'DOC-008',
    title: 'Continuous Improvement & Frontline Ideas Program (CI-PR-02)',
    type: 'policy',
    tags: ['talent', 'lean', 'root cause', 'improvement', 'repeat failure'],
    content:
      'Repeat failures without a documented root cause analysis indicate that frontline technician knowledge is not being captured. Each repeat failure should trigger a 5-Why session including operators and maintainers.',
  },
  {
    id: 'DOC-009',
    title: 'Stockpile & ROM Pad Inventory Policy (PLN-PL-05)',
    type: 'policy',
    tags: ['inventory', 'stockpile', 'overproduction', 'crusher'],
    content:
      'Target ROM stockpile cover is 1.0 to 1.5 shifts of crusher feed. Mining above crusher capacity for sustained periods builds inventory that must be rehandled at additional cost.',
  },
]

mkdirSync(OUT_DIR, { recursive: true })
const meta = {
  name: 'MINeLOT synthetic demo dataset',
  version: '1.0.0',
  seed: SEED,
  synthetic: true,
  startDate: dates[0],
  endDate: dates[dates.length - 1],
  generatedBy: 'scripts/generate-data.mjs',
  notice: 'All records are synthetic and generated for demonstration only. They do not represent any real mine, company, or person.',
}
const files = { meta, sites, equipment, telemetry, production, maintenance, incidents, knowledge }
for (const [name, value] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(value, null, name === 'telemetry' || name === 'production' ? 0 : 2))
}
console.log(
  `Generated: ${sites.length} sites, ${equipment.length} equipment, ${telemetry.length} telemetry, ${production.length} production, ${maintenance.length} work orders, ${incidents.length} incidents, ${knowledge.length} docs`,
)
