import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import { getSession } from '@/lib/auth'

/**
 * GET /api/visitors
 * Admin-only: returns all visitors ordered by created_at desc.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!session.is_admin) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
  }

  try {
    await connectDB()

    const visitors = await Visitor.find()
      .sort({ created_at: -1 })
      .limit(200)
      .lean()

    const result = visitors.map((v) => ({
      id: v._id.toString(),
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      phone: v.phone,
      company: v.company,
      business_type: v.business_type,
      referral_source: v.referral_source,
      invited_by: v.invited_by?.toString() ?? null,
      status: v.status,
      visit_date: v.visit_date?.toISOString() ?? null,
      notes: v.notes,
      created_at: v.created_at.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/visitors error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/visitors
 * Admin-only: manually add a visitor.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)

  if (!session?.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { first_name, last_name, email, phone, company, business_type, referral_source, status } = body

    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
    }

    await connectDB()

    const visitor = await Visitor.create({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email?.trim()?.toLowerCase() ?? '',
      phone: phone?.trim() ?? '',
      company: company?.trim() ?? '',
      business_type: business_type?.trim() ?? '',
      referral_source: referral_source?.trim() ?? 'admin_added',
      invited_by: session.id,
      status: status ?? 'invited',
      visit_date: null,
      notes: '',
    })

    return NextResponse.json({
      id: visitor._id.toString(),
      first_name: visitor.first_name,
      last_name: visitor.last_name,
      email: visitor.email,
      phone: visitor.phone,
      company: visitor.company,
      business_type: visitor.business_type,
      status: visitor.status,
      created_at: visitor.created_at.toISOString(),
    }, { status: 201 })
  } catch (err) {
    console.error('POST /api/visitors error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
