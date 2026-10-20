import { Simulator } from '@/components/simulator/simulator'
import { PageHeader } from '@/components/ui/primitives'
import { parseFilter } from '@/lib/params'

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const filter = parseFilter(await searchParams)
  return (
    <>
      <PageHeader
        title="What-if simulator"
        description="Test operational changes against the observed baseline. Results are deterministic estimates under documented assumptions, not forecasts."
      />
      <div className="p-6">
        <Simulator key={`${filter.site}-${filter.days}`} site={filter.site} days={filter.days} />
      </div>
    </>
  )
}
