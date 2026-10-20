import { LeanScoreChart } from '@/components/charts/charts'
import { EvidenceList, Kpi, PageHeader, ScoreBar, Section, Tag } from '@/components/ui/primitives'
import { sliceDataset } from '@/lib/analytics/kpis'
import { analyzeLean, leanWasteScore, valueLeakage } from '@/lib/analytics/lean'
import { dataset } from '@/lib/data/dataset'
import { COLORS, fmtUsd, parseFilter } from '@/lib/params'

const scoreColor = (s: number) => (s >= 60 ? COLORS.critical : s >= 40 ? COLORS.high : s >= 20 ? COLORS.medium : COLORS.low)

export default async function LeanPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filter = parseFilter(await searchParams)
  const wastes = analyzeLean(dataset, sliceDataset(dataset, filter))
  const sorted = [...wastes].sort((a, b) => b.score - a.score)
  const leakage = valueLeakage(wastes)

  return (
    <>
      <PageHeader
        title="Lean waste analysis"
        description="The eight Lean wastes (DOWNTIME) plus energy, each tied to a measurable mining indicator. Costs are estimates from documented assumptions, not accounting figures."
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Lean waste score" value={String(leanWasteScore(wastes))} unit="/100" />
          <Kpi label="Est. value leakage" value={fmtUsd(leakage)} hint={`Over ${filter.days} days`} tone="warn" />
          <Kpi label="Annualised" value={fmtUsd((leakage / filter.days) * 365)} hint="Linear extrapolation" />
          <Kpi label="Largest waste" value={sorted[0].name} hint={`Score ${sorted[0].score}/100`} />
        </div>

        <Section title="Waste score by category" description="0 = at benchmark, 100 = severe">
          <LeanScoreChart data={sorted.map((w) => ({ name: w.name, score: w.score }))} />
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((w) => (
            <Section
              key={w.key}
              title={w.name}
              description={w.indicator}
              action={
                <div className="flex items-center gap-1.5">
                  {w.group === 'energy' && <Tag>energy</Tag>}
                  <Tag>conf. {w.confidence}</Tag>
                </div>
              }
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {w.value}
                      <span className="ml-1 text-xs text-muted-foreground">{w.unit}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">Benchmark: {w.benchmark}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-medium">{fmtUsd(w.estimatedCostUsd)}</p>
                    <p className="text-[11px] text-muted-foreground">est. cost</p>
                  </div>
                </div>
                <ScoreBar value={w.score} color={scoreColor(w.score)} />
                <p className="text-sm leading-relaxed text-muted-foreground">{w.impact}</p>
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-xs font-medium">Recommended action</p>
                  <p className="mt-1 leading-relaxed">{w.recommendation}</p>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-primary">Assumptions & evidence</summary>
                  <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                    {w.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <EvidenceList items={w.evidence} max={4} />
                  </div>
                </details>
              </div>
            </Section>
          ))}
        </div>
      </div>
    </>
  )
}
