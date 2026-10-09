import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Transaction from '@/lib/models/Transaction'
import { getSession } from '@/lib/auth'

/**
 * GET /api/treasurer/transactions
 * Admin-only: returns all chapter transactions ordered by date desc.
 */
export async function GET(req: NextRequest) {
  const session = getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    await connectDB()
    const txs = await Transaction.find().sort({ date: -1, created_at: -1 }).limit(1000).lean()

    const result = txs.map((t) => ({
      id: t._id.toString(),
      type: t.type,
      category: t.category,
      description: t.description,
      amount: t.amount,
      date: t.date,
      notes: t.notes,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('GET /api/treasurer/transactions error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * POST /api/treasurer/transactions
 * Admin-only: add a chapter income/expense transaction.
 */
export async function POST(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  try {
    const body = await req.json()
    const { type, category, description, amount, date, notes } = body

    if (!type || !category || amount == null || !date) {
      return NextResponse.json({ error: 'type, category, amount and date are required.' }, { status: 400 })
    }

    await connectDB()
    const tx = await Transaction.create({
      type,
      category,
      description: description ?? '',
      amount: Number(amount),
      date,
      notes: notes ?? '',
    })

    return NextResponse.json({ id: tx._id.toString() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/treasurer/transactions error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

/**
 * DELETE /api/treasurer/transactions?id=<id>
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req)
  if (!session?.is_admin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 })

  try {
    await connectDB()
    await Transaction.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/treasurer/transactions error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
