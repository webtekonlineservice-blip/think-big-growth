import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

/**
 * POST /api/email-preview
 * Admin-only: Send a test email to yourself to preview what prospects receive.
 * Body: { to: string, step: 1|2|3, test_name?: string, test_company?: string, test_profession?: string }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { to, step, test_name, test_company, test_profession } = await req.json() as {
      to?: string
      step?: number
      test_name?: string
      test_company?: string
      test_profession?: string
    }

    if (!to?.trim()) return NextResponse.json({ error: 'Recipient email (to) is required.' }, { status: 400 })
    if (!step || step < 1 || step > 3) return NextResponse.json({ error: 'Step must be 1, 2, or 3.' }, { status: 400 })

    const name = test_name || 'John'
    const company = test_company || 'Smith Consulting'
    const profession = test_profession || 'Financial Advisor'
    const inviteCode = session.invite_code || 'patrick'

    // Build the email content (same as outbound cron)
    const sequences = getSequences(name, company, profession)
    const seq = sequences[step - 1]

    const ctaUrl = `${APP_URL}/api/track/click/TEST_ID?url=${encodeURIComponent(`${APP_URL}/invite/${inviteCode}`)}`
    const trackingPixel = `<!-- Tracking pixel disabled in test mode -->`
    const unsubLink = `${APP_URL}/api/unsubscribe/TEST_TOKEN`

    const html = buildEmail(seq.body, seq.cta_text, ctaUrl, unsubLink, trackingPixel)

    // Use Resend — in sandbox mode from address must be onboarding@resend.dev
    const fromAddress = process.env.RESEND_API_KEY?.startsWith('re_')
      ? 'Think Big St. Louis <onboarding@resend.dev>'
      : 'Think Big St. Louis <noreply@thinkbig.webtek.ai>'

    const result = await resend.emails.send({
      from: fromAddress,
      to: to.trim(),
      subject: `[TEST] ${seq.subject}`,
      html,
    })

    return NextResponse.json({ success: true, id: result.data?.id ?? 'sent', subject: seq.subject })
  } catch (err) {
    console.error('POST /api/email-preview error:', err)
    const message = err instanceof Error ? err.message : 'Failed to send test email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function getSequences(name: string, company: string, profession: string) {
  return [
    {
      subject: `${name}, there's an open seat in your category at Think Big St. Louis`,
      body: `Hi ${name},\n\nI came across ${company} and noticed you're in ${profession} — which happens to be an open category at our BNI chapter, Think Big St. Louis.\n\nBNI is a structured referral group where each profession gets one exclusive seat. Members meet weekly and actively pass referrals to each other. No competition — just collaboration.\n\nWe meet every Thursday at 11:30 AM at Mike Duffy's in Kirkwood, MO. Guests visit free, no commitment.\n\nWould you be open to checking it out?`,
      cta_text: 'Learn More & Register →',
    },
    {
      subject: `How ${company} could get referrals every single week`,
      body: `Hi ${name},\n\nQuick follow-up — I wanted to share what makes Think Big St. Louis different from typical networking events.\n\nOur members don't just exchange business cards. Each week, we:\n• Give a 60-second pitch to the group\n• Pass qualified referrals to each other\n• Hold each other accountable for growth\n\nBNI chapters worldwide generate billions in referred business annually. And since only one ${profession} can hold the seat, you'd have zero competition within the group.\n\nWorth 90 minutes of your Thursday to see if it fits?`,
      cta_text: 'Reserve Your Guest Spot →',
    },
    {
      subject: `Last thought — your Thursday seat at Think Big`,
      body: `Hi ${name},\n\nLast note from me — I don't want to be a pest.\n\nThe ${profession} seat at Think Big St. Louis is still open. If you've been thinking about a reliable way to get more referrals for ${company}, this is it.\n\nFree to visit. Thursday 11:30 AM. Mike Duffy's Pub & Grill, Kirkwood.\n\nIf now's not the right time, no worries at all. But if you're curious, the link below takes 30 seconds.\n\nEither way — wishing you a great week.`,
      cta_text: "I'm Interested →",
    },
  ]
}

function buildEmail(body: string, ctaText: string, ctaUrl: string, unsubLink: string, pixel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <!-- Red accent bar -->
  <tr><td style="background:linear-gradient(135deg,#CC0000,#990000);border-radius:12px 12px 0 0;padding:4px;"></td></tr>
  <!-- Header -->
  <tr><td style="background:#111827;padding:24px 32px;border-bottom:1px solid #1f2937;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <span style="display:inline-block;background:#CC0000;color:#fff;font-weight:700;font-size:12px;padding:5px 10px;border-radius:6px;letter-spacing:.5px;">BNI</span>
        <span style="margin-left:10px;font-weight:600;font-size:15px;color:#f1f5f9;">Think Big St. Louis</span>
      </td>
      <td align="right">
        <span style="font-size:11px;color:#64748b;">Kirkwood, MO</span>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="background:#111827;padding:32px;">
    <p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 24px;white-space:pre-line;">${body}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#CC0000;color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
    <p style="color:#64748b;font-size:13px;margin:28px 0 0;">
      We meet every Thursday at 11:30 AM at Mike Duffy's Pub & Grill in Kirkwood, MO. Free to visit — no commitment.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#0d1117;border-radius:0 0 12px 12px;padding:20px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;font-size:11px;color:#475569;">
          Think Big St. Louis · BNI Chapter · Kirkwood, MO<br/>
          <a href="${unsubLink}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
        </p>
      </td>
      <td align="right">
        <span style="font-size:10px;color:#374151;">Powered by </span>
        <a href="https://webtek.ai" style="color:#4F46E5;text-decoration:none;font-size:11px;font-weight:600;">Webtek.ai</a>
      </td>
    </tr></table>
  </td></tr>
</table>
${pixel}
</td></tr>
</table>
</body>
</html>`
}
