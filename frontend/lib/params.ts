import { z } from 'zod'
import type { Filter } from '@/lib/analytics/kpis'

export const FilterSchema = z.object({
  site: z.enum(['all', 'A', 'B', 'C']).catch('all'),
  days: z.coerce.number().int().min(7).max(30).catch(30),
})

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams

export function parseFilter(params: RawParams): Filter {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k]
    return Array.isArray(v) ? v[0] : (v ?? undefined)
  }
  return FilterSchema.parse({ site: get('site'), days: get('days') })
}

export const DAY_OPTIONS = [7, 14, 30] as const

export const COLORS = {
  primary: '#a85a04',
  accent: '#334155',
  muted: '#a8a29e',
  grid: '#e7e3dc',
  critical: '#c42121',
  high: '#e8650c',
  medium: '#e0a40e',
  low: '#278a5b',
} as const

export const fmtUsd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`

export const fmtNum = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d })
