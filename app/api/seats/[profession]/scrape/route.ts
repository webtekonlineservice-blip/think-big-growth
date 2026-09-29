import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Seat from '@/lib/models/Seat'
import { getSession } from '@/lib/auth'
import { spawn } from 'child_process'
import path from 'path'

type Params = { params: { profession: string } }

/**
 * POST /api/seats/[profession]/scrape
 * Admin-only: trigger the leadgen.py pipeline for this seat in the background.
 *
 * Spawns scripts/leadgen.py with the seat's search_query and campaign_id.
 * Returns immediately — scraping runs async and results flow into the campaign.
 *
 * Body (all optional):
 *   { max?: number, no_enrich?: boolean }
 *
 * NOTE: This works locally. On Vercel (serverless), child_process.spawn is
 * available but the function has a 5-min max runtime — fine for small batches
 * (max ≤ 20). For larger scrapes, run leadgen.py directly from your terminal.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const profession = decodeURIComponent(params.profession)

  await connectDB()

  const seat = await Seat.findOne({ profession }).lean()
  if (!seat) return NextResponse.json({ error: 'Seat not found.' }, { status: 404 })
  if (!seat.campaign_id) {
    return NextResponse.json({ error: 'Activate the seat first to create a campaign.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as { max?: number; no_enrich?: boolean }
  const max = Math.min(body.max ?? 20, 50) // cap at 50 for Vercel safety
  const campaignId = seat.campaign_id.toString()
  const searchQuery = seat.search_query || `${profession} in ${seat.location ?? 'Kirkwood MO'}`

  const scriptPath = path.join(process.cwd(), 'scripts', 'leadgen.py')
  const args = [scriptPath, searchQuery, '--campaign', campaignId, '--max', String(max)]
  if (body.no_enrich) args.push('--no-enrich')

  // Spawn detached so the response returns immediately
  const child = spawn('python3', args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  })
  child.unref()

  // Mark last_scraped
  await Seat.findOneAndUpdate(
    { profession },
    { $set: { last_scraped: new Date(), updated_at: new Date() } }
  )

  return NextResponse.json({
    success: true,
    profession,
    campaign_id: campaignId,
    search_query: searchQuery,
    max,
    note: 'Scrape started in background. Prospects will appear in the campaign as they are found and enriched.',
  })
}
