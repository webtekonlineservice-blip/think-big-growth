import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import Member from '@/lib/models/Member'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { getSession } from '@/lib/auth'
import { isSeatFilledByMembers, professionMatchesSeat } from '@/lib/seatAliases'

/**
 * Canonical 34-seat list for Think Big St. Louis.
 * Exported so other routes can reference the same source of truth.
 */
const ALL_SEATS = [
  'Accountant / CPA',
  'Attorney / Lawyer',
  'Auto Sales',
  'Banker',
  'Business Coach',
  'Chiropractor',
  'Contractor / Builder',
  'Dentist',
  'Digital Marketing',
  'Event Planner',
  'Financial Advisor',
  'Florist',
  'Health & Wellness',
  'Home Inspector',
  'HR Consultant',
  'Insurance Agent',
  'Interior Designer',
  'IT / Tech Consultant',
  'Landscaper',
  'Life Coach',
  'Marketing Consultant',
  'Mortgage Broker',
  'Nutritionist',
  'Photographer',
  'Physical Therapist',
  'Printer / Promotional',
  'Property Manager',
  'Realtor',
  'Recruiter',
  'Solar / Energy',
  'Tax Consultant',
  'Travel Agent',
  'Videographer',
  'Web Designer / Developer',
]

export interface SeatView {
  profession: string
  status: 'filled' | 'active' | 'paused' | 'open'
  outreach_status: 'open' | 'active' | 'paused'
  campaign_id: string | null
  campaign_name: string | null
  campaign_active: boolean
  prospects_count: number
  total_sent: number
  total_opened: number
  search_query: string
  location: string
  last_scraped: string | null
  member_name: string | null
  member_company: string | null
}

/**
 * GET /api/seats
 * Admin-only: all 34 seats with live status derived from Members +
 * Seat records + EmailCampaigns. Auto-creates missing Seat docs on first call.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  await connectDB()

  const [members, seats, campaigns] = await Promise.all([
    Member.find({ role: { $ne: '' } }).select('name role company').lean(),
    Seat.find().lean(),
    EmailCampaign.find().select('name active total_sent total_opened total_prospects').lean(),
  ])

  const seatByProfession = new Map(seats.map((s) => [s.profession.toLowerCase(), s]))
  const campaignById = new Map(campaigns.map((c) => [c._id.toString(), c]))
  const filledRoles = members.map((m) => (m.role || '').toLowerCase().trim()).filter(Boolean)

  // Build member info lookup for the filled-by display
  const memberByRole = new Map<string, { name: string; company: string }>()
  for (const m of members) {
    if (m.role) memberByRole.set(m.role.toLowerCase().trim(), { name: m.name, company: m.company })
  }

  const getFilledBy = (profession: string) => {
    for (const [role, info] of Array.from(memberByRole)) {
      if (professionMatchesSeat(profession, role)) return info
    }
    return null
  }

  // Auto-create missing Seat docs
  const toCreate = ALL_SEATS.filter((p) => !seatByProfession.has(p.toLowerCase()))
  if (toCreate.length > 0) {
    try {
      const created = await Seat.insertMany(
        toCreate.map((p) => ({ profession: p, search_query: `${p} in Kirkwood MO`, location: 'Kirkwood MO' })),
        { ordered: false }
      )
      for (const s of created) seatByProfession.set((s as typeof seats[0]).profession.toLowerCase(), s as typeof seats[0])
    } catch { /* ignore duplicate key races */ }
  }

  const result: SeatView[] = ALL_SEATS.map((profession) => {
    const seat = seatByProfession.get(profession.toLowerCase())
    const filled = isSeatFilledByMembers(profession, filledRoles)
    const filledBy = filled ? getFilledBy(profession) : null
    const campaign = seat?.campaign_id ? campaignById.get(seat.campaign_id.toString()) ?? null : null

    let status: SeatView['status']
    if (filled) {
      status = 'filled'
    } else if (campaign?.active) {
      status = 'active'
    } else if (seat?.campaign_id && !campaign?.active) {
      status = 'paused'
    } else {
      status = 'open'
    }

    return {
      profession,
      status,
      outreach_status: seat?.outreach_status ?? 'open',
      campaign_id: seat?.campaign_id?.toString() ?? null,
      campaign_name: campaign?.name ?? null,
      campaign_active: campaign?.active ?? false,
      prospects_count: campaign?.total_prospects ?? seat?.prospects_count ?? 0,
      total_sent: campaign?.total_sent ?? 0,
      total_opened: campaign?.total_opened ?? 0,
      search_query: seat?.search_query ?? `${profession} in Kirkwood MO`,
      location: seat?.location ?? 'Kirkwood MO',
      last_scraped: seat?.last_scraped ? new Date(seat.last_scraped).toISOString() : null,
      member_name: filledBy?.name ?? null,
      member_company: filledBy?.company ?? null,
    }
  })

  return NextResponse.json(result)
}
