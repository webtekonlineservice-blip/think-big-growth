import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runOutbound } from '@/lib/outbound'

/**
 * POST /api/prospects/campaigns/[id]/send
 * Admin-only: manually send the next batch NOW for THIS campaign only.
 * Optional JSON body: { profession?: string } to restrict recipients to a
 * matching profession (e.g. "real estate agent") within the campaign.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    // Body is optional — tolerate empty/no body.
    let profession: string | undefined
    try {
      const body = await req.json()
      if (body && typeof body.profession === 'string' && body.profession.trim()) {
        profession = body.profession.trim()
      }
    } catch {
      // no body provided
    }

    const { results, ran_at } = await runOutbound({ campaignId: params.id, profession })

    // Scoped to a single campaign, so there's at most one result.
    const campaignResult = results[0]

    return NextResponse.json({
      success: true,
      results,
      ran_at,
      sent: campaignResult?.sent ?? 0,
      errors: campaignResult?.errors ?? 0,
      skipped: campaignResult?.skipped ?? null,
    })
  } catch (err) {
    console.error('Manual send error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
