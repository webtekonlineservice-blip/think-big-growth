import { Resend } from 'resend'

// Lazily construct the Resend client so a missing RESEND_API_KEY never throws
// at module-load time (which breaks `next build`'s page-data collection).
// The key is only required when an email is actually sent.
let _resend: Resend | null = null
function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set.')
  _resend = new Resend(apiKey)
  return _resend
}

const FROM = 'Think Big St. Louis <noreply@webtek.ai>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

// ─── Shared HTML layout ───────────────────────────────────────────────────────
function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1f2937;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #374151;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <span style="display:inline-block;background:#ea580c;color:#fff;font-weight:700;font-size:13px;padding:5px 9px;border-radius:6px;">TB</span>
                <span style="margin-left:10px;font-weight:600;font-size:16px;color:#f9fafb;">Think Big St. Louis</span>
              </td>
              <td align="right"><span style="font-size:12px;color:#6b7280;">BNI Chapter · Kirkwood, MO</span></td>
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#1f2937;padding:32px;border-radius:0 0 12px 12px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#4b5563;">Think Big St. Louis BNI · Every Thursday 11:30 AM · Mike Duffy's Pub &amp; Grill, Kirkwood MO</p>
            <p style="margin:8px 0 0;font-size:11px;color:#374151;">Powered by <a href="https://webtek.ai" style="color:#ea580c;text-decoration:none;">Webtek.ai</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;margin-top:8px;">${text}</a>`
}

function meetingCard(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #374151;border-radius:8px;padding:20px;margin:24px 0;">
    <tr><td style="padding:8px 0;">
      <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px;">📅 When</span>
      <p style="margin:4px 0 0;color:#f9fafb;font-weight:600;">Every Thursday at 11:30 AM</p>
    </td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #374151;">
      <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px;">📍 Where</span>
      <p style="margin:4px 0 0;color:#f9fafb;font-weight:600;">Mike Duffy's Pub &amp; Grill</p>
      <p style="margin:2px 0 0;color:#9ca3af;font-size:14px;">Kirkwood, MO</p>
    </td></tr>
    <tr><td style="padding:8px 0;border-top:1px solid #374151;">
      <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px;">💰 Cost</span>
      <p style="margin:4px 0 0;color:#f9fafb;font-weight:600;">Free for guests — no commitment</p>
    </td></tr>
  </table>`
}

// ─── Email 1: Welcome (sent immediately on registration) ──────────────────────
export async function sendWelcomeEmail({
  to,
  firstName,
  invitedByName,
}: {
  to: string
  firstName: string
  invitedByName?: string | null
}) {
  const inviteNote = invitedByName
    ? `<p style="color:#9ca3af;font-size:15px;margin:0 0 24px;">You were personally invited by <strong style="color:#f9fafb;">${invitedByName}</strong> — they think you'd be a great fit.</p>`
    : ''

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f9fafb;">Welcome, ${firstName}! 🎉</h1>
    <p style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:.8px;margin:0 0 24px;">You're registered to visit Think Big St. Louis</p>
    ${inviteNote}
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 8px;">
      We're excited to have you join us. Think Big St. Louis is a BNI chapter of professionals
      who help each other grow through structured referrals. One seat per profession — come see
      if yours is available.
    </p>
    ${meetingCard()}
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Guests can visit <strong>twice at no cost</strong> before deciding to apply for membership.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border:1px solid rgba(204,0,0,0.3);border-radius:10px;margin:0 0 24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.5px;">One Final Step</p>
        <p style="margin:0 0 14px;font-size:14px;color:#d1d5db;line-height:1.5;">
          Please complete your official BNI visitor registration so we have everything ready when you arrive:
        </p>
        <a href="https://bnimidamerica.com/en-US/visitorregistration?chapterId=11708" style="display:inline-block;background:#CC0000;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">Complete BNI Registration →</a>
      </td></tr>
    </table>
    ${btn('View Chapter Info →', APP_URL)}
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">Questions? Reply to this email anytime.</p>
  `)

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `You're registered to visit Think Big St. Louis, ${firstName}!`,
    html,
  })
}

// ─── Email 2: Application reminder (Day 14 after visit) ──────────────────────
export async function sendApplicationReminderEmail({
  to,
  firstName,
  invitedByName,
}: {
  to: string
  firstName: string
  invitedByName?: string | null
}) {
  const inviteNote = invitedByName
    ? `<p style="color:#9ca3af;font-size:15px;margin:0 0 24px;"><strong style="color:#f9fafb;">${invitedByName}</strong> saved a seat for you — they'd love to have you in the chapter.</p>`
    : ''

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f9fafb;">Still thinking about it, ${firstName}?</h1>
    <p style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:.8px;margin:0 0 24px;">Your BNI application reminder</p>
    ${inviteNote}
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;margin:0 0 16px;">
      It's been two weeks since you visited Think Big St. Louis. We'd love to have you as a member.
      Spots are limited to one per profession — if your category is still open, now is the time.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;border:1px solid #2563eb;border-radius:8px;padding:20px;margin:16px 0 24px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#93c5fd;text-transform:uppercase;letter-spacing:.8px;">Why join now?</p>
        <ul style="margin:0;padding-left:20px;color:#d1d5db;font-size:14px;line-height:2;">
          <li>One member per profession — no internal competition</li>
          <li>Structured referrals that generate real revenue</li>
          <li>Weekly accountability and business education</li>
          <li>Access to 300K+ BNI members worldwide</li>
        </ul>
      </td></tr>
    </table>
    ${btn('Apply for Membership →', `${APP_URL}/join`)}
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">Not ready yet? You're always welcome to visit again.</p>
  `)

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${firstName}, your BNI membership spot may still be open`,
    html,
  })
}

// ─── Email 3: Custom / manual campaign ───────────────────────────────────────
export async function sendCustomEmail({
  to,
  subject,
  message,
  ctaText,
  ctaUrl,
}: {
  to: string
  subject: string
  message: string
  ctaText?: string
  ctaUrl?: string
}) {
  const cta =
    ctaText && ctaUrl ? `<div style="margin-top:24px;">${btn(ctaText, ctaUrl)}</div>` : ''

  const html = layout(`
    <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">${message.replace(/\n/g, '<br/>')}</p>
    ${cta}
  `)

  return getResend().emails.send({ from: FROM, to, subject, html })
}
