import { NextRequest, NextResponse } from 'next/server'
import { runOutbound } from '@/lib/outbound'

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
    const { results, ran_at } = await runOutbound()
    console.log('Cron /api/cron/outbound completed:', results)
    return NextResponse.json({ results, ran_at })
  } catch (err) {
    console.error('Cron outbound error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
