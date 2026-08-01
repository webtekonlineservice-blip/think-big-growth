import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'

interface Params {
  params: { code: string }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { code } = params

    if (!code || code.trim() === '') {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 400 })
    }

    await connectDB()

    const member = await Member.findOne({ invite_code: code.trim() })
      .select('name company role')
      .lean()

    if (!member) {
      return NextResponse.json({ error: 'Invite code not found.' }, { status: 404 })
    }

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
    console.error('GET /api/invite/[code] error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
