import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OutreachLog from '@/lib/models/OutreachLog'
import ProspectEvent from '@/lib/models/ProspectEvent'
import { getSession } from '@/lib/auth'

/**
 * GET /api/outreach-logs?page=1&limit=50
 * Admin-only: returns all sent messages (SMS + email) for visitors and prospects.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50'))

    // Get visitor outreach logs
    const [logs, logsTotal] = await Promise.all([
      OutreachLog.find().sort({ sent_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      OutreachLog.countDocuments(),
    ])

    // Get prospect/campaign events (sent type only)
    const [events, eventsTotal] = await Promise.all([
      ProspectEvent.find({ type: 'sent' }).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ProspectEvent.countDocuments({ type: 'sent' }),
    ])

    // Merge and sort by date
    const combined = [
      ...logs.map((l) => ({
        id: l._id.toString(),
        type: 'visitor_outreach' as const,
        channel: l.channel,
        step: l.step,
        to: l.to,
        status: l.status,
        error: l.error ?? null,
        date: l.sent_at?.toISOString() ?? '',
      })),
      ...events.map((e) => ({
        id: e._id.toString(),
        type: 'prospect_campaign' as const,
        channel: 'email' as const,
        step: `sequence_${e.step}`,
        to: e.prospect_id?.toString() ?? '',
        status: 'sent' as const,
        error: null,
        date: e.created_at?.toISOString() ?? '',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)

    return NextResponse.json({
      logs: combined,
      total: logsTotal + eventsTotal,
      page,
    })
  } catch (err) {
    console.error('GET /api/outreach-logs error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
