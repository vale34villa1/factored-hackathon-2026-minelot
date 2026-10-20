'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { COLORS } from '@/lib/params'

const axis = { fontSize: 11, fill: '#78716c' }
const tooltipStyle = { fontSize: 12, borderRadius: 6, border: `1px solid ${COLORS.grid}` }

export function ProductionTrendChart({ data }: { data: { date: string; actual: number; target: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Daily production versus target in tons">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="date" tick={axis} tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toLocaleString('en-US')} t`} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
          <Line type="monotone" dataKey="target" name="Target" stroke={COLORS.muted} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.primary} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DowntimeChart({ data }: { data: { label: string; unplanned: number; planned: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Downtime hours by equipment">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={axis} width={64} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} h`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="unplanned" name="Unplanned" stackId="d" fill={COLORS.critical} radius={[0, 0, 0, 0]} />
          <Bar dataKey="planned" name="Planned" stackId="d" fill={COLORS.muted} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const LEVEL_COLOR: Record<string, string> = {
  critical: COLORS.critical,
  high: COLORS.high,
  medium: COLORS.medium,
  low: COLORS.low,
}

export function LeanScoreChart({ data }: { data: { name: string; score: number }[] }) {
  const color = (s: number) => (s >= 60 ? COLORS.critical : s >= 40 ? COLORS.high : s >= 20 ? COLORS.medium : COLORS.low)
  return (
    <div className="h-72" role="img" aria-label="Lean waste score by category">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={axis} width={140} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} / 100`} />
          <Bar dataKey="score" name="Waste score" radius={[0, 3, 3, 0]}>
            {data.map((d) => (
              <Cell key={d.name} fill={color(d.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RiskFactorChart({ data }: { data: { label: string; contribution: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Risk score contribution by factor">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={axis} width={150} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} pts`} />
          <Bar dataKey="contribution" name="Contribution" fill={COLORS.accent} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SiteCompareChart({
  data,
  metric,
  unit,
}: {
  data: { siteId: string; value: number; best: boolean }[]
  metric: string
  unit: string
}) {
  return (
    <div className="h-32" role="img" aria-label={`${metric} by site`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <XAxis dataKey="siteId" tick={axis} tickFormatter={(s: string) => `Site ${s}`} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v} ${unit}`} />
          <Bar dataKey="value" name={metric} radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.siteId} fill={d.best ? COLORS.low : COLORS.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export { LEVEL_COLOR }
