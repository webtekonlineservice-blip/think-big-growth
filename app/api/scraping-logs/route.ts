import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import ScrapingLog from '@/lib/models/ScrapingLog'
import Seat from '@/lib/models/Seat'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/scraping-logs
 * Admin-only: returns recent scraping runs, newest first.
 * Query: ?limit=50&profession=Chiropractor
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50'))
    const profession = req.nextUrl.searchParams.get('profession')

    const filter: Record<string, unknown> = {}
    if (profession) filter.profession = profession

    const logs = await ScrapingLog.find(filter).sort({ ran_at: -1 }).limit(limit).lean()
    return NextResponse.json(logs.map((l) => ({
      id: l._id.toString(),
      profession: l.profession,
      search_query: l.search_query,
      location: l.location,
      found: l.found,
      imported: l.imported,
      skipped: l.skipped,
      enriched: l.enriched,
      source: l.source,
      triggered_by: l.triggered_by,
      ran_at: l.ran_at,
    })))
  } catch (err) {
    console.error('GET /api/scraping-logs error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/scraping-logs
 * Admin-only (or script via admin credentials): record a completed scraping run.
 * Also updates the seat's last_scraped date and prospects_count.
 *
 * Body: { profession, search_query, location, found, imported, skipped, enriched, source, triggered_by }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    const { profession, search_query, location, found = 0, imported = 0, skipped = 0, enriched = 0, source = 'manual', triggered_by } = body
    if (!profession) return NextResponse.json({ error: 'profession is required.' }, { status: 400 })

    await connectDB()
    const log = await ScrapingLog.create({
      profession, search_query: search_query || `${profession} in ${location || 'Kirkwood MO'}`,
      location: location || 'Kirkwood MO',
      found, imported, skipped, enriched, source,
      triggered_by: triggered_by || session.name || session.email,
      ran_at: new Date(),
    })

    // Update seat with latest scrape info
    if (imported > 0) {
      await Seat.updateOne(
        { profession },
        { $set: { last_scraped: new Date() }, $inc: { prospects_count: imported } },
        { upsert: false }
      )
    } else {
      await Seat.updateOne({ profession }, { $set: { last_scraped: new Date() } }, { upsert: false })
    }

    return NextResponse.json({ id: log._id.toString(), ok: true }, { status: 201 })
  } catch (err) {
    console.error('POST /api/scraping-logs error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
