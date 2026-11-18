import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import { getSession } from '@/lib/auth'
import { ALL_SEATS } from '@/lib/chapterSeats'
import { isSeatFilledByMembers } from '@/lib/seatAliases'

// Reads the session from request headers/cookies, so it cannot be statically rendered.
export const dynamic = 'force-dynamic'

/**
 * GET /api/categories
 *
 * Public: returns the list of OPEN BNI categories (profession names only).
 * This is safe to expose — it's the same info shown on the public home page.
 *
 * The full member roster (names + companies) is PII and is only included
 * when the request carries a valid admin session. Unauthenticated callers
 * never receive member names/companies.
 */


export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const members = await Member.find().select('name role company').lean()

    const takenRoleNames = members
      .filter((m) => m.role)
      .map((m) => m.role.toLowerCase())

    const openCategories = ALL_SEATS.filter((cat) => !isSeatFilledByMembers(cat, takenRoleNames))

    // Only admins get the member roster detail (PII). Everyone else gets
    // open categories only.
    const session = getSession(req)
    const takenRoles = session?.is_admin
      ? members.filter((m) => m.role).map((m) => ({ name: m.name, role: m.role, company: m.company }))
      : []

    return NextResponse.json(
      { takenRoles, openCategories },
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      }
    )
  } catch (err) {
    console.error('GET /api/categories error:', err)
    // Return gracefully so the home page still renders
    return NextResponse.json({ takenRoles: [], openCategories: [] })
  }
}
