import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import MarketingLog from '@/lib/models/MarketingLog'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/marketing/logs
 * Admin-only: returns the marketing send log, newest first.
 * Query: ?limit=50&type=member_invoice&channel=sms
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')
    const type = req.nextUrl.searchParams.get('type')
    const channel = req.nextUrl.searchParams.get('channel')

    const filter: Record<string, unknown> = {}
    if (type) filter.type = type
    if (channel) filter.channel = channel

    const logs = await MarketingLog.find(filter).sort({ sent_at: -1 }).limit(limit).lean()
    return NextResponse.json(logs.map((l) => ({
      id: l._id.toString(),
      recipient_name: l.recipient_name,
      channel: l.channel,
      type: l.type,
      to: l.to,
      subject: l.subject,
      body: l.body?.slice(0, 200),
      test: l.test,
      status: l.status,
      error: l.error,
      sent_at: l.sent_at,
    })))
  } catch (err) {
    console.error('GET /api/marketing/logs error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
