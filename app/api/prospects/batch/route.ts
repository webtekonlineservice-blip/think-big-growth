import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { runOutbound } from '@/lib/outbound'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TEST_INBOX = 'webtekdigitalai@gmail.com'

/**
 * POST /api/prospects/batch  { mode: 'preview' | 'test' | 'send', limit?: number }
 * Admin-only. One batch across every active campaign.
 *  - preview: nothing is sent; returns the recipients and subjects
 *  - test:    the first 3 emails of that batch go to the Webtek test inbox; prospects don't advance
 *  - send:    real sends (max 60 per request so it finishes inside the time limit)
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode === 'send' || body.mode === 'test' ? body.mode : 'preview'
    const limit = Math.max(1, Math.min(60, Number(body.limit) || 25))
    const out = await runOutbound({ mode, limit, testTo: TEST_INBOX })
    return NextResponse.json({ ...out, test_inbox: mode === 'test' ? TEST_INBOX : undefined })
  } catch (err) {
    console.error('POST /api/prospects/batch error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Batch failed.' }, { status: 500 })
  }
}
