import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'
import { sendMarketingSms, sendMarketingWhatsApp, buildMeetingReminderSms } from '@/lib/marketing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/marketing/reminder
 * Admin-only: send a weekly meeting reminder to all members via SMS and/or WhatsApp.
 *
 * Body: {
 *   channels: ('sms' | 'whatsapp')[]
 *   speakerName?: string
 *   speakerCompany?: string
 *   date?: string            // e.g. "October 9"
 *   test: boolean            // true = send only to admin test phone
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { channels = ['sms'], speakerName, speakerCompany, date, test = true } = await req.json()

    await connectDB()
    const members = await Member.find({ is_admin: false }).select('name phone').lean()

    const body = buildMeetingReminderSms({ speakerName, speakerCompany, date })
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    if (test) {
      for (let i = 0; i < channels.length; i++) {
        const ch = channels[i]
        const sendFn = ch === 'whatsapp' ? sendMarketingWhatsApp : sendMarketingSms
        const r = await sendFn({ to: '+13149223810', body, recipientName: 'TEST', type: 'meeting_reminder', test: true })
        if (r.ok) results.sent++; else { results.failed++; results.errors.push(r.error || 'unknown') }
      }
      return NextResponse.json({ ok: true, test: true, body, ...results })
    }

    // Live mode — send to all members with a phone number
    for (const m of members) {
      if (!m.phone) { results.skipped++; continue }
      for (let i = 0; i < channels.length; i++) {
        const ch = channels[i]
        const sendFn = ch === 'whatsapp' ? sendMarketingWhatsApp : sendMarketingSms
        const r = await sendFn({ to: m.phone, body, recipientName: m.name, type: 'meeting_reminder', test: false })
        if (r.ok) results.sent++; else { results.failed++; results.errors.push(`${m.name}: ${r.error}`) }
        await new Promise((res) => setTimeout(res, 150))
      }
    }

    return NextResponse.json({ ok: true, test: false, body, ...results })
  } catch (err) {
    console.error('POST /api/marketing/reminder error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
