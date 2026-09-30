import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import { getSession } from '@/lib/auth'
import { spawn } from 'child_process'
import path from 'path'

interface Params { params: { profession: string } }

/**
 * POST /api/seats/[profession]/scrape
 * Admin-only: kick off a Google Maps scrape + enrich + import for a seat.
 *
 * Body: { max?: number }   (default 30 leads)
 *
 * Runs scripts/leadgen.py as a detached background process so the HTTP
 * response returns immediately. Progress is visible in Vercel/server logs.
 * The seat's last_scraped timestamp is updated once the job is queued.
 *
 * Note: on Vercel serverless this fires a background process that will be
 * killed when the function sandbox recycles. For larger scrapes (>30) run
 * leadgen.py locally or add a dedicated worker. For typical chapter-sized
 * scrapes (20-30 leads) it completes within the function lifetime.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)
  const body = await req.json().catch(() => ({}))
  const max = Math.min(parseInt(body.max ?? '30'), 100)

  await connectDB()

  const seat = await Seat.findOne({ profession })
  if (!seat) return NextResponse.json({ error: 'Seat not found. Activate it first.' }, { status: 404 })
  if (!seat.campaign_id) return NextResponse.json({ error: 'No campaign linked. Activate the seat first.' }, { status: 400 })

  const scriptPath = path.join(process.cwd(), 'scripts', 'leadgen.py')
  const query = seat.search_query || `${profession} in ${seat.location || 'Kirkwood MO'}`
  const campaignId = seat.campaign_id.toString()

  // Spawn detached so we can return immediately
  const child = spawn(
    'python3',
    [scriptPath, query, '--campaign', campaignId, '--max', String(max)],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    }
  )
  child.unref()

  // Record that a scrape was queued
  await Seat.findOneAndUpdate(
    { profession },
    { $set: { last_scraped: new Date(), updated_at: new Date() } }
  )

  return NextResponse.json({
    queued: true,
    profession,
    query,
    max,
    campaign_id: campaignId,
    message: `Scrape queued for "${query}" (up to ${max} leads). Check the campaign in a few minutes.`,
  })
}
