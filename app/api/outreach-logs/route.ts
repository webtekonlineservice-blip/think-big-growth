import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import OutreachLog from '@/lib/models/OutreachLog'
import ProspectEvent from '@/lib/models/ProspectEvent'
import Prospect from '@/lib/models/Prospect'
import EmailCampaign from '@/lib/models/EmailCampaign'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'

/**
 * GET /api/outreach-logs?page=1&limit=50
 * Admin-only: returns all sent messages (SMS + email) for visitors and prospects.
 * Enriches prospect events with real email addresses, campaign names, and
 * the invite code (member credit) embedded in each outbound email.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50'))

    // ── Visitor outreach logs ──────────────────────────────────────────────
    const [logs, logsTotal] = await Promise.all([
      OutreachLog.find().sort({ sent_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      OutreachLog.countDocuments(),
    ])

    // ── Prospect/campaign sent events ─────────────────────────────────────
    const [events, eventsTotal] = await Promise.all([
      ProspectEvent.find({ type: 'sent' })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProspectEvent.countDocuments({ type: 'sent' }),
    ])

    // Enrich events: resolve prospect emails + campaign invite codes
    if (events.length > 0) {
      const prospectIds = Array.from(new Set(events.map((e) => e.prospect_id.toString())))
      const campaignIds = Array.from(new Set(events.map((e) => e.campaign_id.toString())))

      const [prospects, campaigns, members] = await Promise.all([
        Prospect.find({ _id: { $in: prospectIds } }).select('email name').lean(),
        EmailCampaign.find({ _id: { $in: campaignIds } }).select('name invite_code').lean(),
        Member.find().select('name invite_code').lean(),
      ])

      const prospectMap = new Map(prospects.map((p) => [p._id.toString(), p]))
      const campaignMap = new Map(campaigns.map((c) => [c._id.toString(), c]))
      const memberByInvite = new Map(members.map((m) => [m.invite_code, m.name]))

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
          campaign_name: null as string | null,
          invite_code: null as string | null,
          credited_to: null as string | null,
          prospect_name: null as string | null,
        })),
        ...events.map((e) => {
          const prospect = prospectMap.get(e.prospect_id.toString())
          const campaign = campaignMap.get(e.campaign_id.toString())
          const inviteCode = campaign?.invite_code ?? null
          const creditedTo = inviteCode ? (memberByInvite.get(inviteCode) ?? inviteCode) : null
          return {
            id: e._id.toString(),
            type: 'prospect_campaign' as const,
            channel: 'email' as const,
            step: `sequence_${e.step}`,
            to: prospect?.email ?? e.prospect_id.toString(),
            status: 'sent' as const,
            error: null,
            date: e.created_at?.toISOString() ?? '',
            campaign_name: campaign?.name ?? null,
            invite_code: inviteCode,
            credited_to: creditedTo,
            prospect_name: prospect?.name ?? null,
          }
        }),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit)

      return NextResponse.json({ logs: combined, total: logsTotal + eventsTotal, page })
    }

    // No events — just visitor logs
    const combined = logs.map((l) => ({
      id: l._id.toString(),
      type: 'visitor_outreach' as const,
      channel: l.channel,
      step: l.step,
      to: l.to,
      status: l.status,
      error: l.error ?? null,
      date: l.sent_at?.toISOString() ?? '',
      campaign_name: null,
      invite_code: null,
      credited_to: null,
      prospect_name: null,
    }))

    return NextResponse.json({ logs: combined, total: logsTotal + eventsTotal, page })
  } catch (err) {
    console.error('GET /api/outreach-logs error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
