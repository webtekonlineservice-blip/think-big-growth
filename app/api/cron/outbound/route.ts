import { NextRequest, NextResponse } from 'next/server'
import { runOutbound } from '@/lib/outbound'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/outbound
 * Daily cron: sends the next batch of outbound emails for all active campaigns.
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    // Capped so the run (550 ms between sends) always finishes inside maxDuration.
    const out = await runOutbound({ limit: 40 })
    console.log('Cron /api/cron/outbound:', { sent: out.sent, errors: out.errors, planned: out.planned.length, excluded: out.excluded })
    return NextResponse.json({ ran_at: out.ran_at, sent: out.sent, errors: out.errors, excluded: out.excluded, results: out.results })
  } catch (err) {
    console.error('Cron outbound error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
