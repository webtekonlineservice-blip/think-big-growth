import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import EmailCampaign from '@/lib/models/EmailCampaign'
import ProspectEvent from '@/lib/models/ProspectEvent'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Think Big St. Louis <noreply@webtek.ai>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

/**
 * GET /api/cron/outbound
 * Daily cron: sends the next batch of outbound emails for all active campaigns.
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    await connectDB()

    const campaigns = await EmailCampaign.find({ active: true }).lean()
    const results: Array<{ campaign: string; sent: number; errors: number }> = []

    for (const campaign of campaigns) {
      const maxStep = campaign.sequence.length
      let sent = 0
      let errors = 0

      // Find prospects ready for next email
      // Conditions: not unsubscribed, sequence_step < maxStep, has real email, enough days passed
      const now = new Date()

      const prospects = await Prospect.find({
        campaign_id: campaign._id,
        unsubscribed: false,
        sequence_step: { $lt: maxStep },
        status: { $nin: ['converted', 'unsubscribed'] },
        email: { $not: /placeholder\.local$/ },
      })
        .sort({ created_at: 1 })
        .limit(campaign.batch_size)
        .lean()

      for (const prospect of prospects) {
        const nextStep = prospect.sequence_step + 1
        const stepConfig = campaign.sequence.find((s) => s.step === nextStep)
        if (!stepConfig) continue

        // Check delay — must have waited enough days since last send
        if (prospect.last_sent_at) {
          const daysSinceLast = Math.floor(
            (now.getTime() - new Date(prospect.last_sent_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceLast < stepConfig.delay_days) continue
        }

        // Build email content
        const subject = replacePlaceholders(stepConfig.subject, prospect)
        const body = replacePlaceholders(stepConfig.body, prospect)

        // Build tracked CTA URL
        const ctaUrl = stepConfig.cta_url
          ? `${APP_URL}/api/track/click/${prospect._id}?url=${encodeURIComponent(stepConfig.cta_url.replace('[invite_code]', campaign.invite_code))}`
          : `${APP_URL}/api/track/click/${prospect._id}?url=${encodeURIComponent(`${APP_URL}/invite/${campaign.invite_code}`)}`

        const ctaText = stepConfig.cta_text || 'Visit Think Big St. Louis →'

        // Build HTML
        const trackingPixel = `<img src="${APP_URL}/api/track/open/${prospect._id}" width="1" height="1" alt="" style="display:none;" />`
        const unsubLink = `${APP_URL}/api/unsubscribe/${prospect.unsubscribe_token}`

        const html = buildEmail(body, ctaText, ctaUrl, unsubLink, trackingPixel)

        try {
          await resend.emails.send({ from: FROM, to: prospect.email, subject, html })

          // Update prospect
          await Prospect.findByIdAndUpdate(prospect._id, {
            $set: { sequence_step: nextStep, last_sent_at: now, status: `sequence_${nextStep}` },
          })

          // Log event
          await ProspectEvent.create({
            prospect_id: prospect._id,
            campaign_id: campaign._id,
            type: 'sent',
            step: nextStep,
          })

          // Update campaign counter
          await EmailCampaign.findByIdAndUpdate(campaign._id, { $inc: { total_sent: 1 } })

          sent++
        } catch (err) {
          console.error(`Outbound send failed for ${prospect.email}:`, err)
          errors++
        }
      }

      results.push({ campaign: campaign.name, sent, errors })
    }

    console.log('Cron /api/cron/outbound completed:', results)
    return NextResponse.json({ results, ran_at: new Date().toISOString() })
  } catch (err) {
    console.error('Cron outbound error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function replacePlaceholders(text: string, prospect: { name?: string; company?: string; profession?: string }): string {
  return text
    .replace(/\[name\]/gi, prospect.name || 'there')
    .replace(/\[company\]/gi, prospect.company || 'your business')
    .replace(/\[profession\]/gi, prospect.profession || 'your profession')
}

function buildEmail(body: string, ctaText: string, ctaUrl: string, unsubLink: string, pixel: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <!-- Header with BNI Red accent -->
  <tr><td style="background:linear-gradient(135deg,#CC0000,#990000);border-radius:12px 12px 0 0;padding:4px;"></td></tr>
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
  <!-- Footer with Webtek credit -->
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
