import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Prospect from '@/lib/models/Prospect'
import { getSession } from '@/lib/auth'

/**
 * POST /api/prospects/enrich
 * Admin-only: trigger email enrichment for prospects that have a website but no real email.
 * Uses urllib fallback (regex scrape) on Vercel — ScrapeGraphAI runs locally via scripts/enrich.py.
 * Body: { campaign_id?: string, limit?: number }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const { campaign_id, limit = 20 } = await req.json() as { campaign_id?: string; limit?: number }

    await connectDB()

    // Find prospects with website but placeholder/empty email
    const query: Record<string, unknown> = {
      website: { $exists: true, $ne: '' },
      $or: [
        { email: { $regex: 'placeholder.local' } },
        { email: '' },
      ],
    }
    if (campaign_id) query.campaign_id = campaign_id

    const prospects = await Prospect.find(query).limit(Math.min(limit, 50)).lean()

    if (!prospects.length) {
      return NextResponse.json({ message: 'No prospects need enrichment.', enriched: 0, failed: 0 })
    }

    let enriched = 0
    let failed = 0
    const results: Array<{ name: string; email: string; status: string }> = []

    for (const prospect of prospects) {
      const website = prospect.website
      if (!website) { failed++; continue }

      const email = await scrapeEmailFromWebsite(website)

      if (email) {
        await Prospect.findByIdAndUpdate(prospect._id, {
          $set: { email, enriched: true, enriched_at: new Date() }
        })
        enriched++
        results.push({ name: prospect.name || prospect.company, email, status: 'found' })
      } else {
        await Prospect.findByIdAndUpdate(prospect._id, {
          $set: { enriched: false, enriched_at: new Date() }
        })
        failed++
        results.push({ name: prospect.name || prospect.company, email: '', status: 'not_found' })
      }
    }

    return NextResponse.json({
      enriched,
      failed,
      total: prospects.length,
      results,
    })
  } catch (err) {
    console.error('POST /api/prospects/enrich error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * GET /api/prospects/enrich
 * Admin-only: returns count of prospects that need enrichment.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()

    const needsEnrichment = await Prospect.countDocuments({
      website: { $exists: true, $ne: '' },
      $or: [
        { email: { $regex: 'placeholder.local' } },
        { email: '' },
      ],
    })

    const hasEmail = await Prospect.countDocuments({
      email: { $exists: true, $ne: '', $not: { $regex: 'placeholder.local' } },
    })

    const total = await Prospect.countDocuments()

    return NextResponse.json({ needsEnrichment, hasEmail, total })
  } catch (err) {
    console.error('GET /api/prospects/enrich error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

// ── Regex-based email scraper (works on Vercel, no dependencies) ──────────────
async function scrapeEmailFromWebsite(website: string): Promise<string> {
  if (!website.startsWith('http')) website = 'https://' + website

  const urlsToTry = [
    website.replace(/\/$/, '') + '/contact',
    website.replace(/\/$/, '') + '/contact-us',
    website.replace(/\/$/, '') + '/about',
    website,
  ]

  const ignorePatterns = [
    'placeholder', 'example.com', 'sentry', 'schema.org',
    'w3.org', 'wix', 'squarespace', 'wordpress', 'jquery',
    '.png', '.jpg', '.gif', '.svg',
  ]

  for (const url of urlsToTry) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThinkBigBot/1.0)' },
      })
      clearTimeout(timeout)

      if (!res.ok) continue

      const html = await res.text()

      // Extract emails via regex
      const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
      const matches = html.match(emailRegex) || []

      const valid = matches.filter((e) =>
        !ignorePatterns.some((p) => e.toLowerCase().includes(p))
      )

      if (valid.length > 0) {
        // Prefer contact/info/office/hello emails over others
        const preferred = valid.find((e) =>
          /^(contact|info|hello|office|admin|mail|inqui|desk|reception)@/.test(e.toLowerCase())
        )
        return (preferred || valid[0]).toLowerCase()
      }
    } catch {
      continue
    }
  }

  return ''
}
