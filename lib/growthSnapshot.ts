/**
 * Growth Advisor — Context Builder.
 *
 * Assembles a deterministic "chapter snapshot" from live data. No AI here.
 * This is the agent's eyes: every number is real and verifiable, so the
 * reasoner can only recommend actions grounded in actual chapter state.
 *
 * The snapshot is intentionally compact and JSON-serializable so it can be
 * fed straight into the DeepSeek reasoner and also rendered as a dashboard
 * widget on its own.
 */

import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import Visitor from '@/lib/models/Visitor'
import Prospect from '@/lib/models/Prospect'
import Seat from '@/lib/models/Seat'
import ScrapingLog from '@/lib/models/ScrapingLog'
import OutreachLog from '@/lib/models/OutreachLog'

const DAY = 24 * 60 * 60 * 1000
const CHAPTER_NAME = 'Think Big St. Louis'
const MEETING_LINE = "Thursdays 11:30 AM at Mike Duffy's Pub & Grill, Kirkwood"

export interface StaleVisitor {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  daysSince: number
}

export interface OpenSeat {
  profession: string
  prospectsReady: number   // prospects in this profession never contacted
}

export interface GrowthSnapshot {
  chapterName: string
  meetingLine: string
  generatedAt: string

  members: {
    total: number
  }

  visitors: {
    total: number
    invited: number           // registered, not yet visited
    visited: number           // visited, not yet applied
    applied: number
    becameMembers: number
    newThisMonth: number
    staleNoFollowup: StaleVisitor[]   // visited 3+ days ago, no follow-up logged
  }

  seats: {
    openProfessions: string[]         // seats with no matching member
    withReadyProspects: OpenSeat[]    // open seats that already have uncontacted prospects
  }

  prospects: {
    total: number
    neverContacted: number
    inSequence: number
    converted: number
  }

  momentum: {
    lastScrapeAt: string | null
    daysSinceLastScrape: number | null
    outreachLast7Days: number
    scrapesLast30Days: number
  }

  /** Plain-English flags the reasoner can lean on. */
  signals: string[]
}

/** Lowercased role names of current members, for open-seat derivation. */
function takenRoleSet(members: { role?: string }[]): string[] {
  return members
    .map((m) => (m.role || '').toLowerCase().trim())
    .filter(Boolean)
}

/** A seat is "open" if no member's role matches the profession (loose match). */
function isSeatOpen(profession: string, takenRoles: string[]): boolean {
  const p = profession.toLowerCase()
  return !takenRoles.some((taken) => p.includes(taken) || taken.includes(p))
}

export async function buildGrowthSnapshot(): Promise<GrowthSnapshot> {
  await connectDB()
  const now = Date.now()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [members, visitors, seats, prospectsAgg, lastScrape, scrapes30, outreach7] =
    await Promise.all([
      Member.find().select('role').lean(),
      Visitor.find().select('first_name last_name email phone company status visit_date created_at').lean(),
      Seat.find().select('profession prospects_count').lean(),
      Prospect.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            neverContacted: { $sum: { $cond: [{ $eq: ['$sequence_step', 0] }, 1, 0] } },
            inSequence: { $sum: { $cond: [{ $gt: ['$sequence_step', 0] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
          },
        },
      ]),
      ScrapingLog.findOne().sort({ ran_at: -1 }).select('ran_at').lean(),
      ScrapingLog.countDocuments({ ran_at: { $gte: new Date(now - 30 * DAY) } }),
      OutreachLog.countDocuments({ sent_at: { $gte: new Date(now - 7 * DAY) } }),
    ])

  // ── Visitors ──────────────────────────────────────────────────────────────
  const byStatus = { invited: 0, visited: 0, applied: 0, member: 0 }
  let newThisMonth = 0
  const stale: StaleVisitor[] = []

  for (const v of visitors) {
    const status = (v.status || 'invited') as keyof typeof byStatus
    if (status in byStatus) byStatus[status]++
    const created = v.created_at ? new Date(v.created_at) : null
    if (created && created >= monthStart) newThisMonth++

    // Stale: visited but not advanced, 3+ days since visit, still worth a nudge.
    if (status === 'visited') {
      const ref = v.visit_date ? new Date(v.visit_date).getTime() : (created ? created.getTime() : now)
      const daysSince = Math.floor((now - ref) / DAY)
      if (daysSince >= 3) {
        stale.push({
          id: String(v._id),
          name: `${v.first_name} ${v.last_name}`.trim(),
          email: v.email || '',
          phone: v.phone || '',
          company: v.company || '',
          status,
          daysSince,
        })
      }
    }
  }
  stale.sort((a, b) => b.daysSince - a.daysSince)

  // ── Seats ─────────────────────────────────────────────────────────────────
  const takenRoles = takenRoleSet(members)
  const openProfessions = seats
    .filter((s) => isSeatOpen(s.profession, takenRoles))
    .map((s) => s.profession)

  // Prospects available per open seat, keyed by profession (loose contains match).
  const openSeatProspects: OpenSeat[] = []
  for (const prof of openProfessions) {
    const ready = await Prospect.countDocuments({
      sequence_step: 0,
      unsubscribed: false,
      profession: { $regex: prof.split('/')[0].trim(), $options: 'i' },
    })
    if (ready > 0) openSeatProspects.push({ profession: prof, prospectsReady: ready })
  }
  openSeatProspects.sort((a, b) => b.prospectsReady - a.prospectsReady)

  // ── Prospects ───────────────────────────────────────────────────────────────
  const pa = prospectsAgg[0] || { total: 0, neverContacted: 0, inSequence: 0, converted: 0 }

  // ── Momentum ──────────────────────────────────────────────────────────────
  const lastScrapeAt = lastScrape?.ran_at ? new Date(lastScrape.ran_at) : null
  const daysSinceLastScrape = lastScrapeAt
    ? Math.floor((now - lastScrapeAt.getTime()) / DAY)
    : null

  // ── Signals (plain-English hints for the reasoner) ──────────────────────────
  const signals: string[] = []
  if (stale.length) signals.push(`${stale.length} visitor(s) visited but never got a follow-up.`)
  if (byStatus.invited > 0) signals.push(`${byStatus.invited} visitor(s) registered but have not visited yet.`)
  if (openProfessions.length) signals.push(`${openProfessions.length} seat(s) are open and recruitable.`)
  if (pa.neverContacted > 0) signals.push(`${pa.neverContacted} scraped prospect(s) have never been contacted.`)
  if (daysSinceLastScrape !== null && daysSinceLastScrape > 14) signals.push(`No new prospects scraped in ${daysSinceLastScrape} days — pipeline is going cold.`)
  if (daysSinceLastScrape === null) signals.push('No scraping has run yet — the prospect pipeline is empty.')
  if (outreach7 === 0) signals.push('No outreach was sent in the last 7 days.')
  if (newThisMonth === 0) signals.push('No new visitors registered this month.')

  return {
    chapterName: CHAPTER_NAME,
    meetingLine: MEETING_LINE,
    generatedAt: new Date().toISOString(),
    members: { total: members.length },
    visitors: {
      total: visitors.length,
      invited: byStatus.invited,
      visited: byStatus.visited,
      applied: byStatus.applied,
      becameMembers: byStatus.member,
      newThisMonth,
      staleNoFollowup: stale,
    },
    seats: {
      openProfessions,
      withReadyProspects: openSeatProspects,
    },
    prospects: {
      total: pa.total,
      neverContacted: pa.neverContacted,
      inSequence: pa.inSequence,
      converted: pa.converted,
    },
    momentum: {
      lastScrapeAt: lastScrapeAt ? lastScrapeAt.toISOString() : null,
      daysSinceLastScrape,
      outreachLast7Days: outreach7,
      scrapesLast30Days: scrapes30,
    },
    signals,
  }
}
