import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { CHAMBERS } from '@/lib/chambers'
import ScrapingLog from '@/lib/models/ScrapingLog'
import Prospect from '@/lib/models/Prospect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lead-engine/chambers
 * Admin-only. Returns all configured chambers with their last-run stats
 * and total prospects imported from each.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()

    // For each chamber, grab its last scraping run and prospect count
    const chamberData = await Promise.all(
      CHAMBERS.map(async (c) => {
        const lastRun = await ScrapingLog.findOne({
          search_query: { $regex: c.name, $options: 'i' },
        })
          .sort({ ran_at: -1 })
          .lean()

        const prospectCount = await Prospect.countDocuments({
          source: 'chamber_directory',
          profession: { $regex: '', $options: 'i' }, // all
          // tie to chamber via a chamber_id field we'll add, or search_query fallback
        })

        return {
          ...c,
          lastRun: lastRun
            ? {
                ran_at: lastRun.ran_at,
                found: lastRun.found,
                imported: lastRun.imported,
                enriched: lastRun.enriched,
              }
            : null,
          totalProspects: prospectCount,
        }
      })
    )

    // Also get overall lead engine stats
    const [totalFromChambers, hotLeads] = await Promise.all([
      Prospect.countDocuments({ source: 'chamber_directory' }),
      Prospect.countDocuments({ source: 'chamber_directory', ai_score: { $gte: 8 } }),
    ])

    return NextResponse.json({
      chambers: chamberData,
      stats: { totalFromChambers, hotLeads },
    })
  } catch (err) {
    console.error('GET /api/lead-engine/chambers error:', err)
    return NextResponse.json({ error: 'Failed to load chambers.' }, { status: 500 })
  }
}
