import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import Member from '@/lib/models/Member'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { buildProfessionSequence } from '@/lib/emailSequences'
import { getSession } from '@/lib/auth'

interface Params { params: { profession: string } }

/**
 * PATCH /api/seats/[profession]
 * Admin-only: activate or deactivate outreach for a seat.
 *
 * Body: { active: boolean, location?: string, batch_size?: number }
 *
 * activate=true:
 *   1. Reject if a Member already holds this role (seat is filled).
 *   2. If no campaign exists → create one via buildProfessionSequence.
 *   3. Flip campaign active=true + seat outreach_status=active.
 *
 * active=false:
 *   1. Flip campaign active=false + seat outreach_status=paused.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  const body = await req.json()
  const { active, location, batch_size } = body as {
    active: boolean
    location?: string
    batch_size?: number
  }

  await connectDB()

  // Check if seat is already filled by a member
  const members = await Member.find({ role: { $ne: '' } }).select('role name').lean()
  const prof = profession.toLowerCase()
  const holder = members.find((m) => {
    const r = (m.role || '').toLowerCase().trim()
    return prof.includes(r) || r.includes(prof) || prof.split(' ')[0] === r.split(' ')[0]
  })
  if (holder && active) {
    return NextResponse.json(
      { error: `This seat is already filled by ${holder.name}.` },
      { status: 409 }
    )
  }

  // Find or create the Seat doc
  let seat = await Seat.findOne({ profession })
  if (!seat) {
    seat = await Seat.create({
      profession,
      search_query: `${profession} in ${location ?? 'Kirkwood MO'}`,
      location: location ?? 'Kirkwood MO',
    })
  } else if (location) {
    seat.location = location
    seat.search_query = `${profession} in ${location}`
  }

  if (active) {
    // --- ACTIVATE ---
    // Enforce max active seats cap (default 5) to keep sends focused
    const MAX_ACTIVE = 5
    const activeSeats = await Seat.countDocuments({ outreach_status: 'active' })
    // Don't count the current seat if it's already active (reactivation)
    const currentSeat = await Seat.findOne({ profession })
    const alreadyActive = currentSeat?.outreach_status === 'active'
    if (!alreadyActive && activeSeats >= MAX_ACTIVE) {
      return NextResponse.json(
        { error: `You already have ${activeSeats} active seats (max ${MAX_ACTIVE}). Pause one before activating another.` },
        { status: 409 }
      )
    }

    let campaign

    if (seat.campaign_id) {
      // Reuse existing campaign
      campaign = await EmailCampaign.findByIdAndUpdate(
        seat.campaign_id,
        { $set: { active: true } },
        { new: true }
      )
    }

    if (!campaign) {
      // Create a new profession-sequence campaign
      campaign = await EmailCampaign.create({
        name: `${profession} Outreach`,
        description: `Auto-generated outreach for ${profession}`,
        invite_code: session.invite_code ?? 'patrick',
        sequence: buildProfessionSequence(profession, session.invite_code ?? 'patrick'),
        batch_size: batch_size ?? 25,
        active: true,
      })
    }

    seat.campaign_id = campaign._id
    seat.outreach_status = 'active'
    if (location) {
      seat.location = location
      seat.search_query = `${profession} in ${location}`
    }
    seat.updated_at = new Date()
    await seat.save()

    return NextResponse.json({
      profession,
      status: 'active',
      campaign_id: campaign._id.toString(),
      campaign_name: campaign.name,
      message: `Outreach activated for ${profession}. Import leads or run a scrape to start sending.`,
    })
  } else {
    // --- DEACTIVATE ---
    if (seat.campaign_id) {
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, { $set: { active: false } })
    }
    seat.outreach_status = 'paused'
    seat.updated_at = new Date()
    await seat.save()

    return NextResponse.json({ profession, status: 'paused' })
  }
}

/**
 * GET /api/seats/[profession]
 * Admin-only: get a single seat's current state.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  await connectDB()

  const seat = await Seat.findOne({ profession }).lean()
  if (!seat) return NextResponse.json({ error: 'Seat not found.' }, { status: 404 })

  const campaign = seat.campaign_id
    ? await EmailCampaign.findById(seat.campaign_id).lean()
    : null

  return NextResponse.json({
    profession: seat.profession,
    outreach_status: seat.outreach_status,
    campaign_id: seat.campaign_id?.toString() ?? null,
    campaign_active: campaign?.active ?? false,
    prospects_count: campaign?.total_prospects ?? seat.prospects_count,
    total_sent: campaign?.total_sent ?? 0,
    search_query: seat.search_query,
    location: seat.location,
    last_scraped: seat.last_scraped?.toISOString() ?? null,
  })
}
