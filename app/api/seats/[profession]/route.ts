import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import Member from '@/lib/models/Member'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { getSession } from '@/lib/auth'
import { buildProfessionSequence } from '@/lib/emailSequences'
import { isSeatFilledByMembers } from '@/lib/seatAliases'

type Params = { params: { profession: string } }

/**
 * PATCH /api/seats/[profession]
 * Admin-only: activate or deactivate outreach for a seat.
 *
 * Body: { active: boolean, location?: string, batch_size?: number }
 *
 * activate (active: true):
 *   1. Guard: reject if a member already holds this seat.
 *   2. If no campaign exists → create one with buildProfessionSequence.
 *   3. If campaign exists but is paused → flip it active.
 *   4. Update Seat.outreach_status = 'active'.
 *
 * deactivate (active: false):
 *   1. Flip campaign active = false.
 *   2. Update Seat.outreach_status = 'paused'.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  const body = await req.json() as { active: boolean; location?: string; batch_size?: number }

  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: '`active` boolean is required.' }, { status: 400 })
  }

  await connectDB()

  // Load or create the Seat doc
  let seat = await Seat.findOne({ profession })
  if (!seat) {
    seat = await Seat.create({
      profession,
      search_query: `${profession} in ${body.location ?? 'Kirkwood MO'}`,
      location: body.location ?? 'Kirkwood MO',
    })
  }

  if (body.active) {
    // Guard: refuse to activate if a member already holds this seat
    const members = await Member.find({ role: { $ne: '' } }).select('role').lean()
    const filledRoles = members.map((m) => (m.role || '').toLowerCase().trim()).filter(Boolean)
    if (isSeatFilledByMembers(profession, filledRoles)) {
      return NextResponse.json({ error: `The ${profession} seat is already filled by a member.` }, { status: 409 })
    }

    let campaign = seat.campaign_id
      ? await EmailCampaign.findById(seat.campaign_id)
      : null

    if (!campaign) {
      // Create a new profession-sequence campaign
      const inviteCode = session.invite_code ?? 'patrick'
      const sequence = buildProfessionSequence(profession, inviteCode)
      campaign = await EmailCampaign.create({
        name: `${profession} Outreach`,
        description: `Auto-generated outreach for ${profession}`,
        invite_code: inviteCode,
        sequence,
        batch_size: body.batch_size ?? 25,
      })
    } else {
      // Re-activate existing campaign
      campaign.active = true
      if (body.batch_size) campaign.batch_size = body.batch_size
      await campaign.save()
    }

    seat.campaign_id = campaign._id
    seat.outreach_status = 'active'
    if (body.location) {
      seat.location = body.location
      seat.search_query = `${profession} in ${body.location}`
    }
    seat.updated_at = new Date()
    await seat.save()

    return NextResponse.json({
      success: true,
      profession,
      status: 'active',
      campaign_id: campaign._id.toString(),
      campaign_name: campaign.name,
    })
  } else {
    // Deactivate
    if (seat.campaign_id) {
      await EmailCampaign.findByIdAndUpdate(seat.campaign_id, { $set: { active: false } })
    }
    seat.outreach_status = 'paused'
    seat.updated_at = new Date()
    await seat.save()

    return NextResponse.json({ success: true, profession, status: 'paused' })
  }
}
