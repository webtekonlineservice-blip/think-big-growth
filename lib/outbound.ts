import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import EmailCampaign from '@/lib/models/EmailCampaign'
import ProspectEvent from '@/lib/models/ProspectEvent'
import Member from '@/lib/models/Member'
import { Resend } from 'resend'
import { isSeatFilledByMembers } from '@/lib/seatAliases'

// Lazily construct so a missing RESEND_API_KEY never throws at module load
// (which would break `next build` page-data collection). Key is only needed
// when actually sending.
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

export interface RunOutboundOptions {
  /** Scope the run to a single campaign by its id. Omit to run all active campaigns. */
  campaignId?: string
  /**
   * Only send to prospects whose `profession` matches this term (case-insensitive
   * substring match), regardless of which campaign they belong to.
   */
  profession?: string
  /** Total emails for this run across all campaigns (each campaign still honors its batch_size). */
  limit?: number
  /**
   * 'send'    → real sends, prospects advance (default; cron + buttons)
   * 'preview' → nothing is sent; returns who would get what
   * 'test'    → sends the first few planned emails to `testTo` only; prospects do NOT advance
   */
  mode?: 'send' | 'preview' | 'test'
  testTo?: string
}

export interface OutboundCampaignResult {
  campaign: string
  sent: number
  errors: number
  skipped?: string
}

export interface PlannedEmail {
  prospect_id: string
  name: string
  company: string
  email: string
  campaign: string
  step: number
  subject: string
}

export interface RunOutboundResult {
  results: OutboundCampaignResult[]
  ran_at: string
  mode: 'send' | 'preview' | 'test'
  planned: PlannedEmail[]
  sent: number
  errors: number
  /** Why prospects were left out of this batch, e.g. { bad_email: 82, duplicate: 4 } */
  excluded: Record<string, number>
}

// ─── Address hygiene ─────────────────────────────────────────────────────────
// Chamber directories often list the chamber's own inbox or the directory
// vendor's address instead of the business. Those must never be emailed.
const BLOCKED_DOMAINS = [
  'placeholder.local', 'thechamber.us', 'growthzone.com', 'chamberorganizer.com', 'chambermaster.com',
  'domain.com', 'example.com', 'example.org', 'companyname.com', 'email.com', 'yourdomain.com', 'test.com',
  'sentry.io', 'wixpress.com', 'godaddy.com', 'squarespace.com',
]
const BLOCKED_LOCAL = /^(unsubscribe|noreply|no-reply|donotreply|do-not-reply|user|example|test|email|name|your\.?email|abuse|postmaster|mailer-daemon)$/i

/** Returns a reason string if the address must not be emailed, or '' if it is fine. */
export function badEmailReason(raw: string | undefined | null): string {
  const email = (raw || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return 'invalid'
  const [local, domain] = email.split('@')
  if (BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'directory_or_placeholder'
  if (domain.includes('chamber')) return 'directory_or_placeholder'
  if (BLOCKED_LOCAL.test(local)) return 'role_or_fake'
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(email)) return 'invalid'
  return ''
}

const TEST_MAX = 3
const SEND_GAP_MS = 550 // stay under Resend's default 2 requests/second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Core outbound engine. Plans the next batch of drip emails across the
 * targeted campaign(s), then previews, test-sends, or sends them.
 *
 * Rules: active campaigns only; skip campaigns whose seat a member holds;
 * honor per-step delays and each campaign's batch_size; skip unsubscribed /
 * converted prospects, bad addresses, and any address that already received
 * (or is queued for) this sequence through another prospect record.
 */
export async function runOutbound(options: RunOutboundOptions = {}): Promise<RunOutboundResult> {
  const { campaignId, profession } = options
  const mode = options.mode ?? 'send'
  const limit = Math.max(1, Math.min(200, options.limit ?? 50))

  await connectDB()

  const members = await Member.find({ role: { $ne: '' } }).select('role').lean()
  const filledRoles = members.map((m) => (m.role || '').toLowerCase().trim()).filter(Boolean)

  const campaignQuery: Record<string, unknown> = { active: true }
  if (campaignId) campaignQuery._id = campaignId
  const campaigns = await EmailCampaign.find(campaignQuery).sort({ created_at: 1 }).lean()

  const professionRegex = profession
    ? new RegExp(profession.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : null

  const results: OutboundCampaignResult[] = []
  const excluded: Record<string, number> = {}
  const bump = (k: string, n = 1) => { excluded[k] = (excluded[k] || 0) + n }

  // Addresses that already got email 1 under any prospect record: never start them again.
  const alreadyContacted = new Set(
    (await Prospect.find({ sequence_step: { $gt: 0 } }).select('email').lean()).map((p) => (p.email || '').toLowerCase())
  )
  const queued = new Set<string>()
  const now = new Date()

  async function loadCandidates(c: (typeof campaigns)[number]) {
    const q: Record<string, unknown> = {
      campaign_id: c._id, unsubscribed: false,
      sequence_step: { $lt: c.sequence.length },
      status: { $nin: ['converted', 'unsubscribed'] },
    }
    if (professionRegex) q.profession = professionRegex
    return Prospect.find(q).sort({ ai_score: -1, created_at: 1 }).limit(200).lean()
  }
  type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number]
  type Campaign = (typeof campaigns)[number]
  type Job = { prospect: Candidate; campaign: Campaign; step: number; stepConfig: Campaign['sequence'][number] }
  const jobs: Job[] = []

  for (const campaign of campaigns) {
    if (jobs.length >= limit) break
    const campaignProfession = campaign.name.replace(/\s*(chamber\s*)?outreach\s*/i, '').trim()
    if (isSeatFilledByMembers(campaignProfession, filledRoles)) {
      results.push({ campaign: campaign.name, sent: 0, errors: 0, skipped: 'seat_filled' })
      continue
    }
    const candidates = await loadCandidates(campaign)
    let taken = 0
    for (const prospect of candidates) {
      if (taken >= campaign.batch_size || jobs.length >= limit) break
      const email = (prospect.email || '').toLowerCase()
      const reason = badEmailReason(email)
      if (reason) { bump('bad_email'); continue }
      if (queued.has(email) || (prospect.sequence_step === 0 && alreadyContacted.has(email))) { bump('duplicate'); continue }
      const step = prospect.sequence_step + 1
      const stepConfig = campaign.sequence.find((s) => s.step === step)
      if (!stepConfig) continue
      if (prospect.last_sent_at) {
        const days = Math.floor((now.getTime() - new Date(prospect.last_sent_at).getTime()) / 86400000)
        if (days < stepConfig.delay_days) { bump('waiting_for_delay'); continue }
      }
      queued.add(email)
      jobs.push({ prospect, campaign, step, stepConfig })
      taken++
    }
  }

  const planned: PlannedEmail[] = jobs.map((j) => ({
    prospect_id: j.prospect._id.toString(), name: j.prospect.name || '', company: j.prospect.company || '',
    email: j.prospect.email, campaign: j.campaign.name, step: j.step,
    subject: replacePlaceholders(j.stepConfig.subject, j.prospect),
  }))

  if (mode === 'preview') {
    return { results, ran_at: now.toISOString(), mode, planned, sent: 0, errors: 0, excluded }
  }

  const toRun = mode === 'test' ? jobs.slice(0, TEST_MAX) : jobs
  const perCampaign = new Map<string, OutboundCampaignResult>()
  let sent = 0
  let errors = 0

  for (let i = 0; i < toRun.length; i++) {
    const { prospect, campaign, step, stepConfig } = toRun[i]
    const subject = replacePlaceholders(stepConfig.subject, prospect)
    let body = replacePlaceholders(stepConfig.body, prospect)
    if (step === 1 && prospect.ai_first_line && prospect.ai_first_line.trim()) {
      body = `${prospect.ai_first_line.trim()}\n\n${body}`
    }
    const ctaUrl = stepConfig.cta_url
      ? `${APP_URL}/api/track/click/${prospect._id}?url=${encodeURIComponent(stepConfig.cta_url.replace('[invite_code]', campaign.invite_code))}`
      : `${APP_URL}/api/track/click/${prospect._id}?url=${encodeURIComponent(`${APP_URL}/invite/${campaign.invite_code}`)}`
    const ctaText = stepConfig.cta_text || 'Visit Think Big St. Louis →'
    // Test sends must not register opens against the real prospect.
    const trackingPixel = mode === 'test' ? '' : `<img src="${APP_URL}/api/track/open/${prospect._id}" width="1" height="1" alt="" style="display:none;" />`
    const unsubLink = `${APP_URL}/api/unsubscribe/${prospect.unsubscribe_token}`
    const imageUrl = stepConfig.image_url
      ? (stepConfig.image_url.startsWith('http')
          ? stepConfig.image_url
          : `${APP_URL}${stepConfig.image_url.startsWith('/') ? '' : '/'}${stepConfig.image_url}`)
      : ''
    const html = buildEmail(body, ctaText, ctaUrl, unsubLink, trackingPixel, imageUrl)

    const r = perCampaign.get(campaign.name) ?? { campaign: campaign.name, sent: 0, errors: 0 }
    perCampaign.set(campaign.name, r)
    try {
      if (mode === 'test') {
        await getResend().emails.send({
          from: FROM, to: options.testTo || 'webtekdigitalai@gmail.com',
          subject: `[TEST → ${prospect.email}] ${subject}`, html,
        })
      } else {
        await getResend().emails.send({ from: FROM, to: prospect.email, subject, html })
        await Prospect.findByIdAndUpdate(prospect._id, {
          $set: { sequence_step: step, last_sent_at: new Date(), status: `sequence_${step}` },
        })
        await ProspectEvent.create({ prospect_id: prospect._id, campaign_id: campaign._id, type: 'sent', step })
        await EmailCampaign.findByIdAndUpdate(campaign._id, { $inc: { total_sent: 1 } })
      }
      r.sent++; sent++
    } catch (err) {
      console.error(`Outbound send failed for ${prospect.email}:`, err)
      r.errors++; errors++
    }
    if (i < toRun.length - 1) await sleep(SEND_GAP_MS)
  }

  perCampaign.forEach((r) => results.push(r))
  return { results, ran_at: now.toISOString(), mode, planned, sent, errors, excluded }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function replacePlaceholders(text: string, prospect: { name?: string; company?: string; profession?: string }): string {
  return text
    .replace(/\[name\]/gi, prospect.name || 'there')
    .replace(/\[company\]/gi, prospect.company || 'your business')
    .replace(/\[profession\]/gi, prospect.profession || 'your profession')
}

function buildEmail(body: string, ctaText: string, ctaUrl: string, unsubLink: string, pixel: string, imageUrl = ''): string {
  const heroImage = imageUrl
    ? `  <tr><td style="background:#111827;padding:0;">
    <a href="${ctaUrl}" style="display:block;">
      <img src="${imageUrl}" alt="Event details" width="580" style="display:block;width:100%;max-width:580px;height:auto;border:0;" />
    </a>
  </td></tr>`
    : ''

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
${heroImage}
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
