import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Member from '@/lib/models/Member'
import LedgerEntry from '@/lib/models/LedgerEntry'
import Transaction from '@/lib/models/Transaction'
import SpeakerRotation from '@/lib/models/SpeakerRotation'
import ChapterSetting, { STARTING_BALANCE_KEY, STARTING_BALANCE_DEFAULT, PENDING_MEMBERS_KEY } from '@/lib/models/ChapterSetting'
import { getSession } from '@/lib/auth'
import { pushSlideDeck, SlidePushData } from '@/lib/googleSlides'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function money(n: number) { return `$${n.toFixed(2)}` }

function longDate(iso: string): string {
  const [y, m, d] = (iso || '').split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}`
}

/**
 * POST /api/treasurer/slides/push
 * Admin-only. Reads live DB data and pushes it directly into the Google Slides
 * deck using element object IDs (no {{token}} placeholders needed).
 *
 * Updates:
 *   Slide 95 — member names + payment status
 *   Slide 96 — Monthly Accounts Report (starting balance / dues / expenses / total)
 *   Slide 97 — Speaker Rotation
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()

    const [members, ledger, transactions, speakers, balDoc, pendDoc] = await Promise.all([
      Member.find().sort({ display_order: 1, name: 1 }).select('name').lean(),
      LedgerEntry.find().lean(),
      Transaction.find().lean(),
      SpeakerRotation.find().sort({ date: 1 }).lean(),
      ChapterSetting.findOne({ key: STARTING_BALANCE_KEY }).lean(),
      ChapterSetting.findOne({ key: PENDING_MEMBERS_KEY }).lean(),
    ])

    const startingBalance: number = (balDoc?.value as number) ?? STARTING_BALANCE_DEFAULT
    const pending: string[] = Array.isArray(pendDoc?.data) ? (pendDoc!.data as string[]) : []

    // ── Member payment status ──────────────────────────────────────────────
    const memberData: SlidePushData['members'] = members.map((m) => {
      const idStr = (m._id as { toString(): string }).toString()
      const mine = ledger.filter((e) => e.member_name === m.name)
      const charged = mine.filter((e) => e.type === 'charge' || e.type === 'opening').reduce((s, e) => s + e.amount, 0)
      const paid = mine.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0)
      const balance = charged - paid
      const hasActivity = mine.length > 0

      let status: string
      if (pending.includes(idStr)) status = 'Pending'
      else if (!hasActivity) status = 'Pending'
      else if (balance > 0) status = `${money(balance)} due`
      else status = 'Paid'

      return { name: m.name, status }
    })

    // ── Financial summary ──────────────────────────────────────────────────
    const duesCollected = transactions
      .filter((t) => t.type === 'income' && (t.category === 'Member Payment' || t.category === 'Dues'))
      .reduce((s, t) => s + t.amount, 0)
    const raffleIn = transactions
      .filter((t) => t.type === 'income' && t.category === '50/50 Collected')
      .reduce((s, t) => s + t.amount, 0)
    const raffleOut = transactions
      .filter((t) => t.type === 'expense' && t.category === '50/50 Payout')
      .reduce((s, t) => s + t.amount, 0)
    const chapterExpenses = transactions
      .filter((t) => t.type === 'expense' && t.category !== '50/50 Payout')
      .reduce((s, t) => s + t.amount, 0)
    const totalInAccount = startingBalance + duesCollected + raffleIn - chapterExpenses - raffleOut

    // ── Month label (current month) ────────────────────────────────────────
    const now = new Date()
    const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

    // ── Upcoming speakers ──────────────────────────────────────────────────
    const todayIso = now.toISOString().split('T')[0]
    const upcoming = speakers.filter((s) => s.date >= todayIso).slice(0, 6)
    const speakerRows = (upcoming.length > 0 ? upcoming : speakers.slice(-6)).map((s) => ({
      date: longDate(s.date),
      name: s.name,
    }))

    // ── Push to deck ───────────────────────────────────────────────────────
    const pushData: SlidePushData = {
      members: memberData,
      summary: { startingBalance, duesCollected, raffleIn, chapterExpenses, raffleOut, totalInAccount },
      monthLabel,
      speakers: speakerRows,
    }

    const result = await pushSlideDeck(pushData)

    return NextResponse.json({
      ok: true,
      ...result,
      summary: {
        startingBalance: money(startingBalance),
        duesCollected: money(duesCollected),
        raffleIn: money(raffleIn),
        chapterExpenses: money(chapterExpenses),
        raffleOut: money(raffleOut),
        totalInAccount: money(totalInAccount),
      },
      members: memberData.length,
      speakers: speakerRows.length,
      monthLabel,
    })
  } catch (err) {
    console.error('POST /api/treasurer/slides/push error:', err)
    const message = err instanceof Error ? err.message : 'Push failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
