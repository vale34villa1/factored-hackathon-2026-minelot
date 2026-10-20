'use client'

import { useDeferredValue, useState } from 'react'
import useSWR from 'swr'
import clsx from 'clsx'
import { RotateCcw } from 'lucide-react'
import type { SimulationInput, SimulationResult } from '@/lib/analytics/simulation'
import { Section, Tag } from '@/components/ui/primitives'
import { fmtNum, fmtUsd } from '@/lib/params'

type Lever = { key: keyof SimulationInput; label: string; min: number; max: number; step: number; unit: string; help: string }

const LEVERS: Lever[] = [
  { key: 'waitingReductionPct', label: 'Truck queue reduction', min: 0, max: 50, step: 1, unit: '%', help: 'Dispatch / shovel-match improvements' },
  { key: 'downtimeReductionPct', label: 'Unplanned downtime reduction', min: 0, max: 50, step: 1, unit: '%', help: 'Predictive maintenance, faster repair' },
  { key: 'availabilityDeltaPts', label: 'Availability change', min: -10, max: 10, step: 0.5, unit: 'pts', help: 'Direct availability gain or loss' },
  { key: 'fuelReductionPct', label: 'Fuel reduction', min: 0, max: 30, step: 1, unit: '%', help: 'Idle reduction, driving behaviour' },
  { key: 'routeEfficiencyPct', label: 'Route deviation removed', min: 0, max: 100, step: 5, unit: '%', help: 'Share of route deviation eliminated' },
  { key: 'maintenanceIntervalChangePct', label: 'PM interval change', min: -30, max: 30, step: 5, unit: '%', help: 'Longer intervals reduce planned stops but raise failures' },
]

const PRESETS: { label: string; values: Partial<SimulationInput> }[] = [
  { label: 'Dispatch optimisation', values: { waitingReductionPct: 15, routeEfficiencyPct: 30 } },
  { label: 'Predictive maintenance', values: { downtimeReductionPct: 25, maintenanceIntervalChangePct: -10 } },
  { label: 'Fuel programme', values: { fuelReductionPct: 8, waitingReductionPct: 5 } },
]

const DEFAULTS: SimulationInput = {
  site: 'all',
  days: 30,
  waitingReductionPct: 0,
  availabilityDeltaPts: 0,
  fuelReductionPct: 0,
  downtimeReductionPct: 0,
  routeEfficiencyPct: 0,
  maintenanceIntervalChangePct: 0,
}

const fetcher = async ([url, body]: [string, SimulationInput]) => {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error('Simulation failed')
  return (await res.json()) as SimulationResult
}

export function Simulator({ site, days }: { site: SimulationInput['site']; days: number }) {
  const [levers, setLevers] = useState<SimulationInput>({ ...DEFAULTS, site, days })
  const input = useDeferredValue({ ...levers, site, days })
  const { data, error, isLoading } = useSWR(['/api/simulate', input], fetcher, { keepPreviousData: true })

  const set = (key: keyof SimulationInput, v: number) => setLevers((s) => ({ ...s, [key]: v }))

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section
        title="Scenario levers"
        description="Adjust one or more assumptions"
        className="lg:col-span-2"
        action={
          <button
            type="button"
            onClick={() => setLevers({ ...DEFAULTS, site, days })}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" aria-hidden /> Reset
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setLevers({ ...DEFAULTS, site, days, ...p.values })}
              className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {LEVERS.map((l) => {
            const id = `lever-${l.key}`
            const value = levers[l.key] as number
            return (
              <div key={l.key}>
                <div className="flex items-baseline justify-between">
                  <label htmlFor={id} className="text-sm font-medium">
                    {l.label}
                  </label>
                  <span className="font-mono text-sm">
                    {value > 0 && l.min < 0 ? '+' : ''}
                    {value}
                    {l.unit}
                  </span>
                </div>
                <input
                  id={id}
                  type="range"
                  min={l.min}
                  max={l.max}
                  step={l.step}
                  value={value}
                  onChange={(e) => set(l.key, Number(e.target.value))}
                  className="mt-2 w-full accent-[#a85a04]"
                />
                <p className="text-[11px] text-muted-foreground">{l.help}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <div className="flex flex-col gap-4 lg:col-span-3">
        <Section
          title="Projected impact"
          description={data ? `Baseline ${data.period.from} → ${data.period.to} (${data.period.days} days), deterministic model` : 'Computing…'}
          action={isLoading ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
        >
          {error && <p className="text-sm text-risk-critical">Could not run the simulation. Try again.</p>}
          {data && (
            <div className={clsx('flex flex-col gap-4 transition-opacity', isLoading && 'opacity-60')}>
              <div className="rounded-md bg-foreground p-4 text-background">
                <p className="text-xs opacity-70">Annualised net benefit (estimate)</p>
                <p className="mt-1 font-mono text-3xl font-semibold">{fmtUsd(data.annualizedBenefitUsd)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Baseline</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Scenario</th>
                      <th scope="col" className="py-2 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.metrics.map((m) => {
                      const improved = m.better === 'higher' ? m.delta > 0 : m.delta < 0
                      const flat = Math.abs(m.deltaPct) < 0.05
                      return (
                        <tr key={m.key} className="border-b border-border last:border-0">
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            {m.label}
                            {m.kind === 'estimate' && <Tag className="ml-1.5">est.</Tag>}
                          </th>
                          <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                            {fmtNum(m.baseline, 2)} <span className="text-[10px]">{m.unit}</span>
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">{fmtNum(m.scenario, 2)}</td>
                          <td
                            className={clsx(
                              'py-2 text-right font-mono',
                              flat ? 'text-muted-foreground' : improved ? 'text-risk-low' : 'text-risk-critical',
                            )}
                          >
                            {m.deltaPct > 0 ? '+' : ''}
                            {fmtNum(m.deltaPct, 1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {data.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-md border border-risk-high/30 bg-risk-high/5 p-3 text-xs">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Section>
        {data && (
          <Section title="Formulas" description="Every number above is reproducible from these equations">
            <ul className="flex flex-col gap-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {data.formulas.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
