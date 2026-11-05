import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { getSession } from '@/lib/auth'

/**
 * GET /api/treasurer/ledger
 * Admin-only: returns all ledger entries ordered by date desc.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const entries = await LedgerEntry.find().sort({ date: -1, created_at: -1 }).limit(1000).lean()

    const result = entries.map((e) => ({
      id: e._id.toString(),
      member_id: e.member_id?.toString() ?? null,
      member_name: e.member_name,
      type: e.type,
      description: e.description,
      amount: e.amount,
      date: e.date,
      status: e.status,
      notes: e.notes,
      item: e.item ?? '',
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/treasurer/ledger error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/treasurer/ledger
 * Admin-only: add one entry, OR record lunch charges for attendees.
 *
 * Body (single entry):
 *   { member_id, member_name, type, amount, date, description, status, notes }
 *
 * Body (lunch attendance):
 *   Only selected members and visitors are charged. Re-submitting the same
 *   attendees for a date does not create duplicate lunch charges.
 *
 *   { weeklyBill: {
 *       date,
 *       lunchPrice?: number,    // flat lunch amount (default 23)
 *       members: [{ member_id, member_name, ate: boolean, item?: string }],
 *       visitors?: [{ name, amount, item? }]
 *   } }
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    await connectDB()

    if (body.weeklyBill) {
      const { date, members, visitors } = body.weeklyBill
      const lunchPrice = Number(body.weeklyBill.lunchPrice ?? 23)
      const dues = Number(body.weeklyBill.dues ?? 2)
      const validDate = typeof date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) &&
        new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date
      if (!validDate) {
        return NextResponse.json({ error: 'weeklyBill requires a valid date.' }, { status: 400 })
      }
      if (!Number.isFinite(lunchPrice) || lunchPrice <= 0) {
        return NextResponse.json({ error: 'lunchPrice must be a positive number.' }, { status: 400 })
      }

      type Doc = {
        member_id: string | null; member_name: string
        type: 'charge'; description: string; amount: number
        date: string; status: 'unpaid'; notes: string; item: string
      }
      const docs: Doc[] = []
      const selectedMembers = Array.isArray(members)
        ? members as { member_id?: string; member_name?: string; ate?: boolean; drink?: boolean; choice?: string; item?: string }[]
        : []
      const selectedVisitors = Array.isArray(visitors)
        ? visitors as { name?: string; amount?: number; item?: string; description?: string }[]
        : []

      for (const m of selectedMembers) {
        if (typeof m.member_name !== 'string' || !m.member_name.trim()) continue
        // Determine choice: explicit 'choice' field, or legacy ate/drink booleans
        const choice = m.choice ?? (m.ate ? 'ate' : m.drink ? 'drink' : 'none')
        const amount = choice === 'ate' ? lunchPrice : choice === 'drink' ? 4 : dues
        const description = choice === 'ate' ? 'Weekly Lunch' : choice === 'drink' ? 'Weekly Drink' : 'Weekly Attendance'
        const notes = choice === 'ate' ? `Lunch $${lunchPrice}` : choice === 'drink' ? 'Drink $4' : `Attendance $${dues}`
        docs.push({
          member_id: m.member_id ?? null,
          member_name: m.member_name.trim(),
          type: 'charge',
          description,
          amount,
          date,
          status: 'unpaid',
          notes,
          item: choice === 'ate' ? (m.item?.trim() ?? '') : '',
        })
      }

      for (const v of selectedVisitors) {
        if (!v.name?.trim() || typeof v.amount !== 'number' || !Number.isFinite(v.amount) || v.amount <= 0) {
          return NextResponse.json({ error: 'Each visitor requires a name and a positive amount.' }, { status: 400 })
        }
        if (v.item !== undefined && typeof v.item !== 'string') {
          return NextResponse.json({ error: 'Visitor item must be a string.' }, { status: 400 })
        }
        docs.push({
          member_id: null,
          member_name: v.name.trim(),
          type: 'charge',
          description: (typeof v.description === 'string' && v.description) ? v.description : 'Visitor Lunch',
          amount: Number(v.amount.toFixed(2)),
          date,
          status: 'unpaid',
          notes: 'Visitor',
          item: v.item?.trim() ?? '',
        })
      }

      if (docs.length === 0) {
        return NextResponse.json({ error: 'Select at least one lunch attendee.' }, { status: 400 })
      }

      const MEMBER_DESCS = ['Weekly Lunch', 'Weekly Drink', 'Weekly Attendance']
      const memberDocs = docs.filter((doc) => MEMBER_DESCS.includes(doc.description))
      const visitorDocs = docs.filter((doc) => !MEMBER_DESCS.includes(doc.description))
      const [existingMembers, existingVisitors] = await Promise.all([
        memberDocs.length
          ? LedgerEntry.find({
              date,
              type: 'charge',
              description: { $in: MEMBER_DESCS },
              $or: [
                { member_id: { $in: memberDocs.map((doc) => doc.member_id).filter(Boolean) } },
                { member_name: { $in: memberDocs.map((doc) => doc.member_name) } },
              ],
            }).select('member_id member_name').lean()
          : [],
        visitorDocs.length
          ? LedgerEntry.find({
              date,
              type: 'charge',
              description: { $nin: MEMBER_DESCS },
              member_name: { $in: visitorDocs.map((doc) => doc.member_name) },
            }).select('member_name').lean()
          : [],
      ])

      const existingMemberIds = new Set(existingMembers.map((entry) => entry.member_id?.toString()).filter(Boolean))
      const existingMemberNames = new Set(existingMembers
        .filter((entry) => !entry.member_id)
        .map((entry) => entry.member_name))
      const existingVisitorNames = new Set(existingVisitors.map((entry) => entry.member_name.toLowerCase()))
      const seenMemberIds = new Set<string>()
      const seenMemberNames = new Set<string>()
      const seenVisitorNames = new Set<string>()
      const newDocs = docs.filter((doc) => {
        if (MEMBER_DESCS.includes(doc.description)) {
          const memberId = doc.member_id?.toString()
          if ((memberId && (existingMemberIds.has(memberId) || seenMemberIds.has(memberId))) ||
              existingMemberNames.has(doc.member_name) || (!memberId && seenMemberNames.has(doc.member_name))) return false
          if (memberId) seenMemberIds.add(memberId)
          else seenMemberNames.add(doc.member_name)
          return true
        }
        const visitorName = doc.member_name.toLowerCase()
        if (existingVisitorNames.has(visitorName) || seenVisitorNames.has(visitorName)) return false
        seenVisitorNames.add(visitorName)
        return true
      })

      if (newDocs.length === 0) {
        return NextResponse.json({ created: 0, skipped: docs.length })
      }
      const created = await LedgerEntry.insertMany(newDocs)
      return NextResponse.json({ created: created.length, skipped: docs.length - created.length }, { status: 201 })
    }

    // Single entry
    const { member_id, member_name, type, amount, date, description, status, notes } = body
    if (!member_name || !type || amount == null || !date) {
      return NextResponse.json({ error: 'member_name, type, amount and date are required.' }, { status: 400 })
    }

    const entry = await LedgerEntry.create({
      member_id: member_id ?? null,
      member_name,
      type,
      amount: Number(amount),
      date,
      description: description ?? '',
      status: status ?? (type === 'payment' ? 'paid' : 'unpaid'),
      notes: notes ?? '',
    })

    return NextResponse.json({ id: entry._id.toString() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/treasurer/ledger error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/treasurer/ledger?id=<id>
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    await connectDB()
    await LedgerEntry.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/treasurer/ledger error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * PUT /api/treasurer/ledger?id=<id>
 * Admin-only: update any editable field on a ledger entry.
 * Body: { type?, description?, item?, amount?, date?, status?, notes? }
 */
export async function PUT(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    const body = await req.json()
    const set: Record<string, unknown> = {}
    const allowed = ['type', 'description', 'item', 'amount', 'date', 'status', 'notes'] as const
    for (const k of allowed) {
      if (body[k] !== undefined) set[k] = k === 'amount' ? Number(body[k]) : body[k]
    }
    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
    }
    await connectDB()
    const entry = await LedgerEntry.findByIdAndUpdate(id, { $set: set }, { new: true }).lean()
    if (!entry) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PUT /api/treasurer/ledger error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
