import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CHAMBERS, scrapeChamber, enrichEmails, scoreMembers } from '@/lib/chambers'
import Prospect from '@/lib/models/Prospect'
import ScrapingLog from '@/lib/models/ScrapingLog'
import EmailCampaign from '@/lib/models/EmailCampaign'
import Member from '@/lib/models/Member'
import { sendSms } from '@/lib/twilio'
import { Resend } from 'resend'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — chamber scraping takes time

/**
 * POST /api/lead-engine/scrape
 * Admin-only. Scrape a chamber directory, AI-score, enrich emails, import to campaigns.
 * Sends SMS + email notification to admin when hot leads (score ≥ 8) are found.
 *
 * Body: {
 *   chamberId: string                    // one of the CHAMBERS ids
 *   minScore?: number                    // default 5
 *   notifyPhone?: string                 // admin phone for SMS alert
 *   notifyEmail?: string                 // admin email for summary
 *   maxPages?: number                    // limit A-Z pages (default 26)
 * }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { chamberId, minScore = 5, notifyPhone, notifyEmail, maxPages = 26 } = body

  const chamber = CHAMBERS.find((c) => c.id === chamberId)
  if (!chamber) {
    return NextResponse.json({ error: `Chamber "${chamberId}" not found.` }, { status: 400 })
  }

  try {
    await connectDB()

    // Get open BNI seats from members collection
    const members = await Member.find({ role: { $ne: '' } }).select('role').lean()
    const takenRoles = members.map((m) => (m.role || '').toLowerCase())
    const allProfessions = [
      'Accountant / CPA', 'Attorney / Lawyer', 'Banker', 'Business Coach',
      'Chiropractor', 'Contractor / Builder', 'Dentist', 'Digital Marketing',
      'Event Planner', 'Financial Advisor', 'Health & Wellness', 'Home Inspector',
      'Insurance Agent', 'IT / Tech Consultant', 'Landscaper', 'Marketing Consultant',
      'Mortgage Broker', 'Photographer', 'Physical Therapist', 'Property Manager',
      'Realtor', 'Recruiter', 'Tax Consultant', 'Web Designer / Developer',
    ]
    const openSeats = allProfessions.filter(
      (p) => !takenRoles.some((t) => p.toLowerCase().includes(t) || t.includes(p.toLowerCase()))
    )

    // ── Step 1: Scrape ────────────────────────────────────────────────────────
    const rawMembers = await scrapeChamber(chamber, { maxPages })
    if (!rawMembers.length) {
      return NextResponse.json({ error: 'No members found — chamber may have blocked the request.' }, { status: 422 })
    }

    // ── Step 2: AI Score ──────────────────────────────────────────────────────
    const scoredWithEmail = rawMembers.map((m) => ({ ...m, email: '', ai_score: 5, ai_profession: '', ai_reason: '' }))
    const scored = await scoreMembers(rawMembers as Parameters<typeof scoreMembers>[0], openSeats)

    // Filter by minimum score
    const shortlisted = scored.filter((m) => m.ai_score >= minScore)

    // ── Step 3: Enrich emails (only shortlisted) ──────────────────────────────
    const membersWithWebsite = shortlisted.filter((m) => m.website)
    const enriched = await enrichEmails(membersWithWebsite)
    const enrichedMap = new Map(enriched.map((m) => [m.name.toLowerCase(), m.email]))

    // Merge emails back
    const readyLeads = shortlisted.map((m) => ({
      ...m,
      email: enrichedMap.get(m.name.toLowerCase()) || '',
    }))

    const withEmail = readyLeads.filter((m) => m.email)
    const hotLeads = readyLeads.filter((m) => m.ai_score >= 8)
    const hotWithEmail = hotLeads.filter((m) => m.email)

    // ── Step 4: Import to campaigns ───────────────────────────────────────────
    const campaignCache = new Map<string, string>()
    let totalImported = 0
    let totalSkipped = 0

    const importable = withEmail.length > 0 ? withEmail : readyLeads.filter((m) => m.phone)

    for (const lead of importable) {
      const prof = lead.ai_profession || 'General'

      // Get or create campaign for this profession
      if (!campaignCache.has(prof)) {
        const existing = await EmailCampaign.findOne({
          name: { $regex: prof, $options: 'i' },
          active: true,
        }).lean()
        if (existing) {
          campaignCache.set(prof, existing._id.toString())
        } else {
          // Create a new campaign for this profession
          const { buildProfessionSequence } = await import('@/lib/emailSequences')
          const seq = buildProfessionSequence(prof, session.invite_code || 'patrick')
          const newCampaign = await EmailCampaign.create({
            name: `${prof} Chamber Outreach`,
            description: `Auto-created from ${chamber.name} scrape`,
            sequence: seq,
            batch_size: 10,
            active: true,
            invite_code: session.invite_code || '',
          })
          campaignCache.set(prof, newCampaign._id.toString())
        }
      }

      const campaignId = campaignCache.get(prof)!
      const token = crypto.randomBytes(24).toString('hex')

      try {
        await Prospect.create({
          name: lead.name,
          email: lead.email || `noemail_${token.slice(0, 8)}@placeholder.local`,
          company: lead.name,
          profession: lead.ai_profession || 'Unknown',
          phone: lead.phone,
          website: lead.website,
          source: 'chamber_directory',
          campaign_id: campaignId,
          unsubscribe_token: token,
          ai_score: lead.ai_score,
          ai_first_line: `I came across ${lead.name} through the ${chamber.area} chamber of commerce and wanted to reach out personally.`,
        })
        totalImported++
        await EmailCampaign.findByIdAndUpdate(campaignId, { $inc: { total_prospects: 1 } })
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) totalSkipped++
        else totalSkipped++
      }
    }

    // ── Step 5: Log the run ────────────────────────────────────────────────────
    await ScrapingLog.create({
      profession: 'Chamber members (all professions)',
      search_query: `${chamber.name} — A to Z directory`,
      location: chamber.area,
      found: rawMembers.length,
      imported: totalImported,
      skipped: totalSkipped,
      enriched: withEmail.length,
      source: 'api_trigger',
      triggered_by: session.email,
    })

    // ── Step 6: Notifications ─────────────────────────────────────────────────
    const notifySent: string[] = []

    if (hotWithEmail.length > 0) {
      const topList = hotWithEmail
        .slice(0, 5)
        .map((m) => `• ${m.name} (${m.ai_profession || 'unknown'}) — score ${m.ai_score}/10`)
        .join('\n')

      // SMS notification
      const smsTo = notifyPhone || process.env.TWILIO_PHONE_NUMBER
      if (notifyPhone) {
        try {
          await sendSms(
            notifyPhone,
            `🔥 Think Big Lead Engine: ${hotWithEmail.length} hot leads found from ${chamber.name}!\n\nTop picks:\n${topList}\n\nView at ${process.env.NEXT_PUBLIC_APP_URL}/admin/lead-engine`
          )
          notifySent.push(`SMS → ${notifyPhone}`)
        } catch (e) {
          console.error('Lead engine SMS notification failed:', e)
        }
      }

      // Email notification
      if (notifyEmail) {
        try {
          const resendKey = process.env.RESEND_API_KEY
          if (resendKey) {
            const resend = new Resend(resendKey)
            const rows = hotWithEmail.slice(0, 10).map((m) =>
              `<tr style="border-bottom:1px solid #374151;">
                <td style="padding:10px;color:#f9fafb;font-weight:600;">${m.name}</td>
                <td style="padding:10px;color:#60a5fa;">${m.ai_profession || '—'}</td>
                <td style="padding:10px;"><span style="background:${m.ai_score >= 9 ? '#065f46' : '#1e3a5f'};color:${m.ai_score >= 9 ? '#34d399' : '#93c5fd'};padding:3px 8px;border-radius:12px;font-size:12px;font-weight:700;">${m.ai_score}/10</span></td>
                <td style="padding:10px;color:#9ca3af;font-size:12px;">${m.ai_reason}</td>
                <td style="padding:10px;color:#6b7280;font-size:12px;">${m.email || m.phone || '—'}</td>
              </tr>`
            ).join('')

            await resend.emails.send({
              from: 'Think Big St. Louis <noreply@webtek.ai>',
              to: notifyEmail,
              subject: `🔥 ${hotWithEmail.length} hot BNI leads from ${chamber.name}`,
              html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:-apple-system,sans-serif;color:#f9fafb;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
<tr><td align="center">
<table width="650" cellpadding="0" cellspacing="0" style="max-width:650px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#1e3a8a,#1e40af);border-radius:12px 12px 0 0;padding:24px 32px;">
    <h1 style="margin:0;font-size:22px;color:#fff;">🔥 ${hotWithEmail.length} Hot Leads Found</h1>
    <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${chamber.name} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  </td></tr>
  <tr><td style="background:#111827;padding:24px 32px;">
    <p style="color:#d1d5db;font-size:14px;margin:0 0 20px;">
      The Lead Engine scraped <strong style="color:#fff;">${rawMembers.length} members</strong> from the ${chamber.name} directory,
      scored them against your open BNI seats, and found <strong style="color:#34d399;">${hotWithEmail.length} hot leads</strong> (score 8+) with email addresses ready to contact.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #374151;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#1f2937;">
        <th style="padding:10px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;">Business</th>
        <th style="padding:10px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;">Profession</th>
        <th style="padding:10px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;">Score</th>
        <th style="padding:10px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;">Why</th>
        <th style="padding:10px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;">Contact</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/lead-engine" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View Lead Engine →
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:20px;text-align:center;">
      Total scraped: ${rawMembers.length} · Shortlisted: ${shortlisted.length} · Imported: ${totalImported} · Skipped (dupes): ${totalSkipped}
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
            })
            notifySent.push(`Email → ${notifyEmail}`)
          }
        } catch (e) {
          console.error('Lead engine email notification failed:', e)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      chamber: chamber.name,
      found: rawMembers.length,
      shortlisted: shortlisted.length,
      withEmail: withEmail.length,
      hotLeads: hotLeads.length,
      hotWithEmail: hotWithEmail.length,
      imported: totalImported,
      skipped: totalSkipped,
      notifications: notifySent,
      topLeads: hotWithEmail.slice(0, 10).map((m) => ({
        name: m.name,
        profession: m.ai_profession,
        score: m.ai_score,
        reason: m.ai_reason,
        email: m.email,
        phone: m.phone,
        city: m.city,
      })),
    })
  } catch (err) {
    console.error('POST /api/lead-engine/scrape error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Scrape failed.',
    }, { status: 500 })
  }
}
