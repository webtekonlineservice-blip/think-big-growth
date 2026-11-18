import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import SpeakerRotation from '@/lib/models/SpeakerRotation'
import SocialPost, { SocialType, SocialGraphicSpec } from '@/lib/models/SocialPost'
import { getOpenSeats } from '@/lib/openSeats'
import { generateStudioCaption } from '@/lib/socialStudio'
import { chicagoToday, addDays, nextThursday, shortUpper as prettyDate } from '@/lib/socialDates'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// General BNI principles only. No statistics or claims about our chapter.
const EVERGREEN_TOPICS = [
  'What a good referral looks like: an introduction with context, not just a name',
  'Why BNI allows only one business per category',
  'How a 60-second weekly pitch helps members get found',
  'Why showing up every week builds trust',
  'What to expect as a first-time guest on a Thursday',
  'Why local owners refer each other to people they know',
  'What "givers gain" means in practice',
  'How to describe your ideal referral so others can spot one',
]

function weekNumber(iso: string): number {
  return Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / (7 * 86400000))
}
const initialsOf = (n: string) => n.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

/**
 * POST /api/social/plan
 * Admin-only. Builds the posting plan for the upcoming Thursday (Mon→Sat) from
 * live data: speaker rotation, the member featured least recently, and the
 * seats that are still open. Safe to run twice: existing plan posts for that
 * week and type are skipped.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const today = chicagoToday()
    const thu = nextThursday(today)

    const [members, withPhoto, speaker, spotlightHistory, existing, recent] = await Promise.all([
      Member.find().select('name role company display_order').sort({ display_order: 1 }).lean(),
      Member.find({ photo: { $ne: '' } }).select('_id').lean(),
      SpeakerRotation.findOne({ date: thu }).lean(),
      SocialPost.find({ type: 'spotlight', member_id: { $ne: '' } }).select('member_id date').lean(),
      SocialPost.find({ week_of: thu, source: 'plan' }).select('type').lean(),
      SocialPost.find().sort({ created_at: -1 }).limit(10).select('content').lean(),
    ])

    const photoIds = new Set(withPhoto.map((m) => m._id.toString()))
    const have = new Set(existing.map((p) => p.type as string))
    const recentTexts = recent.map((r) => r.content || '')

    // Speaker (only if one is actually set for this Thursday)
    const speakerOk = !!speaker && !!speaker.name && speaker.name !== 'Speaker Name'
    const speakerMember = speakerOk && speaker!.member_id
      ? members.find((m) => m._id.toString() === speaker!.member_id!.toString()) ?? null
      : null

    // Spotlight: member featured least recently (never featured first), photo preferred
    const lastFeatured: Record<string, string> = {}
    spotlightHistory.forEach((p) => {
      if (!lastFeatured[p.member_id] || p.date > lastFeatured[p.member_id]) lastFeatured[p.member_id] = p.date
    })
    const speakerId = speakerMember ? speakerMember._id.toString() : ''
    const spotlightPool = members.filter((m) => m._id.toString() !== speakerId)
    spotlightPool.sort((a, b) => {
      const la = lastFeatured[a._id.toString()] || ''
      const lb = lastFeatured[b._id.toString()] || ''
      if (la !== lb) return la < lb ? -1 : 1
      const pa = photoIds.has(a._id.toString()) ? 0 : 1
      const pb = photoIds.has(b._id.toString()) ? 0 : 1
      return pa - pb
    })
    const spotlight = spotlightPool[0] ?? null

    // Open seats (not covered by any member's role)
    const openSeats = (await getOpenSeats()).slice(0, 8)

    type Item = {
      date: string; type: SocialType; facts: Record<string, string>
      member_id: string; graphic: (cardLine: string, headline: string) => SocialGraphicSpec
    }
    const items: Item[] = []

    const monday = addDays(thu, -3), tuesday = addDays(thu, -2), wednesday = addDays(thu, -1)
    const friday = addDays(thu, 1), saturday = addDays(thu, 2)

    if (speakerOk) {
      items.push({
        date: monday, type: 'speaker',
        facts: { name: speaker!.name, company: speakerMember?.company || '' },
        member_id: speakerId,
        graphic: (cardLine) => ({
          kind: 'speaker', title: speaker!.name, subtitle: speakerMember?.company || '',
          dateLabel: `THURSDAY · ${prettyDate(thu)}`, caption: cardLine,
        }),
      })
    } else {
      items.push({
        date: monday, type: 'meeting_promo', facts: {}, member_id: '',
        graphic: (cardLine, headline) => ({ kind: 'meeting_promo', title: headline, caption: cardLine }),
      })
    }

    if (spotlight) {
      items.push({
        date: tuesday, type: 'spotlight',
        facts: { name: spotlight.name, role: spotlight.role || '', company: spotlight.company || '' },
        member_id: spotlight._id.toString(),
        graphic: (cardLine) => ({
          kind: 'spotlight', title: spotlight.name, subtitle: spotlight.company || '',
          lines: spotlight.role ? [spotlight.role] : [], caption: cardLine,
        }),
      })
    }

    if (openSeats.length > 0) {
      items.push({
        date: wednesday, type: 'open_seats', facts: { seats: openSeats.join(', ') }, member_id: '',
        graphic: (cardLine, headline) => ({
          kind: 'open_seats', title: headline, subtitle: 'One business per category. Every seat is exclusive.',
          lines: openSeats, caption: cardLine,
        }),
      })
    } else {
      items.push({
        date: wednesday, type: 'visitor_invite', facts: {}, member_id: '',
        graphic: (cardLine, headline) => ({ kind: 'visitor_invite', title: headline, caption: cardLine }),
      })
    }

    items.push({
      date: thu, type: 'meeting_day', facts: {}, member_id: '',
      graphic: (cardLine, headline) => ({ kind: 'meeting_day', title: headline, caption: cardLine }),
    })
    items.push({
      date: friday, type: 'recap', facts: {}, member_id: '',
      graphic: (cardLine, headline) => ({ kind: 'recap', title: headline, caption: cardLine }),
    })
    const topic = EVERGREEN_TOPICS[weekNumber(thu) % EVERGREEN_TOPICS.length]
    items.push({
      date: saturday, type: 'evergreen', facts: { topic }, member_id: '',
      graphic: (cardLine, headline) => ({ kind: 'evergreen', title: headline, caption: cardLine }),
    })

    // Skip anything already planned or already in the past
    const todo = items.filter((it) => !have.has(it.type) && it.date >= today)
    const written = await Promise.all(
      todo.map((it) => generateStudioCaption({ type: it.type, platform: 'facebook', facts: it.facts, recent: recentTexts }))
    )

    const created = await SocialPost.insertMany(
      todo.map((it, i) => ({
        date: it.date, platform: 'facebook', type: it.type, content: written[i].post,
        status: 'drafted', member_id: it.member_id, photo_id: '',
        graphic: it.graphic(written[i].cardLine, written[i].headline),
        format: 'square', week_of: thu, source: 'plan',
      }))
    )

    return NextResponse.json({
      ok: true, week_of: thu, created: created.length,
      skipped: items.length - todo.length,
      note: speakerOk ? null : 'No speaker is set for this Thursday, so Monday is a general meeting promo.',
      spotlightMember: spotlight ? { id: spotlight._id.toString(), name: spotlight.name, initials: initialsOf(spotlight.name) } : null,
    })
  } catch (err) {
    console.error('POST /api/social/plan error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Plan failed.' }, { status: 500 })
  }
}
