import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebaseAdmin'

/**
 * GET /api/members
 *
 * Admin-only: returns all members ordered by display_order.
 * Requires a valid Firebase ID token in the Authorization header:
 *   Authorization: Bearer <idToken>
 *
 * Also supports ?uid=<uid> for member profile lookup (returns own profile only).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const uid = req.nextUrl.searchParams.get('uid')

    // Member self-profile lookup (used by member dashboard)
    if (uid) {
      const db = getAdminFirestore()
      const query = await db
        .collection('members')
        .where('firebase_uid', '==', uid)
        .limit(1)
        .get()

      if (query.empty) {
        return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
      }

      const data = query.docs[0].data()
      return NextResponse.json({
        id: query.docs[0].id,
        name: data.name,
        company: data.company,
        invite_code: data.invite_code,
        role: data.role,
      })
    }

    // Admin-only: verify token and admin claim
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
      .collection('members')
      .orderBy('display_order', 'asc')
      .get()

    const members = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Strip sensitive server-side fields
      firebase_uid: undefined,
    }))

    return NextResponse.json(members)
  } catch (err) {
    console.error('Error in /api/members:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
