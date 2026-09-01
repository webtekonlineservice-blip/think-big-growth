import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import Prospect from '@/lib/models/Prospect'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { getSession } from '@/lib/auth'
import { buildMemberAnnouncement } from '@/lib/memberAnnouncement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Think Big St. Louis <noreply@webtek.ai>'

async function getLiveStats() {
  const [members, prospects, campaigns, filledCount] = await Promise.all([
    Member.countDocuments(),
    Prospect.countDocuments({ email: { $not: { $regex: 'placeholder.local' }, $ne: '' } }),
    EmailCampaign.find().lean(),
    Member.countDocuments({ role: { $ne: '' } }),
  ])
  const emailsSent = campaigns.reduce((sum, c) => sum + (c.total_sent || 0), 0)
  // Rough open-seat count: full BNI category list (34) minus filled roles
  const openCategories = Math.max(0, 34 - filledCount)
  return { members, prospects, emailsSent, openCategories }
}

/**
 * POST /api/members/announce
 * Admin-only. Sends the platform announcement email.
 * Body:
 *   { test: true, to: "email" }      → sends one test email
 *   { send_all: true }               → sends to all members with a real email
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { test, to, send_all } = await req.json() as { test?: boolean; to?: string; send_all?: boolean }

    await connectDB()
    const stats = await getLiveStats()

    // ── Test mode — single email ──
    if (test) {
      const recipient = to || session.email
      const html = buildMemberAnnouncement({
        memberName: session.name || 'Member',
        inviteCode: session.invite_code || 'patrick',
        stats,
      })
      const result = await resend.emails.send({
        from: FROM,
        to: recipient,
        subject: 'Your Think Big St. Louis growth platform is live 🚀',
        html,
      })
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, sentTo: recipient, stats })
    }

    // ── Send to all members ──
    if (send_all) {
      const members = await Member.find({
        email: { $not: { $regex: 'thinkbig.local|placeholder' } },
      }).lean()

      let sent = 0
      let failed = 0
      const errors: string[] = []

      for (const m of members) {
        // Skip fake/internal emails
        if (!m.email.includes('@') || m.email.includes('.local')) { continue }
        try {
          const html = buildMemberAnnouncement({
            memberName: m.name,
            inviteCode: m.invite_code,
            stats,
          })
          const result = await resend.emails.send({
            from: FROM,
            to: m.email,
            subject: 'Your Think Big St. Louis growth platform is live 🚀',
            html,
          })
          if (result.error) { failed++; errors.push(`${m.email}: ${result.error.message}`) }
          else { sent++ }
        } catch (e) {
          failed++
          errors.push(`${m.email}: ${String(e)}`)
        }
      }

      return NextResponse.json({ success: true, sent, failed, errors: errors.slice(0, 5), stats })
    }

    return NextResponse.json({ error: 'Provide { test: true } or { send_all: true }' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/members/announce error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
