import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runOutbound } from '@/lib/outbound'

/**
 * POST /api/prospects/campaigns/[id]/send
 * Admin-only: manually send the next batch NOW for THIS campaign only.
 * Optional JSON body: { profession?: string } to restrict recipients to a
 * matching profession (e.g. "real estate agent") within the campaign.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    const out = await runOutbound({ campaignId: params.id, profession, limit: 60 })
    return NextResponse.json({
      success: true,
      results: out.results,
      ran_at: out.ran_at,
      sent: out.sent,
      errors: out.errors,
      excluded: out.excluded,
      skipped: out.results.find((r) => r.skipped)?.skipped ?? null,
    })
  } catch (err) {
    console.error('Manual send error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
