import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import { getSession } from '@/lib/auth'
import { sendSms } from '@/lib/twilio'
import { sendCustomEmail } from '@/lib/resend'

type Segment = 'all' | 'invited' | 'visited' | 'applied'
type Channel = 'sms' | 'email' | 'both'

interface CampaignPayload {
  segment: Segment
  channel: Channel
  subject?: string    // email only
  message: string
  ctaText?: string
  ctaUrl?: string
}

/**
 * POST /api/campaigns
 * Admin-only: send a bulk SMS/email to a visitor segment.
 * Returns a summary of sent/failed counts.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as Partial<CampaignPayload>

    if (!body.segment || !body.channel || !body.message?.trim()) {
      return NextResponse.json({ error: 'segment, channel and message are required.' }, { status: 400 })
    }

    if ((body.channel === 'email' || body.channel === 'both') && !body.subject?.trim()) {
      return NextResponse.json({ error: 'subject is required for email campaigns.' }, { status: 400 })
    }

    await connectDB()

    // Build query — 'all' targets everyone not yet a member
    const statusFilter = body.segment === 'all'
      ? { $in: ['invited', 'visited', 'applied'] as const }
      : body.segment

    const visitors = await Visitor.find({ status: statusFilter }).lean()

    if (visitors.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0, message: 'No visitors match this segment.' })
    }

    let smsSent = 0, smsFailed = 0
    let emailSent = 0, emailFailed = 0

    for (const v of visitors) {
      // ── SMS ────────────────────────────────────────────────────────────────
      if (body.channel === 'sms' || body.channel === 'both') {
        try {
          const text = body.message
            .replace(/\[name\]/gi, v.first_name)
            .replace(/\[company\]/gi, v.company)
          await sendSms(v.phone, text)
          smsSent++
        } catch {
          smsFailed++
        }
      }

      // ── Email ──────────────────────────────────────────────────────────────
      if (body.channel === 'email' || body.channel === 'both') {
        try {
          const msg = body.message
            .replace(/\[name\]/gi, v.first_name)
            .replace(/\[company\]/gi, v.company)
          await sendCustomEmail({
            to: v.email,
            subject: body.subject!,
            message: msg,
            ctaText: body.ctaText,
            ctaUrl: body.ctaUrl,
          })
          emailSent++
        } catch {
          emailFailed++
        }
      }
    }

    return NextResponse.json({
      total: visitors.length,
      sms: { sent: smsSent, failed: smsFailed },
      email: { sent: emailSent, failed: emailFailed },
    })
  } catch (err) {
    console.error('POST /api/campaigns error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
