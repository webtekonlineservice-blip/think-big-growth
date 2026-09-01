import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { buildMemberAnnouncement } from '@/lib/memberAnnouncement'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Patrick — Think Big St. Louis <noreply@webtek.ai>'

/**
 * POST /api/member-announce
 * Admin-only: send the member interest/announcement email.
 * Body:
 *   { test: true, to: "email" }            → send a single test
 *   { sendAll: true }                       → send to all members
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()

    // ── Test mode: send one email ──
    if (body.test) {
      const to = body.to || session.email
      const html = buildMemberAnnouncement({
        memberName: body.name || 'Patrick',
        inviteCode: body.inviteCode || session.invite_code || 'patrick',
      })
      const result = await resend.emails.send({
        from: FROM,
        to,
        subject: 'I built something for our chapter 👀',
        html,
      })
      return NextResponse.json({ success: true, id: result.data?.id ?? 'sent', to })
    }

    // ── Send to all members ──
    if (body.sendAll) {
      await connectDB()
      const members = await Member.find({
        email: { $not: /thinkbig\.local$/ },  // skip placeholder emails
      }).lean()

      let sent = 0
      let failed = 0
      const results: Array<{ email: string; status: string }> = []

      for (const m of members) {
        try {
          const html = buildMemberAnnouncement({
            memberName: m.name,
            inviteCode: m.invite_code,
          })
          await resend.emails.send({
            from: FROM,
            to: m.email,
            subject: 'I built something for our chapter 👀',
            html,
          })
          sent++
          results.push({ email: m.email, status: 'sent' })
        } catch (err) {
          failed++
          results.push({ email: m.email, status: 'failed' })
        }
      }

      return NextResponse.json({ sent, failed, total: members.length, results })
    }

    return NextResponse.json({ error: 'Specify { test: true } or { sendAll: true }' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/member-announce error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
