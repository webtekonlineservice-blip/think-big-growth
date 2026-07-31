import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebaseAdmin'

/**
 * GET /api/visitors
 * Admin-only: returns all visitors ordered by created_at desc.
 * Requires Authorization: Bearer <adminIdToken>
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const auth = getAdminAuth()
    const decoded = await auth.verifyIdToken(token)

    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 })
    }

    const db = getAdminFirestore()
    const snapshot = await db
      .collection('visitors')
      .orderBy('created_at', 'desc')
      .limit(200)
      .get()

    const visitors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() ?? null,
    }))

    return NextResponse.json(visitors)
  } catch (err) {
    console.error('Error in GET /api/visitors:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
