import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'

/**
 * GET /api/categories
 * Public: returns taken BNI roles and a list of open categories.
 * Used on the home page to show which seats are available.
 */

// Full BNI category list for reference
const ALL_CATEGORIES = [
  'Accountant / CPA',
  'Attorney / Lawyer',
  'Auto Sales',
  'Banker',
  'Business Coach',
  'Chiropractor',
  'Contractor / Builder',
  'Dentist',
  'Digital Marketing',
  'Event Planner',
  'Financial Advisor',
  'Florist',
  'Health & Wellness',
  'Home Inspector',
  'HR Consultant',
  'Insurance Agent',
  'Interior Designer',
  'IT / Tech Consultant',
  'Landscaper',
  'Life Coach',
  'Marketing Consultant',
  'Mortgage Broker',
  'Nutritionist',
  'Photographer',
  'Physical Therapist',
  'Printer / Promotional',
  'Property Manager',
  'Realtor',
  'Recruiter',
  'Solar / Energy',
  'Tax Consultant',
  'Travel Agent',
  'Videographer',
  'Web Designer / Developer',
]

export async function GET() {
  try {
    await connectDB()

    const members = await Member.find().select('name role company').lean()

    const takenRoles = members
      .filter((m) => m.role)
      .map((m) => ({ name: m.name, role: m.role, company: m.company }))

    const takenRoleNames = takenRoles.map((r) => r.role.toLowerCase())

    const openCategories = ALL_CATEGORIES.filter(
      (cat) => !takenRoleNames.some((taken) =>
        cat.toLowerCase().includes(taken) || taken.includes(cat.toLowerCase())
      )
    )

    return NextResponse.json(
      { takenRoles, openCategories },
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      }
    )
  } catch (err) {
    console.error('GET /api/categories error:', err)
    // Return gracefully so home page still renders
    return NextResponse.json({ takenRoles: [], openCategories: [] })
  }
}
