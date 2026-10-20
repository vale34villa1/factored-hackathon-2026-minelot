import { NextResponse } from 'next/server'
import { SimulationInputSchema, runSimulation } from '@/lib/analytics/simulation'
import { dataset } from '@/lib/data/dataset'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = SimulationInputSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid simulation input', issues: parsed.error.issues }, { status: 400 })
  }
  return NextResponse.json(runSimulation(dataset, parsed.data))
}
