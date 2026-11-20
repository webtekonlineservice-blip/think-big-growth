import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Visitor from '@/lib/models/Visitor'
import { getSession } from '@/lib/auth'
import mongoose from 'mongoose'

/**
 * GET /api/members/visitors?uid=<memberId>
 * Returns all visitors invited by the given member.
 * Members can only see their own visitors; admins can see any.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const uid = req.nextUrl.searchParams.get('uid')

  if (uid && !session.is_admin && session.id !== uid) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (uid && !mongoose.isValidObjectId(uid)) {
    return NextResponse.json({ error: 'Invalid member id.' }, { status: 400 })
  }
  if (!uid && !session.is_admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    await connectDB()

    const visitors = uid
      ? await Visitor.find({ invited_by: uid }).sort({ created_at: -1 }).lean()
      : await Visitor.find({ status: 'visited' }).sort({ created_at: -1 }).lean()

    const result = visitors.map((v) => ({
      id: v._id.toString(),
      first_name: v.first_name,
      last_name: v.last_name,
      company: v.company,
      business_type: v.business_type,
      status: v.status,
      business_profile: v.business_profile ?? null,
      created_at: v.created_at.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/members/visitors error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
