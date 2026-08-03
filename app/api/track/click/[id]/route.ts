import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import ProspectEvent from '@/lib/models/ProspectEvent'
import EmailCampaign from '@/lib/models/EmailCampaign'

interface Params { params: { id: string } }

/**
 * GET /api/track/click/[prospectId]?url=<destination>
 * Logs a click event and redirects to the destination URL.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const destination = req.nextUrl.searchParams.get('url') ?? '/'

  try {
    await connectDB()

    const prospect = await Prospect.findById(params.id).lean()
    if (prospect && !prospect.unsubscribed) {
      await ProspectEvent.create({
        prospect_id: prospect._id,
        campaign_id: prospect.campaign_id!,
        type: 'click',
        step: prospect.sequence_step,
        url: destination,
        ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '',
        user_agent: req.headers.get('user-agent') ?? '',
      })

      await Prospect.findByIdAndUpdate(params.id, { $inc: { clicked_count: 1 } })
      if (prospect.campaign_id) {
        await EmailCampaign.findByIdAndUpdate(prospect.campaign_id, { $inc: { total_clicked: 1 } })
      }
    }
  } catch (err) {
    console.error('Track click error:', err)
  }

  return NextResponse.redirect(destination, 302)
}
