import Link from 'next/link'
import { z } from 'zod'
import clsx from 'clsx'
import { PageHeader, Tag } from '@/components/ui/primitives'
import { ASSUMPTION_LABELS } from '@/lib/analytics/assumptions'
import { buildEvidenceIndex } from '@/lib/analytics/evidence'
import { dataset } from '@/lib/data/dataset'

const DATASETS = ['all', 'telemetry', 'production', 'maintenance', 'incidents', 'equipment', 'knowledge'] as const
const PAGE_SIZE = 25
const index = buildEvidenceIndex(dataset)

const ParamsSchema = z.object({
  dataset: z.enum(DATASETS).catch('all'),
  q: z.string().max(100).catch('').default(''),
  page: z.coerce.number().int().min(1).catch(1).default(1),
})

export default async function EvidencePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const p = ParamsSchema.parse(await searchParams)
  const q = p.q.trim().toLowerCase()
  const rows = index.filter(
    (r) =>
      (p.dataset === 'all' || r.dataset === p.dataset) &&
      (!q || r.recordId.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)),
  )
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(p.page, pages)
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const href = (over: Partial<{ dataset: string; q: string; page: number }>) => {
    const sp = new URLSearchParams({ dataset: p.dataset, q: p.q, page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) })
    return `/evidence?${sp.toString()}`
  }

  return (
    <>
      <PageHeader
        title="Evidence explorer"
        description={`Every number in MINeLOT traces back to these ${index.length.toLocaleString('en-US')} source records. ${dataset.meta.notice}`}
        showFilters={false}
      />
      <div className="flex flex-col gap-4 p-6">
        <form action="/evidence" className="flex flex-wrap items-center gap-2" role="search">
          <input type="hidden" name="dataset" value={p.dataset} />
          <label htmlFor="evidence-q" className="sr-only">
            Search records
          </label>
          <input
            id="evidence-q"
            name="q"
            defaultValue={p.q}
            placeholder="Search by record ID or text, e.g. TRK-07 or hydraulic"
            className="h-9 w-full max-w-md rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground"
          />
          <button type="submit" className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background">
            Search
          </button>
        </form>
        <nav aria-label="Dataset" className="flex flex-wrap gap-1.5">
          {DATASETS.map((d) => (
            <Link
              key={d}
              href={href({ dataset: d, page: 1 })}
              aria-current={p.dataset === d ? 'page' : undefined}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs',
                p.dataset === d ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground',
              )}
            >
              {d}
            </Link>
          ))}
        </nav>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Source records</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Record</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Summary</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Used in</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.dataset}-${r.recordId}`} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <p className="font-mono text-xs font-medium">{r.recordId}</p>
                    <p className="mt-1 flex gap-1">
                      <Tag>{r.dataset}</Tag>
                      {r.siteId && <Tag>Site {r.siteId}</Tag>}
                    </p>
                    {r.timestamp && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{r.timestamp}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs leading-relaxed">
                    {r.summary}
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{r.source}</p>
                  </td>
                  <td className="hidden max-w-sm px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground lg:table-cell">
                    {r.calculation}
                    <span className="mt-1 block italic">{r.limitations}</span>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No records match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {rows.length.toLocaleString('en-US')} records · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Next
              </Link>
            )}
          </div>
        </div>

        <section className="card p-4">
          <h2 className="text-sm font-semibold">Cost & model assumptions</h2>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {ASSUMPTION_LABELS.map((a) => (
              <div key={a.key} className="rounded-md bg-muted p-2.5">
                <dt className="text-muted-foreground">{a.label}</dt>
                <dd className="font-mono font-medium">{a.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  )
}
