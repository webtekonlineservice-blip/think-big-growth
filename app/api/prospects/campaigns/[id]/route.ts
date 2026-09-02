import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import EmailCampaign from '@/lib/models/EmailCampaign'
import Prospect from '@/lib/models/Prospect'
import { getSession } from '@/lib/auth'

interface Params { params: { id: string } }

/**
 * PATCH /api/prospects/campaigns/[id]
 * Admin-only: update campaign settings (batch_size, active status).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.batch_size === 'number') updates.batch_size = Math.max(1, Math.min(200, body.batch_size))
    if (typeof body.active === 'boolean') updates.active = body.active
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
    }

    await connectDB()
    const campaign = await EmailCampaign.findByIdAndUpdate(params.id, { $set: updates }, { new: true }).lean()
    if (!campaign) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

    return NextResponse.json({ success: true, batch_size: campaign.batch_size, active: campaign.active })
  } catch (err) {
    console.error('PATCH campaign error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/prospects/campaigns/[id]
 * Admin-only: delete a campaign and optionally its prospects.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const campaign = await EmailCampaign.findByIdAndDelete(params.id)
    if (!campaign) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    // Also remove its prospects
    await Prospect.deleteMany({ campaign_id: params.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE campaign error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
