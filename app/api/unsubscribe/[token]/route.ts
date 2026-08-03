import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import ProspectEvent from '@/lib/models/ProspectEvent'
import EmailCampaign from '@/lib/models/EmailCampaign'

interface Params { params: { token: string } }

/**
 * GET /api/unsubscribe/[token]
 * Processes one-click unsubscribe and returns a confirmation page.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()

    const prospect = await Prospect.findOne({ unsubscribe_token: params.token })

    if (!prospect) {
      return new NextResponse(renderPage('Not Found', 'This unsubscribe link is invalid or has already been processed.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (!prospect.unsubscribed) {
      prospect.unsubscribed = true
      prospect.status = 'unsubscribed'
      await prospect.save()

      await ProspectEvent.create({
        prospect_id: prospect._id,
        campaign_id: prospect.campaign_id!,
        type: 'unsubscribe',
        step: prospect.sequence_step,
      })

      if (prospect.campaign_id) {
        await EmailCampaign.findByIdAndUpdate(prospect.campaign_id, { $inc: { total_unsubscribed: 1 } })
      }
    }

    return new NextResponse(
      renderPage('Unsubscribed', "You've been removed from our mailing list. You won't receive further emails from us."),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    )
  } catch (err) {
    console.error('Unsubscribe error:', err)
    return new NextResponse(renderPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Think Big St. Louis</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0f1e; font-family:system-ui,sans-serif; color:#f1f5f9; }
    .box { text-align:center; max-width:400px; padding:40px; }
    h1 { font-size:24px; margin:0 0 12px; }
    p { color:#94a3b8; font-size:15px; line-height:1.6; margin:0; }
    a { color:#4F46E5; text-decoration:none; display:inline-block; margin-top:24px; font-size:14px; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://thinkbig.webtek.ai">← Visit Think Big St. Louis</a>
  </div>
</body>
</html>`
}
