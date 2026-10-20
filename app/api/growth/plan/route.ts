import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buildGrowthSnapshot } from '@/lib/growthSnapshot'
import { generateGrowthPlan } from '@/lib/growthAI'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/growth/plan
 * Admin-only. Builds a live snapshot and returns an AI-generated growth plan
 * plus the snapshot it was based on (so the UI can show the numbers).
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const snapshot = await buildGrowthSnapshot()
    const plan = await generateGrowthPlan(snapshot)
    return NextResponse.json({ snapshot, plan })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate plan.'
    console.error('GET /api/growth/plan error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
