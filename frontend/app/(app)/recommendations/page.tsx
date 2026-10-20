import { ActionBoard } from '@/components/recommendations/action-board'
import { PageHeader, Section } from '@/components/ui/primitives'
import { PRIORITY_WEIGHTS, buildRecommendations } from '@/lib/analytics/recommendations'
import { dataset } from '@/lib/data/dataset'
import { parseFilter } from '@/lib/params'

export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filter = parseFilter(await searchParams)
  const recs = buildRecommendations(dataset, filter)
  return (
    <>
      <PageHeader
        title="Action plan"
        description="Recommendations ranked by safety, impact, ROI, feasibility and cost. Move each one through an approval workflow; nothing is executed automatically."
      />
      <div className="flex flex-col gap-4 p-6">
        <ActionBoard recommendations={recs} />
        <Section title="Prioritisation formula">
          <p className="font-mono text-xs leading-relaxed text-muted-foreground">
            priority = 100 × ({Object.entries(PRIORITY_WEIGHTS).map(([k, w]) => `${w}·${k}`).join(' + ')}) · each factor normalised 0–1; cost is inverted.
          </p>
        </Section>
      </div>
    </>
  )
}
