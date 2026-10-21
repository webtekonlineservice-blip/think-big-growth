import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ScrapingLog from '@/lib/models/ScrapingLog'
import Prospect from '@/lib/models/Prospect'

export const dynamic = 'force-dynamic'

/**
 * GET /api/lead-engine/runs
 * Admin-only. Returns recent chamber scraping runs + pipeline stats.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()

    const [runs, pipelineStats] = await Promise.all([
      ScrapingLog.find({ source: 'api_trigger' })
        .sort({ ran_at: -1 })
        .limit(20)
        .lean(),
      Prospect.aggregate([
        { $match: { source: 'chamber_directory' } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withEmail: { $sum: { $cond: [{ $and: [{ $ne: ['$email', ''] }, { $not: { $regexMatch: { input: '$email', regex: 'placeholder' } } }] }, 1, 0] } },
            hot: { $sum: { $cond: [{ $gte: ['$ai_score', 8] }, 1, 0] } },
            contacted: { $sum: { $cond: [{ $gt: ['$sequence_step', 0] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
            avgScore: { $avg: '$ai_score' },
          },
        },
      ]),
    ])

    const stats = pipelineStats[0] || {
      total: 0, withEmail: 0, hot: 0, contacted: 0, converted: 0, avgScore: 0,
    }

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r._id.toString(),
        source: r.search_query,
        location: r.location,
        found: r.found,
        imported: r.imported,
        enriched: r.enriched,
        skipped: r.skipped,
        ran_at: r.ran_at,
      })),
      pipeline: {
        total: stats.total,
        withEmail: stats.withEmail,
        hot: stats.hot,
        contacted: stats.contacted,
        converted: stats.converted,
        avgScore: Math.round((stats.avgScore || 0) * 10) / 10,
      },
    })
  } catch (err) {
    console.error('GET /api/lead-engine/runs error:', err)
    return NextResponse.json({ error: 'Failed to load runs.' }, { status: 500 })
  }
}
