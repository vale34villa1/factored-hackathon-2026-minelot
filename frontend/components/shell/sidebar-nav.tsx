'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Database,
  Gauge,
  MessageSquareText,
  ShieldAlert,
  SlidersHorizontal,
  Recycle,
} from 'lucide-react'
import clsx from 'clsx'

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: Gauge },
  { href: '/risk', label: 'Operational risk', icon: ShieldAlert },
  { href: '/lean', label: 'Lean waste', icon: Recycle },
  { href: '/simulator', label: 'What-if simulator', icon: SlidersHorizontal },
  { href: '/recommendations', label: 'Action plan', icon: ClipboardCheck },
  { href: '/compare', label: 'Site comparison', icon: BarChart3 },
  { href: '/evidence', label: 'Evidence explorer', icon: Database },
  { href: '/copilot', label: 'AI copilot', icon: MessageSquareText },
]

export function SidebarNav() {
  const pathname = usePathname()
  const params = useSearchParams()
  const qs = new URLSearchParams()
  for (const k of ['site', 'days']) {
    const v = params.get(k)
    if (v) qs.set(k, v)
  }
  const suffix = qs.size ? `?${qs.toString()}` : ''

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={`${href}${suffix}`}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function BrandMark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Activity className="size-4" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">MINeLOT</span>
        <span className="block text-[11px] text-muted-foreground">Decision intelligence</span>
      </span>
    </Link>
  )
}
