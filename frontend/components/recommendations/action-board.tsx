'use client'

import { useState } from 'react'
import useSWR from 'swr'
import clsx from 'clsx'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import type { Recommendation, RecommendationStatus } from '@/lib/analytics/recommendations'
import { EvidenceList, Tag } from '@/components/ui/primitives'
import { fmtUsd } from '@/lib/params'

interface StatusEntry {
  status: RecommendationStatus
  updatedAt: string
  note?: string
}
type StatusMap = Record<string, StatusEntry>

const STORAGE_KEY = 'minelot.recommendation-status.v1'
const STATUS_LABEL: Record<RecommendationStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  in_progress: 'In progress',
  completed: 'Completed',
  dismissed: 'Dismissed',
}
const NEXT: Record<RecommendationStatus, RecommendationStatus[]> = {
  proposed: ['approved', 'dismissed'],
  approved: ['in_progress', 'dismissed'],
  in_progress: ['completed'],
  completed: [],
  dismissed: ['proposed'],
}
const STATUS_STYLE: Record<RecommendationStatus, string> = {
  proposed: 'bg-muted text-muted-foreground',
  approved: 'bg-accent/10 text-accent',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-risk-low/10 text-risk-low',
  dismissed: 'bg-muted text-muted-foreground line-through',
}

function readStore(): StatusMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as StatusMap
  } catch {
    return {}
  }
}

function useStatuses() {
  const { data, mutate } = useSWR<StatusMap>(STORAGE_KEY, readStore, { fallbackData: {}, revalidateOnFocus: false })
  const update = (id: string, status: RecommendationStatus) => {
    const next = { ...readStore(), [id]: { status, updatedAt: new Date().toISOString() } }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    mutate(next, { revalidate: false })
  }
  return { statuses: data ?? {}, update }
}

const FILTERS = ['all', 'safety', 'maintenance', 'lean', 'energy'] as const

export function ActionBoard({ recommendations }: { recommendations: Recommendation[] }) {
  const { statuses, update } = useStatuses()
  const [category, setCategory] = useState<(typeof FILTERS)[number]>('all')
  const [open, setOpen] = useState<string | null>(recommendations[0]?.id ?? null)

  const statusOf = (id: string): RecommendationStatus => statuses[id]?.status ?? 'proposed'
  const visible = recommendations.filter((r) => category === 'all' || r.category === category)
  const counts = recommendations.reduce<Record<string, number>>((acc, r) => {
    const s = statusOf(r.id)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const approvedValue = recommendations
    .filter((r) => ['approved', 'in_progress', 'completed'].includes(statusOf(r.id)))
    .reduce((s, r) => s + (r.annualBenefitUsd ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {(Object.keys(STATUS_LABEL) as RecommendationStatus[]).map((s) => (
          <div key={s} className="card p-3">
            <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}</p>
            <p className="font-mono text-xl font-semibold">{counts[s] ?? 0}</p>
          </div>
        ))}
        <div className="card p-3">
          <p className="text-[11px] text-muted-foreground">Committed benefit /yr</p>
          <p className="font-mono text-xl font-semibold text-risk-low">{fmtUsd(approvedValue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={category === f}
              onClick={() => setCategory(f)}
              className={clsx(
                'rounded-full border px-3 py-1 text-xs capitalize',
                category === f ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Status is saved in this browser only (demo persistence). Connect a database to share it across the team.
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {visible.map((r) => {
          const status = statusOf(r.id)
          const isOpen = open === r.id
          const rank = recommendations.indexOf(r) + 1
          return (
            <li key={r.id} className="card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-4 p-4 text-left"
              >
                <span className="font-mono text-xs text-muted-foreground">{String(rank).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm font-medium', status === 'dismissed' && 'text-muted-foreground line-through')}>{r.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={clsx('label-tag', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
                    <Tag>{r.category}</Tag>
                    <Tag>Site {r.siteId}</Tag>
                    <Tag>{r.team}</Tag>
                  </div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="font-mono text-sm font-semibold">{r.priorityScore}</p>
                  <p className="text-[10px] text-muted-foreground">priority</p>
                </div>
                <div className="hidden shrink-0 text-right md:block">
                  <p className="font-mono text-sm">{r.roi !== null ? `${r.roi}x` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">ROI</p>
                </div>
                <ChevronDown className={clsx('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
                  <div className="flex flex-col gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Why</p>
                      <p className="mt-0.5 leading-relaxed">{r.rationale}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Risk addressed</p>
                      <p className="mt-0.5 leading-relaxed">{r.riskAddressed}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Expected impact</p>
                      <p className="mt-0.5 leading-relaxed">{r.expectedImpact}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      {[
                        ['Est. cost', fmtUsd(r.estimatedCostUsd)],
                        ['Benefit /yr', r.annualBenefitUsd !== null ? fmtUsd(r.annualBenefitUsd) : 'n/a'],
                        ['Feasibility', r.feasibility],
                        ['Confidence', r.confidence],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md bg-muted p-2">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="font-mono font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-xs text-muted-foreground">Human approval required.</span>
                      {NEXT[status].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => update(r.id, n)}
                          className={clsx(
                            'rounded-md px-3 py-1.5 text-xs font-medium',
                            n === 'dismissed'
                              ? 'border border-border hover:bg-muted'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90',
                          )}
                        >
                          {n === 'proposed' ? 'Restore' : `Mark ${STATUS_LABEL[n].toLowerCase()}`}
                        </button>
                      ))}
                      {statuses[r.id] && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          updated {new Date(statuses[r.id].updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Evidence</p>
                    <EvidenceList items={r.evidence} />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
