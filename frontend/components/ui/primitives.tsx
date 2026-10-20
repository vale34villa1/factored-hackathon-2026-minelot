import { Suspense } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { FilterBar } from '@/components/shell/filter-bar'
import type { EvidenceRef } from '@/lib/data/types'

export function PageHeader({
  title,
  description,
  showFilters = true,
  showSite = true,
  children,
}: {
  title: string
  description: string
  showFilters?: boolean
  showSite?: boolean
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border px-6 py-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-balance text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {showFilters && (
          <Suspense fallback={null}>
            <FilterBar showSite={showSite} />
          </Suspense>
        )}
      </div>
    </header>
  )
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={clsx('card flex flex-col', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  )
}

export function Kpi({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span
          className={clsx(
            'font-mono text-2xl font-semibold tracking-tight',
            tone === 'good' && 'text-risk-low',
            tone === 'warn' && 'text-risk-high',
            tone === 'bad' && 'text-risk-critical',
          )}
        >
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

const LEVEL_STYLE: Record<string, string> = {
  critical: 'bg-risk-critical/10 text-risk-critical',
  high: 'bg-risk-high/10 text-risk-high',
  medium: 'bg-risk-medium/15 text-[#8a6100]',
  low: 'bg-risk-low/10 text-risk-low',
}

export function LevelBadge({ level }: { level: string }) {
  return <span className={clsx('label-tag', LEVEL_STYLE[level] ?? 'bg-muted text-muted-foreground')}>{level}</span>
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx('label-tag bg-muted text-muted-foreground', className)}>{children}</span>
}

export function EvidenceList({ items, max = 6 }: { items: EvidenceRef[]; max?: number }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
      {items.slice(0, max).map((e, i) => (
        <li key={`${e.recordId}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="text-foreground">{e.label}</p>
            {e.value && <p className="mt-0.5 font-mono text-muted-foreground">{e.value}</p>}
          </div>
          <Link
            href={`/evidence?dataset=${e.dataset}&q=${encodeURIComponent(e.recordId)}`}
            className="shrink-0 font-mono text-[11px] text-primary underline-offset-2 hover:underline"
          >
            {e.dataset}/{e.recordId}
          </Link>
        </li>
      ))}
      {items.length > max && <li className="px-3 py-2 text-[11px] text-muted-foreground">+{items.length - max} more records</li>}
    </ul>
  )
}

export function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
    </div>
  )
}
