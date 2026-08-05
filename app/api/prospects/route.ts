import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import EmailCampaign from '@/lib/models/EmailCampaign'
import { getSession } from '@/lib/auth'

/**
 * GET /api/prospects?campaign_id=<id>&page=1&limit=50
 * Admin-only: list prospects with pagination.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const campaignId = req.nextUrl.searchParams.get('campaign_id')
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))
    const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get('limit') ?? '50'))

    const filter: Record<string, unknown> = {}
    if (campaignId) filter.campaign_id = campaignId

    const [prospects, total] = await Promise.all([
      Prospect.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Prospect.countDocuments(filter),
    ])

    return NextResponse.json({
      prospects: prospects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        email: p.email,
        company: p.company,
        profession: p.profession,
        phone: p.phone,
        source: p.source,
        status: p.status,
        sequence_step: p.sequence_step,
        opened_count: p.opened_count,
        clicked_count: p.clicked_count,
        unsubscribed: p.unsubscribed,
        last_sent_at: p.last_sent_at?.toISOString() ?? null,
        created_at: p.created_at.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('GET /api/prospects error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/prospects
 * Admin-only: import prospects from extension or CSV.
 * Body: { campaign_id: string, prospects: Array<{name, email, company, profession, phone, website, source}> }
 * Accepts prospects with or without email (phone-only leads stored for enrichment later).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { campaign_id, prospects } = (await req.json()) as {
      campaign_id: string
      prospects: Array<{ name?: string; email?: string; company?: string; profession?: string; phone?: string; website?: string; source?: string }>
    }

    if (!campaign_id) return NextResponse.json({ error: 'campaign_id is required.' }, { status: 400 })
    if (!prospects?.length) return NextResponse.json({ error: 'prospects array is required.' }, { status: 400 })

    await connectDB()

    const campaign = await EmailCampaign.findById(campaign_id)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })

    let imported = 0
    let skipped = 0

    for (const p of prospects) {
      // Need at least a name or email
      if (!p.email?.trim() && !p.name?.trim() && !p.company?.trim()) { skipped++; continue }

      const email = p.email?.trim()?.toLowerCase() || ''
      const name = p.name?.trim() || p.company?.trim() || ''
      const token = crypto.randomBytes(24).toString('hex')

      try {
        await Prospect.create({
          name,
          email: email || `noemail_${token.slice(0, 8)}@placeholder.local`,
          company: p.company?.trim() ?? '',
          profession: p.profession?.trim() ?? '',
          phone: p.phone?.trim() ?? '',
          website: p.website?.trim() ?? '',
          source: p.source?.trim() ?? 'extension',
          campaign_id,
          unsubscribe_token: token,
        })
        imported++
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) { skipped++ }
        else { skipped++ }
      }
    }

    await EmailCampaign.findByIdAndUpdate(campaign_id, {
      $inc: { total_prospects: imported },
    })

    return NextResponse.json({ imported, skipped, total: prospects.length }, { status: 201 })
  } catch (err) {
    console.error('POST /api/prospects error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
