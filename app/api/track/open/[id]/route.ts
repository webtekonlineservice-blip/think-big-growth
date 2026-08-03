import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import ProspectEvent from '@/lib/models/ProspectEvent'
import EmailCampaign from '@/lib/models/EmailCampaign'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

interface Params { params: { id: string } }

/**
 * GET /api/track/open/[prospectId]
 * Logs an open event and returns a 1x1 transparent pixel.
 */
export async function GET(req: NextRequest, { params }: Params) {
  // Always return the pixel immediately — tracking is best-effort
  const pixelResponse = new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })

  try {
    await connectDB()

    const prospect = await Prospect.findById(params.id).lean()
    if (!prospect || prospect.unsubscribed) return pixelResponse

    // Log event
    await ProspectEvent.create({
      prospect_id: prospect._id,
      campaign_id: prospect.campaign_id!,
      type: 'open',
      step: prospect.sequence_step,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '',
      user_agent: req.headers.get('user-agent') ?? '',
    })

    // Increment counts
    await Prospect.findByIdAndUpdate(params.id, { $inc: { opened_count: 1 } })
    if (prospect.campaign_id) {
      await EmailCampaign.findByIdAndUpdate(prospect.campaign_id, { $inc: { total_opened: 1 } })
    }
  } catch (err) {
    console.error('Track open error:', err)
  }

  return pixelResponse
}
