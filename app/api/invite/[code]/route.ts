import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebaseAdmin'

interface Params {
  params: { code: string }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { code } = params

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const query = await db
      .collection('members')
      .where('invite_code', '==', code.trim())
      .limit(1)
      .get()

    if (query.empty) {
      return NextResponse.json({ error: 'Invite code not found.' }, { status: 404 })
    }

    const member = query.docs[0].data()

    return NextResponse.json(
      {
        name: member.name ?? '',
        company: member.company ?? '',
        role: member.role ?? '',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('Error in /api/invite/[code]:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
