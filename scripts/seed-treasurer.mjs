/**
 * Seed script — transfers BNI Treasurer data into MongoDB.
 *
 * Creates:
 *   • Opening balance ledger entries (matched to Members by name)
 *   • Chapter transactions from the September bank statement
 *
 * Source: Webtek BNILedger.jsx opening balances + First Citizens Bank
 *         statement (Sep 5–30 2026) + spreadsheet bank balance 10/1/26.
 *
 * Run:  node scripts/seed-treasurer.mjs
 * Safe to re-run — skips entries that already exist (matched by a stable key).
 */

import mongoose from 'mongoose'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) return
  process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
})

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

// ── Minimal schemas (match lib/models when added to the app) ──────────────────
const MemberSchema = new mongoose.Schema({ name: String, email: String }, { strict: false })
const Member = mongoose.models.Member ?? mongoose.model('Member', MemberSchema)

const LedgerEntrySchema = new mongoose.Schema({
  member_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  member_name: String,
  type:        { type: String, enum: ['opening', 'charge', 'payment'] },
  description: String,
  amount:      Number,
  date:        String,     // YYYY-MM-DD
  status:      { type: String, default: 'unpaid' },
  notes:       { type: String, default: '' },
  seed_key:    { type: String, unique: true, sparse: true }, // idempotency
  created_at:  { type: Date, default: Date.now },
})
const LedgerEntry = mongoose.models.LedgerEntry ?? mongoose.model('LedgerEntry', LedgerEntrySchema)

const TransactionSchema = new mongoose.Schema({
  type:        { type: String, enum: ['income', 'expense'] },
  category:    String,
  description: String,
  amount:      Number,
  date:        String,     // YYYY-MM-DD
  notes:       { type: String, default: '' },
  seed_key:    { type: String, unique: true, sparse: true },
  created_at:  { type: Date, default: Date.now },
})
const Transaction = mongoose.models.Transaction ?? mongoose.model('Transaction', TransactionSchema)

// ── Opening balances (from Webtek spreadsheet / BNILedger.jsx) ────────────────
const SEED_DATE = '2026-07-17'
const OPENING = [
  { name: 'Mitch Slattery', balance: 175.00, credit: 0, notes: 'Owes $175 balance. Paid $125 toward account.' },
  { name: 'Ryan',           balance: 0,      credit: 4, notes: 'Credit for 4 lunches prepaid' },
  // Everyone else opened at $0 — no ledger entry needed until charged.
]
const LUNCH_PRICE = 20.00  // used to value prepaid lunch credits

// ── Chapter transactions from the First Citizens Bank statement (Sep 2026) ────
const BANK_TRANSACTIONS = [
  // Credits (member payments collected via card terminal + mobile deposit)
  { type: 'income',  category: 'Member Payment', description: 'Card terminal deposit', amount: 23.00,  date: '2026-09-08' },
  { type: 'income',  category: 'Member Payment', description: 'Card terminal deposit', amount: 69.00,  date: '2026-09-17' },
  { type: 'income',  category: 'Member Payment', description: 'Card terminal deposit', amount: 405.00, date: '2026-09-21' },
  { type: 'income',  category: 'Member Payment', description: 'Card terminal deposit', amount: 287.50, date: '2026-09-28' },
  { type: 'income',  category: 'Member Payment', description: 'Mobile check deposit',   amount: 48.00,  date: '2026-09-29' },
  // Debits
  { type: 'expense', category: 'Weekly Lunch',   description: "Mike Duffy's — meeting lunch (09/10)", amount: 347.67, date: '2026-09-14' },
  { type: 'expense', category: 'Supplies',       description: 'Walmart — check printing',             amount: 20.14,  date: '2026-09-17' },
  { type: 'expense', category: 'Weekly Lunch',   description: "Mike Duffy's — meeting lunch (09/25)", amount: 253.66, date: '2026-09-28' },
  { type: 'expense', category: 'Other Expense',  description: 'Card processing fee',                  amount: 0.78,   date: '2026-09-08' },
  { type: 'expense', category: 'Other Expense',  description: 'Card processing fee',                  amount: 2.34,   date: '2026-09-18' },
  { type: 'expense', category: 'Other Expense',  description: 'Card processing fee',                  amount: 12.45,  date: '2026-09-21' },
  { type: 'expense', category: 'Other Expense',  description: 'Card processing fee',                  amount: 8.88,   date: '2026-09-28' },
]

// ── Run ───────────────────────────────────────────────────────────────────────
await mongoose.connect(MONGODB_URI)
console.log('Connected to MongoDB\n')

const members = await Member.find().lean()
const findMember = (name) => {
  const first = name.toLowerCase().split(' ')[0]
  return (
    members.find((m) => (m.name || '').toLowerCase() === name.toLowerCase()) ||
    members.find((m) => (m.name || '').toLowerCase().startsWith(first + ' ')) ||
    members.find((m) => (m.name || '').toLowerCase() === first) ||
    null
  )
}

// Idempotent upsert helper
async function upsert(Model, seed_key, doc) {
  const exists = await Model.findOne({ seed_key })
  if (exists) { console.log(`  SKIP  ${seed_key}`); return false }
  await Model.create({ ...doc, seed_key })
  console.log(`  ✓     ${seed_key}`)
  return true
}

let ledgerCount = 0, txCount = 0

console.log('Opening ledger balances:')
for (const ob of OPENING) {
  const member = findMember(ob.name)
  const member_name = member?.name || ob.name
  const member_id = member?._id || null

  if (ob.balance > 0) {
    const ok = await upsert(LedgerEntry, `opening-${ob.name.toLowerCase().replace(/\s+/g, '-')}`, {
      member_id, member_name,
      type: 'opening',
      description: 'Opening balance (transferred from spreadsheet)',
      amount: ob.balance,
      date: SEED_DATE,
      status: 'unpaid',
      notes: ob.notes,
    })
    if (ok) ledgerCount++
  }
  if (ob.credit > 0) {
    const ok = await upsert(LedgerEntry, `credit-${ob.name.toLowerCase().replace(/\s+/g, '-')}`, {
      member_id, member_name,
      type: 'payment',
      description: `Opening credit — ${ob.credit} lunches prepaid`,
      amount: ob.credit * LUNCH_PRICE,
      date: SEED_DATE,
      status: 'paid',
      notes: ob.notes,
    })
    if (ok) ledgerCount++
  }
}

console.log('\nChapter transactions (Sept bank statement):')
for (const [i, tx] of BANK_TRANSACTIONS.entries()) {
  const ok = await upsert(Transaction, `bank-sep26-${i}`, tx)
  if (ok) txCount++
}

console.log(`\nDone. ${ledgerCount} ledger entries, ${txCount} transactions created.`)
console.log('Reminder: bank balance as of 10/01/2026 was $3,322.70 (statement ending $3,201.49).')

await mongoose.disconnect()
process.exit(0)
