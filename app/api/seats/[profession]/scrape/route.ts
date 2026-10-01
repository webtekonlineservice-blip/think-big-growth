import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import { getSession } from '@/lib/auth'
import { spawn } from 'child_process'
import path from 'path'

type Params = { params: { profession: string } }

/**
 * POST /api/seats/[profession]/scrape
 * Admin-only: trigger the leadgen pipeline for this seat.
 *
 * Runs scripts/leadgen.py as a background child process so the request
 * returns immediately — scraping happens async. Progress can be monitored
 * via the prospects count on the seat/campaign.
 *
 * Body (all optional): { max?: number, no_enrich?: boolean }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  const body = await req.json().catch(() => ({}))
  const max: number = body.max ?? 30
  const noEnrich: boolean = body.no_enrich ?? false

  await connectDB()

  const seat = await Seat.findOne({ profession })
  if (!seat) {
    return NextResponse.json({ error: 'Seat not found. Activate it first.' }, { status: 404 })
  }
  if (!seat.campaign_id) {
    return NextResponse.json({ error: 'No campaign linked. Activate the seat first.' }, { status: 400 })
  }

  const query = seat.search_query || `${profession} in ${seat.location}`
  const campaignId = seat.campaign_id.toString()
  const scriptPath = path.join(process.cwd(), 'scripts', 'leadgen.py')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thinkbig.webtek.ai'

  // Build args
  const args = [
    scriptPath,
    query,
    '--campaign', campaignId,
    '--max', String(max),
  ]
  if (noEnrich) args.push('--no-enrich')

  // Spawn detached so it runs after the response is sent
  const child = spawn('python3', args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: appUrl,
    },
  })
  child.unref()

  // Mark the seat as having a scrape in progress
  await Seat.findOneAndUpdate(
    { profession },
    { $set: { updated_at: new Date() } }
  )

  return NextResponse.json({
    started: true,
    query,
    campaign_id: campaignId,
    max,
    message: `Scraping "${query}" in the background. Check prospect counts in a few minutes.`,
  })
}
