import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import Member from '@/lib/models/Member'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { buildProfessionSequence } from '@/lib/emailSequences'
import { getSession } from '@/lib/auth'
import { isSeatFilledByMembers } from '@/lib/seatAliases'

type Params = { params: { profession: string } }

/**
 * Maximum number of seats that can run outreach simultaneously.
 * Keeps deliverability healthy and prevents accidental blasting.
 * Can be overridden per-request with { force: true } for admins who
 * explicitly want to exceed the cap.
 */
const MAX_ACTIVE_SEATS = 5

/**
 * PATCH /api/seats/[profession]
 * Admin-only: activate or deactivate outreach for a seat.
 *
 * Body: { active: boolean, location?: string, batch_size?: number, force?: boolean }
 *
 * activate (active: true):
 *   1. Reject if a member already holds this role (seat is filled)
 *   2. Reject if MAX_ACTIVE_SEATS cap would be exceeded (unless force: true)
 *   3. Create a campaign if one doesn't exist yet
 *   4. Flip campaign active=true and seat outreach_status=active
 *
 * deactivate (active: false):
 *   1. Flip campaign active=false and seat outreach_status=paused
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  const body = await req.json()
  const { active, location, batch_size, force } = body as {
    active: boolean
    location?: string
    batch_size?: number
    force?: boolean
  }

  await connectDB()

  if (active) {
    // 1. Reject if seat is already filled by a member
    const members = await Member.find({ role: { $ne: '' } }).select('role name').lean()
    const filledRoles = members.map((m) => (m.role || '').toLowerCase().trim()).filter(Boolean)
    if (isSeatFilledByMembers(profession, filledRoles)) {
      const holder = members.find((m) => isSeatFilledByMembers(profession, [(m.role || '').toLowerCase().trim()]))
      return NextResponse.json(
        { error: `This seat is already filled by ${holder?.name ?? 'a member'}.` },
        { status: 409 }
      )
    }

    // 2. Enforce active seat cap
    if (!force) {
      const activeCount = await Seat.countDocuments({ outreach_status: 'active' })
      if (activeCount >= MAX_ACTIVE_SEATS) {
        return NextResponse.json(
          {
            error: `You already have ${activeCount} active seats (max ${MAX_ACTIVE_SEATS}). Pause one first, or pass force: true to override.`,
            active_count: activeCount,
            max: MAX_ACTIVE_SEATS,
          },
          { status: 429 }
        )
      }
    }
  }

  // Find or create the Seat doc
  let seat = await Seat.findOne({ profession })
  if (!seat) {
    seat = await Seat.create({
      profession,
      outreach_status: 'open',
      search_query: `${profession} in ${location ?? 'Kirkwood MO'}`,
      location: location ?? 'Kirkwood MO',
    })
  } else if (location) {
    seat.search_query = `${profession} in ${location}`
    seat.location = location
  }

  if (active) {
    if (!seat.campaign_id) {
      const inviteCode = session.invite_code ?? 'patrick'
      const sequence = buildProfessionSequence(profession, inviteCode)
      const campaign = await EmailCampaign.create({
        name: `${profession} Outreach`,
        description: `Auto-generated outreach for ${profession}`,
        invite_code: inviteCode,
        sequence,
        batch_size: batch_size ?? 25,
        active: true,
      })
      seat.campaign_id = campaign._id
    } else {
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, {
        $set: { active: true, ...(batch_size ? { batch_size } : {}) },
      })
    }
    seat.outreach_status = 'active'
  } else {
    if (seat.campaign_id) {
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, { $set: { active: false } })
    }
    seat.outreach_status = 'paused'
  }

  seat.updated_at = new Date()
  await seat.save()

  // Return current active count alongside the result so the UI can update
  const activeCount = await Seat.countDocuments({ outreach_status: 'active' })

  return NextResponse.json({
    profession,
    outreach_status: seat.outreach_status,
    campaign_id: seat.campaign_id?.toString() ?? null,
    active_count: activeCount,
    slots_available: Math.max(0, MAX_ACTIVE_SEATS - activeCount),
  })
}
