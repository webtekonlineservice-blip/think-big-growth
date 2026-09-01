import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { getSession } from '@/lib/auth'
import { buildProfessionSequence } from '@/lib/emailSequences'
import { buildStackDaySequence } from '@/lib/stackDaySequence'

/**
 * GET /api/prospects/campaigns
 * Admin-only: list all outbound email campaigns.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const campaigns = await EmailCampaign.find().sort({ created_at: -1 }).lean()

    return NextResponse.json(campaigns.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description,
      invite_code: c.invite_code,
      sequence_count: c.sequence.length,
      batch_size: c.batch_size,
      active: c.active,
      total_prospects: c.total_prospects,
      total_sent: c.total_sent,
      total_opened: c.total_opened,
      total_clicked: c.total_clicked,
      total_unsubscribed: c.total_unsubscribed,
      created_at: c.created_at.toISOString(),
    })))
  } catch (err) {
    console.error('GET /api/prospects/campaigns error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/prospects/campaigns
 * Admin-only: create a new outbound email campaign with drip sequence.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    let { name, sequence } = body
    const { description, invite_code, batch_size, profession } = body

    const { template } = body

    // Special event template — Real Estate Stack Day
    if (template === 'stack_day' && !sequence) {
      name = name || 'Real Estate Stack Day — Sept 10'
      sequence = buildStackDaySequence(invite_code || session.invite_code || 'patrick')
    }
    // One-click mode: generate a full campaign from just a profession name
    else if (profession && !sequence) {
      name = name || `${profession} Outreach`
      sequence = buildProfessionSequence(profession, invite_code || session.invite_code || 'patrick')
    }

    if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required.' }, { status: 400 })
    if (!sequence?.length) return NextResponse.json({ error: 'At least one sequence step is required.' }, { status: 400 })

    await connectDB()

    const campaign = await EmailCampaign.create({
      name: name.trim(),
      description: description?.trim() ?? (profession ? `Auto-generated outreach for ${profession}` : ''),
      invite_code: invite_code?.trim() ?? session.invite_code ?? 'patrick',
      sequence,
      batch_size: batch_size ?? 10,
    })

    return NextResponse.json({
      id: campaign._id.toString(),
      name: campaign.name,
      sequence_count: campaign.sequence.length,
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/prospects/campaigns error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
