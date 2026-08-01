import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'

/**
 * GET /api/analytics
 * Admin-only: returns aggregated chapter growth stats.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    await connectDB()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // ── Totals ────────────────────────────────────────────────────────────────
    const [totalVisitors, totalMembers] = await Promise.all([
      Visitor.countDocuments(),
      Member.countDocuments(),
    ])

    const statusCounts = await Visitor.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const byStatus: Record<string, number> = {
      invited: 0, visited: 0, applied: 0, member: 0,
    }
    for (const s of statusCounts) byStatus[s._id] = s.count

    const conversionRate = totalVisitors > 0
      ? Math.round((byStatus.member / totalVisitors) * 100)
      : 0

    // ── This month vs last month ──────────────────────────────────────────────
    const [thisMonthVisitors, lastMonthVisitors] = await Promise.all([
      Visitor.countDocuments({ created_at: { $gte: startOfMonth } }),
      Visitor.countDocuments({ created_at: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    ])

    // ── Monthly trend (last 6 months) ─────────────────────────────────────────
    const monthlyTrend = await Visitor.aggregate([
      { $match: { created_at: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$created_at' },
            month: { $month: '$created_at' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ])

    const months = monthlyTrend.map((m) => ({
      label: new Date(m._id.year, m._id.month - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      count: m.count,
    }))

    // ── Top inviters ──────────────────────────────────────────────────────────
    const topInviters = await Visitor.aggregate([
      { $match: { invited_by: { $ne: null } } },
      { $group: { _id: '$invited_by', total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'member'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ])

    // Enrich with member names
    const memberIds = topInviters.map((t) => t._id)
    const members = await Member.find({ _id: { $in: memberIds } }).select('name company').lean()
    const memberMap = new Map(members.map((m) => [m._id.toString(), m]))

    const inviters = topInviters.map((t) => {
      const m = memberMap.get(t._id.toString())
      return {
        id: t._id.toString(),
        name: m?.name ?? 'Unknown',
        company: m?.company ?? '',
        total: t.total,
        converted: t.converted,
      }
    })

    // ── Pipeline funnel ───────────────────────────────────────────────────────
    const funnel = [
      { stage: 'Invited', count: byStatus.invited + byStatus.visited + byStatus.applied + byStatus.member },
      { stage: 'Visited', count: byStatus.visited + byStatus.applied + byStatus.member },
      { stage: 'Applied', count: byStatus.applied + byStatus.member },
      { stage: 'Member', count: byStatus.member },
    ]

    return NextResponse.json({
      totals: {
        visitors: totalVisitors,
        members: totalMembers,
        conversionRate,
        thisMonthVisitors,
        lastMonthVisitors,
      },
      byStatus,
      funnel,
      monthlyTrend: months,
      topInviters: inviters,
    })
  } catch (err) {
    console.error('GET /api/analytics error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
