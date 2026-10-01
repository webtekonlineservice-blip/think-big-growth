import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import Member from '@/lib/models/Member'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { buildProfessionSequence } from '@/lib/emailSequences'
import { getSession } from '@/lib/auth'

type Params = { params: { profession: string } }

/**
 * PATCH /api/seats/[profession]
 * Admin-only: activate or deactivate outreach for a seat.
 *
 * Body: { active: boolean, location?: string, batch_size?: number }
 *
 * activate (active: true):
 *   1. Reject if a member already holds this role (seat is filled)
 *   2. Create a campaign if one doesn't exist yet
 *   3. Flip campaign active=true and seat outreach_status=active
 *
 * deactivate (active: false):
 *   1. Flip campaign active=false and seat outreach_status=paused
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
  if (active) {
    const members = await Member.find({ role: { $ne: '' } }).select('role name').lean()
    const p = profession.toLowerCase()
    const holder = members.find((m) => {
      const r = (m.role || '').toLowerCase().trim()
      return p.includes(r) || r.includes(p) || p.split(' ')[0] === r.split(' ')[0]
    })
    if (holder) {
      return NextResponse.json(
        { error: `This seat is already filled by ${holder.name}.` },
        { status: 409 }
      )
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
    // Create campaign if none exists
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
      // Re-activate existing campaign
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, {
        $set: { active: true, ...(batch_size ? { batch_size } : {}) },
      })
    }
    seat.outreach_status = 'active'
  } else {
    // Deactivate
    if (seat.campaign_id) {
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, { $set: { active: false } })
    }
    seat.outreach_status = 'paused'
  }

  seat.updated_at = new Date()
  await seat.save()

  return NextResponse.json({
    profession,
    outreach_status: seat.outreach_status,
    campaign_id: seat.campaign_id?.toString() ?? null,
  })
}
