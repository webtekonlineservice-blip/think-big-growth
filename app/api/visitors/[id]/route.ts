import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebaseAdmin'

interface Params {
  params: { id: string }
}

/**
 * PATCH /api/visitors/[id]
 * Admin-only: update visitor status or notes.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const auth = getAdminAuth()
    const decoded = await auth.verifyIdToken(token)

    if (!decoded.admin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const body = await req.json()
    const allowedFields = ['status', 'notes', 'visit_date']
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    await db.collection('visitors').doc(params.id).update(updates)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error in PATCH /api/visitors/[id]:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
