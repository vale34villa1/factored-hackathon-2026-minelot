import Link from 'next/link'
import clsx from 'clsx'
import { RiskFactorChart } from '@/components/charts/charts'
import { EvidenceList, Kpi, LevelBadge, PageHeader, ScoreBar, Section } from '@/components/ui/primitives'
import { sliceDataset } from '@/lib/analytics/kpis'
import { RISK_MODEL, aggregateRisk, riskDistribution, scoreEquipmentRisk } from '@/lib/analytics/risk'
import { dataset } from '@/lib/data/dataset'
import { COLORS, parseFilter } from '@/lib/params'

export default async function RiskPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const filter = parseFilter(sp)
  const risks = scoreEquipmentRisk(sliceDataset(dataset, filter))
  const selected = risks.find((r) => r.equipmentId === sp.eq) ?? risks[0]
  const dist = riskDistribution(risks)
  const countOf = (level: string) => dist.find((d) => d.level === level)?.count ?? 0
  const qs = `site=${filter.site}&days=${filter.days}`

  return (
    <>
      <PageHeader
        title="Operational risk"
        description="Prototype risk model: weighted, explainable factors from telemetry, maintenance and incident history. It ranks where to look first; it is not a certified safety model."
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Aggregate risk" value={String(aggregateRisk(risks))} unit="/100" />
          {(['critical', 'high', 'medium', 'low'] as const).map((l) => (
            <Kpi key={l} label={`${l[0].toUpperCase()}${l.slice(1)} assets`} value={String(countOf(l))} tone={l === 'critical' && countOf(l) ? 'bad' : 'neutral'} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Section title="Risk ranking" description={`${risks.length} assets · click to inspect`} className="lg:col-span-2">
            <ul className="-mx-2 flex max-h-[560px] flex-col overflow-y-auto">
              {risks.map((r) => (
                <li key={r.equipmentId}>
                  <Link
                    href={`/risk?${qs}&eq=${r.equipmentId}`}
                    scroll={false}
                    aria-current={r.equipmentId === selected?.equipmentId ? 'true' : undefined}
                    className={clsx(
                      'flex flex-col gap-1.5 rounded-md px-2 py-2',
                      r.equipmentId === selected?.equipmentId ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono font-medium">
                        {r.code} <span className="font-sans text-xs text-muted-foreground">{r.type.replace('_', ' ')} · Site {r.siteId}</span>
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

          {selected && (
            <div className="flex flex-col gap-4 lg:col-span-3">
              <Section
                title={`${selected.code} · Site ${selected.siteId}`}
                description={`Score ${selected.score}/100 · likelihood ${selected.likelihood} × severity ${selected.severity} × exposure ${selected.exposure}`}
                action={<LevelBadge level={selected.level} />}
              >
                <RiskFactorChart data={selected.factors.map((f) => ({ label: f.label, contribution: f.contribution }))} />
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selected.factors.map((f) => (
                    <li key={f.key} className="rounded-md border border-border p-2.5 text-xs">
                      <p className="flex justify-between font-medium">
                        {f.label} <span className="font-mono">{f.contribution} pts</span>
                      </p>
                      <p className="mt-1 text-muted-foreground">{f.detail}</p>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Suggested mitigation" description="Requires supervisor review before execution">
                <p className="text-sm leading-relaxed">{selected.mitigation}</p>
              </Section>
              <Section title="Evidence" description="Source records used in this score">
                <EvidenceList items={selected.evidence} max={8} />
              </Section>
            </div>
          )}
        </div>

        <Section title="Model assumptions" description="Factor weights (sum to 1). Editable in lib/analytics/risk.ts.">
          <dl className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(RISK_MODEL.weights).map(([k, w]) => (
              <div key={k} className="rounded-md bg-muted p-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono font-medium">{w}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </>
  )
}
