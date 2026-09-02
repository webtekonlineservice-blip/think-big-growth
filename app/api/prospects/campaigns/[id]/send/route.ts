import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * POST /api/prospects/campaigns/[id]/send
 * Admin-only: manually trigger the outbound cron to send the next batch NOW.
 * Delegates to the cron endpoint using the CRON_SECRET.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'
    const cronSecret = process.env.CRON_SECRET

    // Trigger the outbound cron (it sends the next batch for all active campaigns)
    const res = await fetch(`${appUrl}/api/cron/outbound`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Send trigger failed.' }, { status: 500 })
    }

    const data = await res.json()
    // Find this campaign's result
    const campaignResult = data.results?.find(
      (r: { campaign: string; sent: number }) => r.sent > 0
    )

    return NextResponse.json({
      success: true,
      results: data.results,
      sent: campaignResult?.sent ?? 0,
    })
  } catch (err) {
    console.error('Manual send error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
