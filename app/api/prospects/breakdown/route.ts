import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import { getSession } from '@/lib/auth'

/**
 * GET /api/prospects/breakdown
 * Admin-only: aggregated view of collected prospect data.
 * Returns counts by profession, by source, and email coverage.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()

    const [byProfession, bySource, total, withEmail] = await Promise.all([
      Prospect.aggregate([
        { $group: { _id: '$profession', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      Prospect.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Prospect.countDocuments(),
      Prospect.countDocuments({
        email: { $exists: true, $ne: '', $not: { $regex: 'placeholder.local' } },
      }),
    ])

    return NextResponse.json({
      total,
      withEmail,
      emailCoverage: total > 0 ? Math.round((withEmail / total) * 100) : 0,
      byProfession: byProfession.map((p) => ({ name: p._id || 'Uncategorized', count: p.count })),
      bySource: bySource.map((s) => ({ name: s._id || 'unknown', count: s.count })),
    })
  } catch (err) {
    console.error('GET /api/prospects/breakdown error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
