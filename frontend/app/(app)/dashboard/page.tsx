import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DowntimeChart, ProductionTrendChart } from '@/components/charts/charts'
import { Kpi, LevelBadge, PageHeader, ScoreBar, Section, Tag } from '@/components/ui/primitives'
import { buildOverview } from '@/lib/analytics/overview'
import { riskLevel } from '@/lib/analytics/risk'
import { dataset } from '@/lib/data/dataset'
import { COLORS, fmtNum, fmtUsd, parseFilter } from '@/lib/params'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filter = parseFilter(await searchParams)
  const o = buildOverview(dataset, filter)
  const k = o.kpis
  const qs = `site=${filter.site}&days=${filter.days}`

  return (
    <>
      <PageHeader
        title="Operations overview"
        description={`${filter.site === 'all' ? 'All sites' : `Site ${filter.site}`} · ${o.period.from} to ${o.period.to}. Every KPI is computed from the synthetic dataset; click through to see the records behind it.`}
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Operational risk"
            value={String(k.riskScore)}
            unit="/100"
            tone={k.riskScore >= 45 ? 'bad' : k.riskScore >= 25 ? 'warn' : 'good'}
            hint={`Level: ${riskLevel(k.riskScore)} · top-3 equipment average`}
          />
          <Kpi
            label="Production efficiency"
            value={`${k.productionEfficiency}%`}
            tone={k.productionEfficiency >= 90 ? 'good' : 'warn'}
            hint={`${fmtNum(k.actualTons)} of ${fmtNum(k.targetTons)} t`}
          />
          <Kpi label="Equipment availability" value={`${k.availability}%`} tone={k.availability >= 85 ? 'good' : 'warn'} hint={`${k.downtimeHours} h unplanned downtime`} />
          <Kpi
            label="Est. value leakage"
            value={fmtUsd(k.valueLeakageUsd)}
            tone="warn"
            hint="Lean waste, this period (estimate)"
          />
          <Kpi label="Lean waste score" value={String(k.leanWasteScore)} unit="/100" hint="Weighted across 9 categories" />
          <Kpi label="Fuel intensity" value={String(k.fuelIntensity)} unit="L/t" hint="Fuel ÷ tons mined" />
          <Kpi label="Truck queue share" value={`${k.waitingShare}%`} tone={k.waitingShare > 12 ? 'warn' : 'neutral'} hint="Waiting ÷ operating hours" />
          <Kpi
            label="Open high/critical incidents"
            value={String(k.openCriticalIncidents)}
            tone={k.openCriticalIncidents > 0 ? 'bad' : 'good'}
            hint="Requires HSE follow-up"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Section title="Production vs target" description="Daily tons, both shifts" className="lg:col-span-3">
            <ProductionTrendChart data={o.productionTrend} />
          </Section>
          <Section title="Downtime by equipment" description="Top 8, hours this period" className="lg:col-span-2">
            <DowntimeChart data={o.downtime} />
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Section
            title="Highest-risk equipment"
            action={<Link href={`/risk?${qs}`} className="text-xs font-medium text-primary hover:underline">Details</Link>}
          >
            <ul className="flex flex-col gap-3">
              {o.topRisks.map((r) => (
                <li key={r.equipmentId}>
                  <Link href={`/risk?${qs}&eq=${r.equipmentId}`} className="group flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono font-medium group-hover:text-primary">
                        {r.code} <span className="text-muted-foreground">· Site {r.siteId}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs">{r.score}</span>
                        <LevelBadge level={r.level} />
                      </span>
                    </div>
                    <ScoreBar value={r.score} color={COLORS[r.level]} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Top recommended actions"
            action={<Link href={`/recommendations?${qs}`} className="text-xs font-medium text-primary hover:underline">Action plan</Link>}
          >
            <ol className="flex flex-col gap-3">
              {o.recommendations.map((r, i) => (
                <li key={r.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{r.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Tag>{r.category}</Tag>
                      <Tag>Site {r.siteId}</Tag>
                      <Tag>priority {r.priorityScore}</Tag>
                      {r.roi !== null && <Tag>ROI {r.roi}x</Tag>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Recent events" description="Incidents and corrective work orders">
            <ul className="flex flex-col divide-y divide-border">
              {o.events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{e.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {e.date} · Site {e.siteId}
                      {e.equipment ? ` · ${e.equipment}` : ''} · {e.status}
                    </p>
                  </div>
                  <LevelBadge level={e.severity} />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Link
          href={`/copilot?${qs}`}
          className="card group flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary"
        >
          <div>
            <p className="text-sm font-semibold">Ask the copilot</p>
            <p className="text-xs text-muted-foreground">
              {'"Why is Site A underperforming?" · "Simulate a 15% queue reduction" · "What should we fix first?"'}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
        </Link>
      </div>
    </>
  )
}
