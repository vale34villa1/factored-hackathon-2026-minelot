import { SiteCompareChart } from '@/components/charts/charts'
import { PageHeader, Section } from '@/components/ui/primitives'
import { COMPARE_METRICS, compareSites } from '@/lib/analytics/compare'
import { dataset } from '@/lib/data/dataset'
import { parseFilter } from '@/lib/params'

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filter = parseFilter(await searchParams)
  const { summaries, transfers } = compareSites(dataset, filter.days)

  return (
    <>
      <PageHeader
        title="Site comparison"
        description="Benchmark the three sites side by side and spot practices worth investigating for transfer. Differences are observational, not causal."
        showSite={false}
      />
      <div className="flex flex-col gap-4 p-6">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Metric</th>
                {summaries.map((s) => (
                  <th key={s.siteId} scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="block text-foreground">Site {s.siteId}</span>
                    <span className="font-normal">{s.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((m) => {
                const t = transfers.find((x) => x.metric === m.key)!
                return (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      {m.label} <span className="font-mono text-[10px] text-muted-foreground">{m.unit}</span>
                    </th>
                    {summaries.map((s) => {
                      const best = s.siteId === t.bestSite
                      const worst = s.siteId === t.worstSite
                      return (
                        <td
                          key={s.siteId}
                          className={`px-4 py-2.5 text-right font-mono ${best ? 'font-semibold text-risk-low' : worst ? 'text-risk-critical' : ''}`}
                        >
                          {String(s[m.key])}
                          {best && <span className="sr-only"> (best)</span>}
                          {worst && <span className="sr-only"> (worst)</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {transfers.map((t) => (
            <Section key={t.metric} title={t.label} description={t.evidence}>
              <SiteCompareChart
                metric={t.label}
                unit={t.unit}
                data={summaries.map((s) => ({ siteId: s.siteId, value: s[t.metric] as number, best: s.siteId === t.bestSite }))}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t.note}</p>
            </Section>
          ))}
        </div>
      </div>
    </>
  )
}
