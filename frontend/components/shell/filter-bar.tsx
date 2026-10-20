'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import clsx from 'clsx'

const SITES = [
  { value: 'all', label: 'All sites' },
  { value: 'A', label: 'Site A' },
  { value: 'B', label: 'Site B' },
  { value: 'C', label: 'Site C' },
]
const DAYS = [7, 14, 30]

export function FilterBar({ showSite = true }: { showSite?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const site = params.get('site') ?? 'all'
  const days = Number(params.get('days') ?? 30)

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    next.delete('page')
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-2 transition-opacity', pending && 'opacity-60')} aria-busy={pending}>
      {showSite && (
        <div role="group" aria-label="Site" className="flex rounded-md border border-border bg-surface p-0.5">
          {SITES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => update('site', s.value)}
              aria-pressed={site === s.value}
              className={clsx(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                site === s.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div role="group" aria-label="Period" className="flex rounded-md border border-border bg-surface p-0.5">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => update('days', String(d))}
            aria-pressed={days === d}
            className={clsx(
              'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors',
              days === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {d}d
          </button>
        ))}
      </div>
    </div>
  )
}
