import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import SentEmail from '@/lib/models/SentEmail'
import { getSession } from '@/lib/auth'
import { buildMemberAnnouncement } from '@/lib/memberAnnouncement'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.')
  _resend = new Resend(apiKey)
  return _resend
}
const FROM = 'Patrick @ Think Big St. Louis <noreply@webtek.ai>'
const SUBJECT = "I built something for our chapter — take a look"

/**
 * POST /api/members/announce
 * Admin-only.
 *   { test: true, to?: "email" }  → send one test (defaults to your own email)
 *   { all: true }                 → send to every member with a real email
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json() as { test?: boolean; to?: string; all?: boolean }
    await connectDB()

    // ── Test mode ──
    if (body.test) {
      const to = body.to || session.email
      const html = buildMemberAnnouncement({
        memberName: session.name || 'Patrick',
        inviteCode: session.invite_code || 'patrick',
      })
      const result = await getResend().emails.send({ from: FROM, to, subject: `[TEST] ${SUBJECT}`, html })

      await SentEmail.create({
        type: 'test',
        subject: SUBJECT,
        to,
        recipient_name: session.name || '',
        status: result.error ? 'failed' : 'sent',
        error: result.error?.message,
        resend_id: result.data?.id,
      })

      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
      return NextResponse.json({ success: true, sent_to: to, id: result.data?.id })
    }

    // ── Send to all members ──
    if (body.all) {
      const members = await Member.find({
        email: { $exists: true, $ne: '', $not: { $regex: 'thinkbig.local|placeholder' } },
      }).lean()

      const batchId = crypto.randomBytes(8).toString('hex')
      let sent = 0
      let failed = 0

      for (const m of members) {
        const html = buildMemberAnnouncement({ memberName: m.name, inviteCode: m.invite_code })
        let status: 'sent' | 'failed' = 'sent'
        let error: string | undefined
        let resendId: string | undefined

        try {
          const result = await getResend().emails.send({ from: FROM, to: m.email, subject: SUBJECT, html })
          if (result.error) { status = 'failed'; error = result.error.message }
          else { resendId = result.data?.id; sent++ }
          if (status === 'failed') failed++
        } catch (err) {
          status = 'failed'; error = String(err); failed++
        }

        await SentEmail.create({
          type: 'announcement',
          subject: SUBJECT,
          to: m.email,
          recipient_name: m.name,
          status,
          error,
          resend_id: resendId,
          batch_id: batchId,
        })

        await new Promise((r) => setTimeout(r, 600))
      }

      return NextResponse.json({ success: true, sent, failed, total: members.length, batch_id: batchId })
    }

    return NextResponse.json({ error: 'Specify test:true or all:true' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/members/announce error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
