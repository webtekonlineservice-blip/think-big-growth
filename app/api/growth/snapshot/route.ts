import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buildGrowthSnapshot } from '@/lib/growthSnapshot'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/growth/snapshot
 * Admin-only. Returns the live, deterministic chapter growth snapshot.
 * Used by the Growth Advisor page and the dashboard growth widget.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const snapshot = await buildGrowthSnapshot()
    return NextResponse.json(snapshot)
  } catch (err) {
    console.error('GET /api/growth/snapshot error:', err)
    return NextResponse.json({ error: 'Failed to build snapshot.' }, { status: 500 })
  }
}
