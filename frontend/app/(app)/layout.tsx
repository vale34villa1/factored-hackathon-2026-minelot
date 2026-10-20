import { Suspense } from 'react'
import { BrandMark, SidebarNav } from '@/components/shell/sidebar-nav'
import { dataset } from '@/lib/data/dataset'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-4 p-4">
          <BrandMark />
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
          <div className="mt-auto hidden rounded-md border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground lg:block">
            <span className="label-tag mb-1.5 bg-muted text-foreground">Synthetic data</span>
            <p>
              {dataset.meta.name} v{dataset.meta.version} · seed {dataset.meta.seed}
            </p>
            <p>
              {dataset.meta.startDate} → {dataset.meta.endDate}
            </p>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
