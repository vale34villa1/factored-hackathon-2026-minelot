import Link from 'next/link'
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from 'lucide-react'

const features = [
  {
    icon: BarChart3,
    title: 'See the operation clearly',
    text: 'Turn production signals into a focused view of performance, cost, and bottlenecks.',
  },
  {
    icon: ShieldCheck,
    title: 'Surface risk earlier',
    text: 'Prioritize the equipment and process risks that deserve attention first.',
  },
  {
    icon: Sparkles,
    title: 'Move from insight to action',
    text: 'Test scenarios, compare options, and turn evidence into practical decisions.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="MineCopilot home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">M</span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">MineCopilot</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Decision intelligence</span>
          </span>
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Open workspace <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <span className="label-tag mb-5 bg-muted text-primary">Operational clarity for modern mining</span>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] text-foreground sm:text-6xl">
            Make better decisions before the next shift starts.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            MineCopilot connects operational evidence, risk signals, and scenario analysis in one practical workspace for technology-led mining teams.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110">
              Enter the workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/simulator" className="inline-flex items-center rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              Run a scenario
            </Link>
          </div>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Synthetic operational dataset · built for exploration</p>
        </div>

        <div className="card overflow-hidden bg-accent text-white shadow-[0_20px_60px_-30px_hsl(var(--accent))]">
          <div className="border-b border-white/15 px-6 py-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Live operating picture</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="System healthy" />
            </div>
            <p className="mt-8 text-2xl font-medium tracking-tight">From scattered signals to a decision-ready view.</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/10">
            <div className="bg-accent p-6"><p className="font-mono text-[10px] uppercase tracking-wider text-white/55">Production health</p><p className="mt-2 text-3xl font-semibold">82<span className="text-base text-white/50"> / 100</span></p><p className="mt-1 text-xs text-emerald-300">Stable trend</p></div>
            <div className="bg-accent p-6"><p className="font-mono text-[10px] uppercase tracking-wider text-white/55">Priority risks</p><p className="mt-2 text-3xl font-semibold">07</p><p className="mt-1 text-xs text-amber-300">3 need action</p></div>
          </div>
          <div className="border-t border-white/15 px-6 py-5"><div className="flex items-end gap-1" aria-label="Operational trend visualization">{[30, 42, 36, 58, 52, 68, 62, 79, 74, 88, 82, 94].map((height, index) => <span key={index} className="flex-1 rounded-t-sm bg-primary" style={{ height: `${height / 2}px` }} />)}</div></div>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-3 lg:px-8">
          {features.map(({ icon: Icon, title, text }) => <div key={title}><Icon className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
        </div>
      </section>
    </main>
  )
}
