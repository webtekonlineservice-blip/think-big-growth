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
 * Admin-only: add one entry, OR a weekly bill split across attendees.
 *
 * Body (single entry):
 *   { member_id, member_name, type, amount, date, description, status, notes }
 *
 * Body (weekly bill):
 *   Each member gets EXACTLY ONE charge for the week:
 *     - ate lunch  → `lunchPrice` (default $24, already includes the dues)
 *     - didn't eat → `dues` (default $4, owed regardless)
 *   The dish name is reference-only (stored on the eater's charge).
 *
 *   { weeklyBill: {
 *       date,
 *       dues?: number,          // flat non-eater amount (default 4)
 *       lunchPrice?: number,    // flat eater amount (default 24)
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
      const dues = Number(body.weeklyBill.dues ?? 4)
      const lunchPrice = Number(body.weeklyBill.lunchPrice ?? 24)
      if (!date) {
        return NextResponse.json({ error: 'weeklyBill requires a date.' }, { status: 400 })
      }

      type Doc = {
        member_id: string | null; member_name: string
        type: 'charge'; description: string; amount: number
        date: string; status: 'unpaid'; notes: string; item: string
      }
      const docs: Doc[] = []

      // One charge per member: $24 if ate (incl. dues), else $4 dues.
      if (Array.isArray(members)) {
        for (const m of members as { member_id?: string; member_name: string; ate?: boolean; item?: string }[]) {
          if (!m.member_name) continue
          const ate = !!m.ate
          docs.push({
            member_id: m.member_id ?? null,
            member_name: m.member_name,
            type: 'charge',
            description: ate ? 'Weekly Lunch' : 'Weekly Dues',
            amount: ate ? lunchPrice : dues,
            date,
            status: 'unpaid',
            notes: ate ? `Lunch $${lunchPrice.toFixed(2)} (incl. $${dues.toFixed(2)} dues)` : `Weekly dues $${dues.toFixed(2)}`,
            item: ate ? (m.item?.trim() ?? '') : '',
          })
        }
      }

      // Visitor lunch charges — no member link
      if (Array.isArray(visitors)) {
        for (const v of visitors as { name: string; amount: number; item?: string }[]) {
          if (!v.name?.trim() || !(v.amount > 0)) continue
          docs.push({
            member_id: null,
            member_name: v.name.trim(),
            type: 'charge',
            description: 'Visitor Lunch',
            amount: Number(Number(v.amount).toFixed(2)),
            date,
            status: 'unpaid',
            notes: 'Visitor',
            item: v.item?.trim() ?? '',
          })
        }
      }

      if (docs.length === 0) {
        return NextResponse.json({ error: 'Nothing to charge — provide members or visitors.' }, { status: 400 })
      }

      const created = await LedgerEntry.insertMany(docs)
      return NextResponse.json({ created: created.length }, { status: 201 })
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
