import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  sendMarketingSms,
  sendMarketingWhatsApp,
  sendMarketingEmail,
  buildAnnouncementSms,
} from '@/lib/marketing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/segments/send
 * Admin-only: send a message to all contacts in a previewed segment.
 *
 * Body: {
 *   contacts: { id, name, email, phone }[]   // from /api/segments/preview
 *   channels: ('sms' | 'whatsapp' | 'email')[]
 *   message: string                           // [name] and [company] supported
 *   subject?: string                          // required for email
 *   test: boolean
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { contacts, channels = ['sms'], message, subject, test = true } = await req.json()
    if (!contacts?.length) return NextResponse.json({ error: 'No contacts provided.' }, { status: 400 })
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    if (channels.includes('email') && !subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required for email channel.' }, { status: 400 })
    }

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    // Test mode: send to admin only, once per channel
    if (test) {
      const body = buildAnnouncementSms(message)
      for (const ch of channels) {
        let r: { ok: boolean; error?: string }
        if (ch === 'whatsapp') {
          r = await sendMarketingWhatsApp({ to: '+13149223810', body, recipientName: 'TEST', type: 'chapter_announcement', test: true })
        } else if (ch === 'sms') {
          r = await sendMarketingSms({ to: '+13149223810', body, recipientName: 'TEST', type: 'chapter_announcement', test: true })
        } else {
          r = await sendMarketingEmail({ to: 'webtekdigitalai@gmail.com', subject: `[TEST] ${subject || 'Segment send'}`, html: `<p>${message.replace(/\n/g, '<br>')}</p>`, recipientName: 'TEST', type: 'chapter_announcement', test: true })
        }
        if (r.ok) results.sent++; else { results.failed++; results.errors.push(r.error || 'unknown') }
      }
      return NextResponse.json({ ok: true, test: true, ...results })
    }

    // Live mode: send to each contact
    for (const contact of contacts) {
      const firstName = (contact.name || '').split(' ')[0] || contact.name
      const resolved = message
        .replace(/\[name\]/gi, firstName)
        .replace(/\[company\]/gi, contact.company || '')

      let sent = false
      for (const ch of channels) {
        let r: { ok: boolean; error?: string }
        if (ch === 'sms') {
          if (!contact.phone) { results.skipped++; continue }
          r = await sendMarketingSms({ to: contact.phone, body: resolved, recipientName: contact.name, type: 'chapter_announcement', test: false })
        } else if (ch === 'whatsapp') {
          if (!contact.phone) { results.skipped++; continue }
          r = await sendMarketingWhatsApp({ to: contact.phone, body: resolved, recipientName: contact.name, type: 'chapter_announcement', test: false })
        } else {
          if (!contact.email) { results.skipped++; continue }
          const htmlBody = `<p style="font-size:15px;line-height:1.7;color:#e2e8f0;">${resolved.replace(/\n/g, '<br>')}</p>`
          r = await sendMarketingEmail({ to: contact.email, subject: subject!, html: htmlBody, recipientName: contact.name, type: 'chapter_announcement', test: false })
        }
        if (r.ok) { sent = true; results.sent++ }
        else { results.failed++; results.errors.push(`${contact.name}: ${r.error}`) }
        await new Promise((res) => setTimeout(res, 100))
      }
      if (!sent && channels.length > 0) results.skipped++
    }

    return NextResponse.json({ ok: true, test: false, ...results })
  } catch (err) {
    console.error('POST /api/segments/send error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
