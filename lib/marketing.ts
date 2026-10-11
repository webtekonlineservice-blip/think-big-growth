/**
 * Marketing send engine — SMS, WhatsApp, and Email for chapter communications.
 *
 * TEST-FIRST RULE: every send function accepts a `test` flag.
 * When test=true, ALL sends are routed to the admin test address/phone.
 * No real member/visitor messages go out without an explicit test pass first.
 *
 * Channels:
 *   SMS       — Twilio from TWILIO_PHONE_NUMBER (+16366892103)
 *   WhatsApp  — Twilio from whatsapp:TWILIO_PHONE_NUMBER (same number, WA-enabled)
 *   Email     — Resend from noreply@webtek.ai
 *
 * Every send is logged to MarketingLog regardless of test mode.
 */

import { connectDB } from '@/lib/mongodb'
import MarketingLog, { MarketingChannel, MarketingType } from '@/lib/models/MarketingLog'
import { getTwilioClient } from '@/lib/twilio'
import { Resend } from 'resend'

// ─── Config ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'webtekdigitalai@gmail.com'
const TEST_PHONE = '+13149223810'
const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER || '+16366892103'
const FROM_EMAIL = 'Think Big St. Louis <noreply@webtek.ai>'

let _resend: Resend | null = null
function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set.')
  _resend = new Resend(key)
  return _resend
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

// ─── Log helper ──────────────────────────────────────────────────────────────

async function log(entry: {
  recipient_name: string
  channel: MarketingChannel
  type: MarketingType
  to: string
  subject?: string
  body: string
  test: boolean
  status: 'sent' | 'failed'
  error?: string
}) {
  try {
    await connectDB()
    await MarketingLog.create({ ...entry, sent_at: new Date() })
  } catch (e) {
    console.error('MarketingLog write failed:', e)
  }
}

// ─── Core send functions ──────────────────────────────────────────────────────

export async function sendMarketingSms(opts: {
  to: string
  body: string
  recipientName: string
  type: MarketingType
  test: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const realTo = normalizePhone(opts.to)
  const effectiveTo = opts.test ? TEST_PHONE : realTo
  try {
    const client = getTwilioClient()
    await client.messages.create({ from: FROM_PHONE, to: effectiveTo, body: opts.body })
    await log({ recipient_name: opts.recipientName, channel: 'sms', type: opts.type, to: effectiveTo, body: opts.body, test: opts.test, status: 'sent' })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await log({ recipient_name: opts.recipientName, channel: 'sms', type: opts.type, to: effectiveTo, body: opts.body, test: opts.test, status: 'failed', error })
    return { ok: false, error }
  }
}

export async function sendMarketingWhatsApp(opts: {
  to: string
  body: string
  recipientName: string
  type: MarketingType
  test: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const realTo = normalizePhone(opts.to)
  const effectiveTo = opts.test ? TEST_PHONE : realTo
  try {
    const client = getTwilioClient()
    await client.messages.create({
      from: `whatsapp:${FROM_PHONE}`,
      to: `whatsapp:${effectiveTo}`,
      body: opts.body,
    })
    await log({ recipient_name: opts.recipientName, channel: 'whatsapp', type: opts.type, to: effectiveTo, body: opts.body, test: opts.test, status: 'sent' })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await log({ recipient_name: opts.recipientName, channel: 'whatsapp', type: opts.type, to: effectiveTo, body: opts.body, test: opts.test, status: 'failed', error })
    return { ok: false, error }
  }
}

export async function sendMarketingEmail(opts: {
  to: string
  subject: string
  html: string
  recipientName: string
  type: MarketingType
  test: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const effectiveTo = opts.test ? TEST_EMAIL : opts.to
  try {
    await getResend().emails.send({ from: FROM_EMAIL, to: effectiveTo, subject: opts.subject, html: opts.html })
    await log({ recipient_name: opts.recipientName, channel: 'email', type: opts.type, to: effectiveTo, subject: opts.subject, body: opts.html.replace(/<[^>]+>/g, ' ').slice(0, 500), test: opts.test, status: 'sent' })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await log({ recipient_name: opts.recipientName, channel: 'email', type: opts.type, to: effectiveTo, subject: opts.subject, body: opts.subject, test: opts.test, status: 'failed', error })
    return { ok: false, error }
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

const money = (n: number) => `$${n.toFixed(2)}`
const MEETING = "Thursdays 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood"

/**
 * Member invoice — text or email showing what a member owes.
 * entries: their recent unpaid ledger charges.
 */
export function buildMemberInvoiceSms(opts: {
  name: string
  balance: number
  recentEntries: { description: string; amount: number; date: string; item?: string }[]
}): string {
  const { name, balance, recentEntries } = opts
  const firstName = name.split(' ')[0]
  if (balance <= 0) {
    return `Hi ${firstName} — you're all paid up with Think Big St. Louis. Thanks! See you Thursday. 💪`
  }
  const lines = recentEntries.slice(0, 3).map((e) =>
    `  • ${e.date}: ${e.description}${e.item ? ` (${e.item})` : ''} — ${money(e.amount)}`
  )
  return [
    `Hi ${firstName}, your Think Big St. Louis balance is ${money(balance)}.`,
    '',
    ...lines,
    '',
    `Pay Patrick directly at the next meeting (${MEETING}) or via Venmo/Cash App.`,
    'Questions? Reply to this text.',
  ].join('\n')
}

export function buildMemberInvoiceEmail(opts: {
  name: string
  balance: number
  recentEntries: { description: string; amount: number; date: string; item?: string; status: string }[]
}): { subject: string; html: string } {
  const { name, balance, recentEntries } = opts
  const firstName = name.split(' ')[0]
  const subject = balance > 0
    ? `Think Big St. Louis — Invoice: ${money(balance)} due, ${firstName}`
    : `Think Big St. Louis — You're all paid up, ${firstName}!`

  const rows = recentEntries.map((e) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #374151;color:#d1d5db;font-size:14px;">${e.date}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #374151;color:#f9fafb;font-size:14px;">${e.description}${e.item ? ` — <em style="color:#9ca3af">${e.item}</em>` : ''}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #374151;text-align:right;font-weight:700;color:${e.status === 'paid' ? '#4ade80' : '#f87171'};font-size:14px;">${money(e.amount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #374151;text-align:right;">
        <span style="padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;background:${e.status === 'paid' ? '#064e3b' : '#7f1d1d'};color:${e.status === 'paid' ? '#6ee7b7' : '#fca5a5'};">${e.status}</span>
      </td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f9fafb;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#1f2937;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #374151;">
    <span style="background:#D81F2E;color:#fff;font-weight:700;font-size:13px;padding:5px 10px;border-radius:6px;">TB</span>
    <span style="margin-left:10px;font-weight:600;font-size:16px;">Think Big St. Louis</span>
  </td></tr>
  <tr><td style="background:#1f2937;padding:32px;border-radius:0 0 12px 12px;">
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:800;">Hi ${firstName},</h2>
    <p style="margin:0 0 24px;color:#9ca3af;">Here's your current account summary.</p>
    <div style="background:#111827;border:1px solid ${balance > 0 ? '#dc2626' : '#16a34a'};border-radius:10px;padding:20px;margin:0 0 24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Balance Due</p>
      <p style="margin:8px 0 0;font-size:42px;font-weight:900;color:${balance > 0 ? '#f87171' : '#4ade80'};">${money(balance)}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${balance > 0 ? 'Please pay at the next meeting or via Venmo/Cash App' : "You're all paid up — thank you!"}</p>
    </div>
    ${recentEntries.length > 0 ? `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Recent Charges</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #374151;border-radius:8px;overflow:hidden;">
      <tr style="background:#1f2937;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Date</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Description</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Amount</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Status</th>
      </tr>
      ${rows}
    </table>` : ''}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Questions? Reply to this email or contact Patrick directly.</p>
  </td></tr>
  <tr><td style="padding:20px 0 0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#4b5563;">Think Big St. Louis BNI · ${MEETING}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

  return { subject, html }
}

/**
 * Weekly meeting reminder — short, friendly, sent to all members.
 */
export function buildMeetingReminderSms(opts: {
  speakerName?: string
  speakerCompany?: string
  date?: string
}): string {
  const { speakerName, speakerCompany, date } = opts
  const dateStr = date || 'This Thursday'
  const speakerLine = speakerName && speakerName !== 'Speaker Name'
    ? `\n🎤 Featured speaker: ${speakerName}${speakerCompany ? ` (${speakerCompany})` : ''}`
    : ''
  return [
    `📅 Think Big St. Louis — ${dateStr}`,
    `${MEETING}${speakerLine}`,
    '',
    'See you there! 💪',
  ].join('\n')
}

/**
 * Chapter announcement — flexible subject + message.
 */
export function buildAnnouncementSms(message: string): string {
  return `Think Big St. Louis:\n\n${message}\n\n${MEETING}`
}
