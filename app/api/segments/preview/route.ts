import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import Member from '@/lib/models/Member'
import Prospect from '@/lib/models/Prospect'
import OutreachLog from '@/lib/models/OutreachLog'
import ProspectEvent from '@/lib/models/ProspectEvent'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/segments/preview
 * Admin-only: evaluate a segment definition and return count + contact preview.
 *
 * Body: { segment: SegmentDef }
 *
 * SegmentDef:
 *   { audience: 'visitors', rules: VisitorRule[] }
 *   { audience: 'members', rules: MemberRule[] }
 *   { audience: 'prospects', rules: ProspectRule[], campaign_id?: string }
 *
 * Rules are ANDed together (all must match).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { segment } = await req.json()
    if (!segment?.audience) return NextResponse.json({ error: 'segment.audience is required.' }, { status: 400 })

    await connectDB()

    const now = new Date()
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)

    // ── Visitor segments ──────────────────────────────────────────────────
    if (segment.audience === 'visitors') {
      const filter: Record<string, unknown> = {}
      const rules: string[] = []

      for (const rule of (segment.rules ?? [])) {
        switch (rule.field) {
          case 'status':
            if (rule.value === 'not_member') {
              filter.status = { $in: ['invited', 'visited', 'applied'] }
              rules.push('Status is not member')
            } else {
              filter.status = rule.value
              rules.push(`Status is ${rule.value}`)
            }
            break
          case 'days_since_visit_gte':
            filter.visit_date = { ...((filter.visit_date as object) ?? {}), $lt: daysAgo(Number(rule.value)), $ne: null }
            rules.push(`Visited ${rule.value}+ days ago`)
            break
          case 'days_since_visit_lte':
            filter.visit_date = { ...((filter.visit_date as object) ?? {}), $gte: daysAgo(Number(rule.value)) }
            rules.push(`Visited within last ${rule.value} days`)
            break
          case 'has_visit_date':
            filter.visit_date = rule.value === 'yes' ? { $ne: null } : null
            rules.push(rule.value === 'yes' ? 'Has visit date' : 'No visit date yet')
            break
          case 'days_since_created_gte':
            filter.created_at = { ...((filter.created_at as object) ?? {}), $lt: daysAgo(Number(rule.value)) }
            rules.push(`Registered ${rule.value}+ days ago`)
            break
          case 'has_phone':
            filter.phone = rule.value === 'yes' ? { $ne: '' } : ''
            rules.push(rule.value === 'yes' ? 'Has phone number' : 'No phone number')
            break
          case 'has_email':
            filter.email = rule.value === 'yes' ? { $ne: '' } : ''
            rules.push(rule.value === 'yes' ? 'Has email' : 'No email')
            break
          case 'not_contacted_in_days': {
            // Visitors who have NOT received any message in the last N days
            const cutoff = daysAgo(Number(rule.value))
            const recentlyContacted = await OutreachLog
              .distinct('visitor_id', { sent_at: { $gte: cutoff }, status: 'sent' })
            filter._id = { $nin: recentlyContacted }
            rules.push(`Not contacted in last ${rule.value} days`)
            break
          }
        }
      }

      const visitors = await Visitor.find(filter).select('first_name last_name email phone company status visit_date').limit(50).lean()
      const total = await Visitor.countDocuments(filter)

      return NextResponse.json({
        audience: 'visitors',
        total,
        rules,
        contacts: visitors.map((v) => ({
          id: v._id.toString(),
          name: `${v.first_name} ${v.last_name}`,
          email: v.email,
          phone: v.phone,
          company: v.company,
          status: v.status,
          visit_date: v.visit_date?.toISOString() ?? null,
        })),
      })
    }

    // ── Member segments ───────────────────────────────────────────────────
    if (segment.audience === 'members') {
      const filter: Record<string, unknown> = { is_admin: false }
      const rules: string[] = ['Active members (non-admin)']

      for (const rule of (segment.rules ?? [])) {
        switch (rule.field) {
          case 'has_phone':
            filter.phone = rule.value === 'yes' ? { $ne: '' } : ''
            rules.push(rule.value === 'yes' ? 'Has phone number' : 'No phone number')
            break
          case 'has_email':
            // Exclude placeholder emails
            filter.email = rule.value === 'yes'
              ? { $not: /@member\.thinkbig$/ }
              : { $regex: /@member\.thinkbig$/ }
            rules.push(rule.value === 'yes' ? 'Has real email' : 'Placeholder email only')
            break
          case 'role_contains':
            filter.role = { $regex: rule.value, $options: 'i' }
            rules.push(`Role contains "${rule.value}"`)
            break
        }
      }

      const members = await Member.find(filter).select('name email phone company role').limit(50).lean()
      const total = await Member.countDocuments(filter)

      return NextResponse.json({
        audience: 'members',
        total,
        rules,
        contacts: members.map((m) => ({
          id: m._id.toString(),
          name: m.name,
          email: m.email,
          phone: m.phone,
          company: m.company,
          role: m.role,
        })),
      })
    }

    // ── Prospect segments ─────────────────────────────────────────────────
    if (segment.audience === 'prospects') {
      const filter: Record<string, unknown> = {
        unsubscribed: false,
        email: { $not: /placeholder\.local$/ },
      }
      const rules: string[] = ['Active prospects (not unsubscribed, has real email)']

      if (segment.campaign_id) {
        filter.campaign_id = segment.campaign_id
        rules.push(`In campaign`)
      }

      for (const rule of (segment.rules ?? [])) {
        switch (rule.field) {
          case 'sequence_step_gte':
            filter.sequence_step = { ...((filter.sequence_step as object) ?? {}), $gte: Number(rule.value) }
            rules.push(`Email step ≥ ${rule.value}`)
            break
          case 'sequence_step_eq':
            filter.sequence_step = Number(rule.value)
            rules.push(`On email step ${rule.value}`)
            break
          case 'opened_any':
            filter.opened_count = rule.value === 'yes' ? { $gt: 0 } : 0
            rules.push(rule.value === 'yes' ? 'Opened at least one email' : 'Never opened')
            break
          case 'clicked_any':
            filter.clicked_count = rule.value === 'yes' ? { $gt: 0 } : 0
            rules.push(rule.value === 'yes' ? 'Clicked at least once' : 'Never clicked')
            break
          case 'status':
            filter.status = rule.value
            rules.push(`Status is ${rule.value}`)
            break
          case 'opened_step1_not_clicked': {
            // Opened step 1 but never clicked — high-intent, needs a nudge
            if (rule.value === 'yes') {
              const openers = await ProspectEvent.distinct('prospect_id',
                { ...(segment.campaign_id ? { campaign_id: segment.campaign_id } : {}), type: 'open', step: 1 })
              const clickers = await ProspectEvent.distinct('prospect_id',
                { ...(segment.campaign_id ? { campaign_id: segment.campaign_id } : {}), type: 'click' })
              const clickSet = new Set(clickers.map(String))
              const targetIds = openers.filter((id) => !clickSet.has(String(id)))
              filter._id = { $in: targetIds }
              rules.push('Opened step 1 email but never clicked (high intent)')
            }
            break
          }
        }
      }

      const prospects = await Prospect.find(filter).select('name email company profession sequence_step opened_count clicked_count').limit(50).lean()
      const total = await Prospect.countDocuments(filter)

      return NextResponse.json({
        audience: 'prospects',
        total,
        rules,
        contacts: prospects.map((p) => ({
          id: p._id.toString(),
          name: p.name || p.company,
          email: p.email,
          company: p.company,
          profession: p.profession,
          sequence_step: p.sequence_step,
          opened_count: p.opened_count,
          clicked_count: p.clicked_count,
        })),
      })
    }

    return NextResponse.json({ error: 'Unknown audience.' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/segments/preview error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
