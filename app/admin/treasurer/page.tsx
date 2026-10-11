'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import SocialGraphic, { GraphicData } from '@/components/SocialGraphic'
import {
  Wallet, DollarSign, BarChart3, Plus, Trash2, Mail, Download,
  ChevronDown, ChevronUp, X, Send, Loader2, Copy, Check, Mic, Presentation, Share2, Pencil,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Member { id: string; name: string; company: string; role?: string; logo?: string; photo?: string }
interface LedgerEntry {
  id: string; member_id: string | null; member_name: string
  type: 'opening' | 'charge' | 'payment'; description: string
  amount: number; date: string; status: string; notes: string; item?: string
}
interface Transaction {
  id: string; type: 'income' | 'expense'; category: string
  description: string; amount: number; date: string; notes: string
}
interface Speaker { id: string; date: string; member_id: string | null; name: string }
interface SocialPost { id: string; date: string; platform: 'facebook' | 'linkedin' | 'instagram'; type: string; content: string; status: 'idea' | 'drafted' | 'scheduled' | 'posted' }

const INCOME_CATEGORIES = ['Member Payment', 'Guest Fee', 'Event Income', 'Dues', '50/50 Collected', 'Other Income']
const EXPENSE_CATEGORIES = ['Weekly Lunch', '50/50 Payout', 'Room Rental', 'Supplies', 'Marketing', 'Event Expense', 'Other Expense']
const LUNCH_PRICE = 24
const WEEKLY_DUES = 4
const STARTING_BALANCE_DEFAULT = 3201.49

const money = (n: number) => `$${n.toFixed(2)}`
const today = () => new Date().toISOString().split('T')[0]

const CARD = 'bg-gray-800/60 border border-gray-700 rounded-xl'
const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const BTN_PRIMARY = 'flex items-center gap-1.5 bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition disabled:opacity-50'

export default function TreasurerPage() {
  const { user, loading: authLoading } = useAdminAuth()
  const [tab, setTab] = useState<'ledger' | 'transactions' | 'report' | 'slides' | 'speakers' | 'social'>('ledger')

  const [members, setMembers] = useState<Member[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [startingBalance, setStartingBalance] = useState<number>(STARTING_BALANCE_DEFAULT)
  const [pendingMembers, setPendingMembers] = useState<string[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [social, setSocial] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [m, l, t, s, sp, so] = await Promise.all([
      fetch('/api/members').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/treasurer/ledger').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/treasurer/transactions').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/treasurer/settings').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/treasurer/speakers').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/treasurer/social').then((r) => (r.ok ? r.json() : [])),
    ])
    setMembers(m)
    setLedger(l)
    setTransactions(t)
    setSpeakers(sp)
    setSocial(so)
    if (s && typeof s.startingBalance === 'number') setStartingBalance(s.startingBalance)
    if (s && Array.isArray(s.pendingMembers)) setPendingMembers(s.pendingMembers)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchAll().finally(() => setLoading(false))
  }, [user, fetchAll])

  if (authLoading || !user) return null

  const TABS = [
    { id: 'ledger' as const, label: 'Lunch Ledger', Icon: Wallet },
    { id: 'transactions' as const, label: 'Income/Expense', Icon: DollarSign },
    { id: 'report' as const, label: 'Report', Icon: BarChart3 },
    { id: 'slides' as const, label: 'Slides', Icon: Presentation },
    { id: 'speakers' as const, label: 'Speakers', Icon: Mic },
    { id: 'social' as const, label: 'Social', Icon: Share2 },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-blue" /> Treasurer
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Lunch ledger · income &amp; expense · chapter reports</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-full sm:w-fit mb-5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <t.Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden text-xs">{t.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {tab === 'ledger' && <LedgerTab members={members} ledger={ledger} refresh={fetchAll} startingBalance={startingBalance} />}
          {tab === 'transactions' && <TransactionsTab transactions={transactions} refresh={fetchAll} />}
          {tab === 'report' && <ReportTab members={members} ledger={ledger} transactions={transactions} userEmail={user.email} startingBalance={startingBalance} />}
          {tab === 'slides' && <SlidesTab members={members} ledger={ledger} transactions={transactions} speakers={speakers} startingBalance={startingBalance} pendingMembers={pendingMembers} refresh={fetchAll} />}
          {tab === 'speakers' && <SpeakersTab members={members} speakers={speakers} refresh={fetchAll} />}
          {tab === 'social' && <SocialTab members={members} speakers={speakers} social={social} refresh={fetchAll} />}
        </>
      )}
    </div>
  )
}

// ─── Ledger Tab ─────────────────────────────────────────────────────────────
function memberBalance(ledger: LedgerEntry[], name: string) {
  const mine = ledger.filter((e) => e.member_name === name)
  const charged = mine.filter((e) => e.type === 'charge' || e.type === 'opening').reduce((s, e) => s + e.amount, 0)
  const paid = mine.filter((e) => e.type === 'payment').reduce((s, e) => s + e.amount, 0)
  return { charged, paid, balance: charged - paid, entries: mine }
}

function LedgerTab({ members, ledger, refresh, startingBalance }: { members: Member[]; ledger: LedgerEntry[]; refresh: () => Promise<void>; startingBalance: number }) {
  const [mode, setMode] = useState<null | 'weekly' | 'payment'>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [entryForm, setEntryForm] = useState({ description: '', amount: '', date: '', notes: '', item: '', status: '' })
  const [entrySaving, setEntrySaving] = useState(false)

  const startEditEntry = (e: LedgerEntry) => {
    setEditingEntry(e)
    setEntryForm({ description: e.description, amount: String(e.amount), date: e.date, notes: e.notes || '', item: e.item || '', status: e.status })
  }

  const saveEntry = async () => {
    if (!editingEntry) return
    setEntrySaving(true)
    await fetch(`/api/treasurer/ledger?id=${editingEntry.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entryForm, amount: parseFloat(entryForm.amount) }),
    })
    setEntrySaving(false)
    setEditingEntry(null)
    await refresh()
  }

  const totalCharged = ledger.filter((e) => e.type === 'charge').reduce((s, e) => s + e.amount, 0)
  const totalOwed = members.reduce((s, m) => { const b = memberBalance(ledger, m.name).balance; return b > 0 ? s + b : s }, 0)
  const membersOwing = members.filter((m) => memberBalance(ledger, m.name).balance > 0).length

  const filtered = members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))

  const del = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/treasurer/ledger?id=${id}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Starting Balance" value={money(startingBalance)} accent="border-green-500" color="text-green-400" />
        <StatCard label="Total Charged" value={money(totalCharged)} accent="border-brand-blue" color="text-brand-blue" />
        <StatCard label="Outstanding" value={money(totalOwed)} accent="border-red-500" color="text-red-400" />
        <StatCard label="Members Owing" value={String(membersOwing)} accent="border-orange-500" color="text-orange-400" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member…"
          className={`${INPUT} max-w-48`} />
        <div className="flex gap-2">
          <button onClick={() => setMode(mode === 'weekly' ? null : 'weekly')} className={BTN_PRIMARY}>
            <DollarSign className="w-4 h-4" /> Weekly Bill
          </button>
          <button onClick={() => setMode(mode === 'payment' ? null : 'payment')}
            className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
            <Plus className="w-4 h-4" /> Payment
          </button>
        </div>
      </div>

      {mode === 'weekly' && <WeeklyBillForm members={members} onDone={async () => { setMode(null); await refresh() }} onCancel={() => setMode(null)} />}
      {mode === 'payment' && <PaymentForm members={members} ledger={ledger} onDone={async () => { setMode(null); await refresh() }} onCancel={() => setMode(null)} />}

      {/* Member rows */}
      <div className="space-y-2">
        {filtered.map((m) => {
          const { charged, paid, balance, entries } = memberBalance(ledger, m.name)
          const open = expanded === m.id
          const hasActivity = entries.length > 0
          const statusColor = !hasActivity ? 'text-gray-500' : balance > 0 ? 'text-red-400' : balance < 0 ? 'text-brand-blue' : 'text-green-400'
          const statusLabel = !hasActivity ? 'No activity' : balance > 0 ? `Owes ${money(balance)}` : balance < 0 ? `Credit ${money(Math.abs(balance))}` : 'Paid Up'
          return (
            <div key={m.id} className={CARD + ' overflow-hidden'}>
              <button onClick={() => setExpanded(open ? null : m.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition text-left">
                <div className="flex items-center gap-3">
                  {/* Avatar — photo or styled initials */}
                  <div className={`relative w-11 h-11 rounded-full shrink-0 overflow-hidden border-2 ${!hasActivity ? 'border-gray-700' : balance > 0 ? 'border-red-500/60' : balance < 0 ? 'border-brand-blue/60' : 'border-green-500/60'}`}>
                    {m.photo
                      ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#D81F2E,#9b1020)' }}>
                          {m.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                        </div>
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.company || ''}{m.company && entries.length > 0 ? ' · ' : ''}{entries.length > 0 ? `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}` : 'No entries'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block"><p className="text-xs text-gray-500">Paid</p><p className="text-sm text-green-400">{money(paid)}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-500">Balance</p><p className={`text-sm font-bold ${statusColor}`}>{statusLabel}</p></div>
                  {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </button>
              {open && (
                <div className="border-t border-gray-700 divide-y divide-gray-700/50">
                  {entries.length === 0 ? <p className="text-xs text-gray-500 px-4 py-3">No entries.</p> :
                    entries.sort((a, b) => (a.date > b.date ? -1 : 1)).map((e) => (
                      <div key={e.id}>
                        {editingEntry?.id === e.id ? (
                          /* ── Inline entry edit ── */
                          <div className="px-4 py-3 space-y-2 bg-gray-900/60">
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="block text-xs text-gray-500 mb-1">Description</label>
                                <input value={entryForm.description} onChange={(ev) => setEntryForm((f) => ({ ...f, description: ev.target.value }))} className={INPUT} />
                              </div>
                              <div><label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
                                <input type="number" step="0.01" value={entryForm.amount} onChange={(ev) => setEntryForm((f) => ({ ...f, amount: ev.target.value }))} className={INPUT} />
                              </div>
                              <div><label className="block text-xs text-gray-500 mb-1">Date</label>
                                <input type="date" value={entryForm.date} onChange={(ev) => setEntryForm((f) => ({ ...f, date: ev.target.value }))} onClick={(ev) => ev.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} />
                              </div>
                              <div><label className="block text-xs text-gray-500 mb-1">Status</label>
                                <select value={entryForm.status} onChange={(ev) => setEntryForm((f) => ({ ...f, status: ev.target.value }))} className={INPUT}>
                                  {['unpaid', 'paid', 'waived'].map((s) => <option key={s}>{s}</option>)}
                                </select>
                              </div>
                              <div><label className="block text-xs text-gray-500 mb-1">Dish (reference)</label>
                                <input value={entryForm.item} onChange={(ev) => setEntryForm((f) => ({ ...f, item: ev.target.value }))} placeholder="e.g. Bison Burger" className={INPUT} />
                              </div>
                              <div><label className="block text-xs text-gray-500 mb-1">Notes</label>
                                <input value={entryForm.notes} onChange={(ev) => setEntryForm((f) => ({ ...f, notes: ev.target.value }))} className={INPUT} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveEntry} disabled={entrySaving} className={BTN_PRIMARY}>{entrySaving ? 'Saving…' : 'Save'}</button>
                              <button onClick={() => setEditingEntry(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          /* ── Normal entry row ── */
                          <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200">{e.description}{e.item ? ` — ${e.item}` : ''}</p>
                              <p className="text-xs text-gray-500">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.type === 'payment' ? 'bg-green-500/15 text-green-400' : e.type === 'opening' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-red-500/15 text-red-400'}`}>
                              {e.type === 'payment' ? '+' : '-'}{money(e.amount)}
                            </span>
                            <button onClick={() => startEditEntry(e)} className="text-gray-600 hover:text-brand-blue transition"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => del(e.id)} className="text-gray-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  <div className="flex justify-end gap-6 px-4 py-2 bg-gray-900/40 text-xs text-gray-400">
                    <span>Charged: <strong className="text-gray-200">{money(charged)}</strong></span>
                    <span>Paid: <strong className="text-green-400">{money(paid)}</strong></span>
                    <span>Balance: <strong className={statusColor}>{money(balance)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type VisitorRow = { id: string; name: string; amount: string; item: string }
type ReceiptItem = { name: string; price?: number }

function WeeklyBillForm({ members, onDone, onCancel }: { members: Member[]; onDone: () => Promise<void>; onCancel: () => void }) {
  const [date, setDate] = useState(today())
  const [duesAmount, setDuesAmount] = useState(String(WEEKLY_DUES))
  const [lunchPrice, setLunchPrice] = useState(String(LUNCH_PRICE))
  // Who ate (→ $24 flat). Everyone else owes the $4 dues.
  const [ate, setAte] = useState<Record<string, boolean>>({})
  // Reference-only dish per member (shown at payment time).
  const [dish, setDish] = useState<Record<string, string>>({})
  const [visitors, setVisitors] = useState<VisitorRow[]>([])
  // Chapter food expense — editable, defaults to the receipt total.
  const [foodExpense, setFoodExpense] = useState('')
  // 50/50 raffle
  const [raffleIn, setRaffleIn] = useState('')
  const [raffleOut, setRaffleOut] = useState('')
  const [saving, setSaving] = useState(false)
  // Receipt paste
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptText, setReceiptText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [receiptMsg, setReceiptMsg] = useState('')

  const eaters = members.filter((m) => ate[m.id])
  const allAte = members.length > 0 && members.every((m) => ate[m.id])
  const price = parseFloat(lunchPrice) || 0
  const dues = parseFloat(duesAmount) || 0

  const lunchCharged = eaters.length * price
  const duesCharged = (members.length - eaters.length) * dues
  const memberChargeTotal = lunchCharged + duesCharged
  // Dues owed by the whole chapter this week ($4 each regardless of eating).
  const weeklyDuesOwed = members.length * dues

  const validVisitors = visitors.filter((v) => v.name.trim() && parseFloat(v.amount) > 0)
  const visitorTotal = validVisitors.reduce((s, v) => s + parseFloat(v.amount), 0)

  const raffleInNum = parseFloat(raffleIn) || 0
  const raffleOutNum = parseFloat(raffleOut) || 0
  const foodExpenseNum = parseFloat(foodExpense) || 0

  const canSubmit = members.length > 0 || validVisitors.length > 0 || raffleInNum > 0 || raffleOutNum > 0 || foodExpenseNum > 0

  const addVisitor = () => setVisitors((v) => [...v, { id: Math.random().toString(36).slice(2), name: '', amount: String(LUNCH_PRICE), item: '' }])
  const updateVisitor = (id: string, patch: Partial<VisitorRow>) => setVisitors((v) => v.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeVisitor = (id: string) => setVisitors((v) => v.filter((r) => r.id !== id))

  const parseReceiptText = async () => {
    if (!receiptText.trim()) return
    setParsing(true); setReceiptMsg('')
    try {
      const res = await fetch('/api/treasurer/receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: receiptText }),
      })
      const data = await res.json()
      if (!res.ok) { setReceiptMsg(data.error || 'Could not parse receipt.'); return }
      if (data.date) setDate(data.date)
      if (data.total) setFoodExpense(String(data.total))
      setReceiptItems(Array.isArray(data.items) ? data.items : [])
      const warn = Array.isArray(data.warnings) && data.warnings.length ? ' ⚠️ ' + data.warnings.join(' ') : ''
      setReceiptMsg(`Pulled total ${data.total ? money(data.total) : '—'} and ${data.items?.length ?? 0} items.${warn} Confirm the date & total below.`)
      setShowReceipt(false)
    } catch {
      setReceiptMsg('Receipt parsing failed. Enter the total manually below.')
    } finally {
      setParsing(false)
    }
  }

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)

    // 1) One charge per member ($24 eater incl. dues, else $4), plus visitors.
    if (members.length > 0 || validVisitors.length > 0) {
      await fetch('/api/treasurer/ledger', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklyBill: {
            date, dues, lunchPrice: price,
            members: members.map((m) => ({ member_id: m.id, member_name: m.name, ate: !!ate[m.id], item: dish[m.id] || '' })),
            visitors: validVisitors.map((v) => ({ name: v.name.trim(), amount: parseFloat(v.amount), item: v.item.trim() })),
          },
        }),
      })
    }

    // 2) Chapter food expense (receipt total — what the chapter pays the venue)
    if (foodExpenseNum > 0) {
      await fetch('/api/treasurer/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense', category: 'Weekly Lunch',
          description: `Weekly lunch — ${date} (${eaters.length} ate)`,
          amount: foodExpenseNum, date,
        }),
      })
    }

    // 3) 50/50 raffle
    if (raffleInNum > 0) {
      await fetch('/api/treasurer/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'income', category: '50/50 Collected', description: `50/50 raffle collected — ${date}`, amount: raffleInNum, date }),
      })
    }
    if (raffleOutNum > 0) {
      await fetch('/api/treasurer/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expense', category: '50/50 Payout', description: `50/50 raffle paid out — ${date}`, amount: raffleOutNum, date }),
      })
    }

    setSaving(false)
    await onDone()
  }

  return (
    <div className={CARD + ' p-4 space-y-4'}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Weekly Meeting Entry</h3>
        <button onClick={() => setShowReceipt((v) => !v)} className="text-xs text-brand-blue hover:underline">{showReceipt ? 'Hide receipt' : 'Paste receipt'}</button>
      </div>

      {/* Receipt paste helper */}
      {showReceipt && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2">
          <p className="text-xs text-gray-500">Paste the lunch receipt — AI pulls the date, total, and item list. You confirm before posting.</p>
          <textarea value={receiptText} onChange={(e) => setReceiptText(e.target.value)} rows={5} placeholder="Paste Toast receipt text here…" className={`${INPUT} font-mono text-xs`} />
          <button onClick={parseReceiptText} disabled={parsing || !receiptText.trim()} className={BTN_PRIMARY}>
            {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : 'Parse Receipt'}
          </button>
        </div>
      )}
      {receiptMsg && <p className="text-xs text-yellow-400">{receiptMsg}</p>}

      <div className="flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs text-gray-500 mb-1">Meeting Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Ate ($/eater)</label><input type="number" step="0.01" value={lunchPrice} onChange={(e) => setLunchPrice(e.target.value)} className={`${INPUT} w-24`} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Dues ($/non-eater)</label><input type="number" step="0.01" value={duesAmount} onChange={(e) => setDuesAmount(e.target.value)} className={`${INPUT} w-28`} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Receipt total ($)</label><input type="number" step="0.01" value={foodExpense} onChange={(e) => setFoodExpense(e.target.value)} placeholder="121.35" className={`${INPUT} w-28`} /></div>
      </div>

      {/* Charge summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5">{eaters.length} ate → <span className="font-bold text-green-400">{money(lunchCharged)}</span></span>
        <span className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1.5">{members.length - eaters.length} dues-only → <span className="font-bold text-orange-400">{money(duesCharged)}</span></span>
        <span className="bg-brand-blue/10 border border-brand-blue/30 rounded-lg px-3 py-1.5">Member charges → <span className="font-bold text-brand-blue">{money(memberChargeTotal)}</span></span>
      </div>

      {/* Who ate — each eater can tag a dish from the receipt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Who ate lunch? <span className="text-gray-600">(eaters charged {money(price)} flat · everyone else {money(dues)} dues)</span></span>
          <button onClick={() => { if (allAte) { setAte({}) } else { setAte(Object.fromEntries(members.map((m) => [m.id, true]))) } }} className="text-xs text-brand-blue hover:underline">{allAte ? 'Clear All' : 'Select All'}</button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {members.map((m) => {
            const isEater = !!ate[m.id]
            return (
              <div key={m.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border text-sm ${isEater ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-900 border-gray-700'}`}>
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input type="checkbox" checked={isEater} onChange={() => setAte((s) => ({ ...s, [m.id]: !s[m.id] }))} className="accent-green-500" />
                  <span className={`truncate ${isEater ? 'text-gray-200' : 'text-gray-400'}`}>{m.name}</span>
                </label>
                <span className={`text-xs font-semibold ${isEater ? 'text-green-400' : 'text-orange-400'}`}>{money(isEater ? price : dues)}</span>
                {isEater && (
                  receiptItems.length > 0 ? (
                    <select value={dish[m.id] ?? ''} onChange={(e) => setDish((d) => ({ ...d, [m.id]: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-300 px-2 py-1 max-w-[11rem]">
                      <option value="">— dish —</option>
                      {receiptItems.map((it, i) => <option key={i} value={it.name}>{it.name}</option>)}
                    </select>
                  ) : (
                    <input value={dish[m.id] ?? ''} onChange={(e) => setDish((d) => ({ ...d, [m.id]: e.target.value }))} placeholder="dish (optional)" className="bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-300 px-2 py-1 w-32" />
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Visitors who ate */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Visitors who ate {visitorTotal > 0 && <span className="text-gray-400">· {money(visitorTotal)}</span>}</span>
          <button onClick={addVisitor} className="text-xs text-brand-blue hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add visitor</button>
        </div>
        {visitors.length === 0 ? (
          <p className="text-xs text-gray-600">No visitors added.</p>
        ) : (
          <div className="space-y-2">
            {visitors.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <input value={v.name} onChange={(e) => updateVisitor(v.id, { name: e.target.value })} placeholder="Visitor name" className={`${INPUT} flex-1`} />
                <input value={v.item} onChange={(e) => updateVisitor(v.id, { item: e.target.value })} placeholder="dish (optional)" className={`${INPUT} w-32`} />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">$</span>
                  <input type="number" step="0.01" value={v.amount} onChange={(e) => updateVisitor(v.id, { amount: e.target.value })} placeholder="0.00" className={`${INPUT} w-24`} />
                </div>
                <button onClick={() => removeVisitor(v.id)} className="text-gray-600 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 50/50 raffle */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">50/50 Collected ($)</label><input type="number" step="0.01" value={raffleIn} onChange={(e) => setRaffleIn(e.target.value)} placeholder="0.00" className={INPUT} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">50/50 Paid out ($)</label><input type="number" step="0.01" value={raffleOut} onChange={(e) => setRaffleOut(e.target.value)} placeholder="0.00" className={INPUT} /></div>
      </div>

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !canSubmit} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Post Weekly Entry'}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
      </div>
    </div>
  )
}

function PaymentForm({ members, ledger, onDone, onCancel }: { members: Member[]; ledger: LedgerEntry[]; onDone: () => Promise<void>; onCancel: () => void }) {
  const [who, setWho] = useState<'member' | 'visitor'>('member')
  const [form, setForm] = useState({ member_id: '', visitorName: '', date: today(), amount: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Visitor names seen on the ledger (charges with no member link), newest first.
  const visitorNames = Array.from(
    new Map(
      ledger
        .filter((e) => e.member_id === null && e.type === 'charge')
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((e) => [e.member_name, true])
    ).keys()
  )

  const payerName = who === 'member'
    ? members.find((m) => m.id === form.member_id)?.name
    : form.visitorName.trim()

  const canSubmit = !!payerName && !!form.amount && !isNaN(parseFloat(form.amount))

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    const amount = parseFloat(form.amount)
    await fetch('/api/treasurer/ledger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: who === 'member' ? form.member_id : null,
        member_name: payerName,
        type: 'payment', amount, date: form.date,
        description: who === 'member' ? 'Payment / Prepay' : 'Visitor Payment',
        status: 'paid', notes: form.notes,
      }),
    })
    await fetch('/api/treasurer/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'income',
        category: who === 'member' ? 'Member Payment' : 'Guest Fee',
        description: `${who === 'member' ? 'Payment' : 'Visitor payment'} from ${payerName}`,
        amount, date: form.date,
      }),
    })
    setSaving(false)
    await onDone()
  }

  return (
    <div className={CARD + ' p-4 space-y-4'}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Record {who === 'member' ? 'Member' : 'Visitor'} Payment</h3>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['member', 'visitor'] as const).map((w) => (
            <button key={w} onClick={() => setWho(w)} className={`px-3 py-1.5 text-xs font-medium capitalize transition ${who === w ? 'bg-brand-blue text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>{w}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {who === 'member' ? (
          <div><label className="block text-xs text-gray-500 mb-1">Member</label>
            <select value={form.member_id} onChange={(e) => setForm((f) => ({ ...f, member_id: e.target.value }))} className={INPUT}>
              <option value="">Select…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        ) : (
          <div><label className="block text-xs text-gray-500 mb-1">Visitor</label>
            <input list="visitor-names" value={form.visitorName} onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))} placeholder="Visitor name" className={INPUT} />
            <datalist id="visitor-names">{visitorNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
        )}
        <div><label className="block text-xs text-gray-500 mb-1">Date</label><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} onClick={(e) => e.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount ($)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="125.00" className={INPUT} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Notes</label><input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Cash, Venmo…" className={INPUT} /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !canSubmit} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Record Payment'}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
      </div>
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ transactions, refresh }: { transactions: Transaction[]; refresh: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [editForm, setEditForm] = useState({ type: 'income' as 'income' | 'expense', category: '', description: '', amount: '', date: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)

  const startEdit = (t: Transaction) => {
    setEditing(t)
    setEditForm({ type: t.type, category: t.category, description: t.description, amount: String(t.amount), date: t.date, notes: t.notes || '' })
  }

  const saveEdit = async () => {
    if (!editing) return
    setEditSaving(true)
    await fetch(`/api/treasurer/transactions?id=${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, amount: parseFloat(editForm.amount) }),
    })
    setEditSaving(false)
    setEditing(null)
    await refresh()
  }

  const filtered = transactions.filter((t) => filter === 'all' || t.type === filter)
  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense

  const del = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/treasurer/transactions?id=${id}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Income" value={money(income)} accent="border-green-500" color="text-green-400" />
        <StatCard label="Expenses" value={money(expense)} accent="border-red-500" color="text-red-400" />
        <StatCard label="Net" value={`${net >= 0 ? '+' : ''}${money(net)}`} accent={net >= 0 ? 'border-brand-blue' : 'border-orange-500'} color={net >= 0 ? 'text-brand-blue' : 'text-orange-400'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['all', 'income', 'expense'] as const).map((v) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-2 text-xs font-medium capitalize transition ${filter === v ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>{v}</button>
          ))}
        </div>
        <button onClick={() => setShowForm((v) => !v)} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Add Transaction</button>
      </div>

      {showForm && <TransactionForm onDone={async () => { setShowForm(false); await refresh() }} onCancel={() => setShowForm(false)} />}

      <div className="space-y-2">
        {filtered.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">No transactions yet.</p> :
          filtered.map((t) => (
            <div key={t.id} className={CARD + ' overflow-hidden'}>
              {editing?.id === t.id ? (
                /* ── Inline edit form ── */
                <div className="px-4 py-3 space-y-3">
                  <div className="flex rounded-lg overflow-hidden border border-gray-700 w-fit">
                    {(['income', 'expense'] as const).map((ty) => (
                      <button key={ty} onClick={() => setEditForm((f) => ({ ...f, type: ty, category: ty === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}
                        className={`px-4 py-1.5 text-xs font-medium capitalize transition ${editForm.type === ty ? (ty === 'income' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-900 text-gray-500'}`}>{ty}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs text-gray-500 mb-1">Category</label>
                      <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className={INPUT}>
                        {(editForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} onClick={(ev) => ev.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} />
                    </div>
                    <div><label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
                      <input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className={INPUT} />
                    </div>
                    <div><label className="block text-xs text-gray-500 mb-1">Description</label>
                      <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className={INPUT} />
                    </div>
                    <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Notes</label>
                      <input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" className={INPUT} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={editSaving} className={BTN_PRIMARY}>{editSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditing(null)} className="px-3 py-2 text-xs text-gray-400 hover:text-white transition">Cancel</button>
                  </div>
                </div>
              ) : (
                /* ── Normal row ── */
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">{t.description || t.category}</p>
                    <p className="text-xs text-gray-500">{t.category} · {t.date}{t.notes ? ` · ${t.notes}` : ''}</p>
                  </div>
                  <p className={`text-sm font-bold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</p>
                  <button onClick={() => startEdit(t)} className="text-gray-600 hover:text-brand-blue transition"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(t.id)} className="text-gray-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

function TransactionForm({ onDone, onCancel }: { onDone: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ type: 'income' as 'income' | 'expense', category: 'Member Payment', description: '', amount: '', date: today(), notes: '' })
  const [saving, setSaving] = useState(false)
  const cats = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const submit = async () => {
    if (!form.amount) return
    setSaving(true)
    await fetch('/api/treasurer/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    setSaving(false)
    await onDone()
  }

  return (
    <div className={CARD + ' p-4 space-y-4'}>
      <div className="flex rounded-lg overflow-hidden border border-gray-700 w-fit">
        {(['income', 'expense'] as const).map((ty) => (
          <button key={ty} onClick={() => setForm((f) => ({ ...f, type: ty, category: ty === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}
            className={`px-5 py-2 text-sm font-medium capitalize transition ${form.type === ty ? (ty === 'income' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-900 text-gray-500'}`}>{ty}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">Category</label><select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={INPUT}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Date</label><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={INPUT} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount ($)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={INPUT} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Description</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={INPUT} /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Add Transaction'}</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition">Cancel</button>
      </div>
    </div>
  )
}

// ─── Report Tab ─────────────────────────────────────────────────────────────
function ReportTab({ members, ledger, transactions, userEmail, startingBalance }: { members: Member[]; ledger: LedgerEntry[]; transactions: Transaction[]; userEmail: string; startingBalance: number }) {
  const [showPreview, setShowPreview] = useState(false)
  const [sent, setSent] = useState('')

  const statements = useMemo(() => members.map((m) => {
    const { charged, paid, balance, entries } = memberBalance(ledger, m.name)
    return { name: m.name, charged, paid, balance, hasActivity: entries.length > 0 }
  }).sort((a, b) => b.balance - a.balance), [members, ledger])

  const totalOwed = statements.reduce((s, m) => (m.balance > 0 ? s + m.balance : s), 0)
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTxs = transactions.filter((t) => t.date?.startsWith(monthKey))
  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense

  const exportCSV = () => {
    const rows = [['Member', 'Charged', 'Paid', 'Balance', 'Status'], ...statements.map((m) => [m.name, m.charged.toFixed(2), m.paid.toFixed(2), m.balance.toFixed(2), !m.hasActivity ? 'No activity' : m.balance > 0 ? 'Owes' : m.balance < 0 ? 'Credit' : 'Paid Up'])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `treasurer-report-${monthKey}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  // Line-item export — one row per charge/payment, includes the dish for cross-reference.
  const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const exportLineItems = () => {
    const header = ['Date', 'Member', 'Type', 'Description', 'Dish', 'Amount', 'Status']
    const lines = [...ledger]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => [e.date, e.member_name, e.type, e.description, e.item ?? '', e.amount.toFixed(2), e.status].map(csvCell).join(','))
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `treasurer-line-items-${monthKey}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {showPreview && <ReportPreviewModal statements={statements} totalOwed={totalOwed} income={income} expense={expense} net={net} startingBalance={startingBalance} defaultTo={userEmail} onClose={() => setShowPreview(false)} onSent={(to) => { setSent(`Report sent to ${to}`); setShowPreview(false) }} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-brand-blue" /> Treasury Report</span>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"><Download className="w-4 h-4" /> Export CSV</button>
          <button onClick={() => setShowPreview(true)} className={BTN_PRIMARY}><Mail className="w-4 h-4" /> Preview &amp; Send</button>
        </div>
      </div>

      {sent && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400 flex items-center justify-between"><span>✓ {sent}</span><button onClick={() => setSent('')}><X className="w-4 h-4" /></button></div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Starting Balance" value={money(startingBalance)} accent="border-green-500" color="text-green-400" />
        <StatCard label="Outstanding" value={money(totalOwed)} accent="border-red-500" color="text-red-400" />
        <StatCard label="Income (mo)" value={money(income)} accent="border-brand-blue" color="text-brand-blue" />
        <StatCard label="Net (mo)" value={`${net >= 0 ? '+' : ''}${money(net)}`} accent={net >= 0 ? 'border-purple-500' : 'border-orange-500'} color={net >= 0 ? 'text-purple-400' : 'text-orange-400'} />
      </div>

      <MemberBalances statements={statements} />
    </div>
  )
}

function MemberBalances({ statements }: { statements: { name: string; charged: number; paid: number; balance: number; hasActivity: boolean }[] }) {
  const [owingOnly, setOwingOnly] = useState(false)
  const owingCount = statements.filter((m) => m.balance > 0).length
  const shown = owingOnly ? statements.filter((m) => m.balance > 0) : statements

  const badge = (m: typeof statements[number]) => {
    if (!m.hasActivity) return { text: '—', cls: 'text-gray-600' }
    if (m.balance > 0) return { text: money(m.balance), cls: 'text-red-400' }
    if (m.balance < 0) return { text: `+${money(Math.abs(m.balance))}`, cls: 'text-brand-blue' }
    return { text: 'Paid', cls: 'text-green-400' }
  }

  return (
    <div className={CARD + ' overflow-hidden'}>
      <div className="px-4 py-2.5 border-b border-gray-700 bg-gray-900/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Member Balances</h3>
        <button
          onClick={() => setOwingOnly((v) => !v)}
          className={`text-xs px-2.5 py-1 rounded-md border transition ${owingOnly ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'border-gray-700 text-gray-400 hover:text-gray-200'}`}
        >
          {owingOnly ? `Showing owing (${owingCount})` : `Owing only (${owingCount})`}
        </button>
      </div>
      {/* Compact multi-column grid — name + balance chip only; full breakdown lives in the ledger tab */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5 p-3">
        {shown.map((m) => {
          const b = badge(m)
          return (
            <div key={m.name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-800/40">
              <span className="text-sm text-gray-300 truncate pr-2">{m.name}</span>
              <span className={`text-sm font-semibold tabular-nums ${b.cls}`}>{b.text}</span>
            </div>
          )
        })}
      </div>
      {shown.length === 0 && <p className="text-xs text-gray-500 px-4 pb-3">No members owing — all paid up. 🎉</p>}
    </div>
  )
}

function ReportPreviewModal({ statements, totalOwed, income, expense, net, startingBalance, defaultTo, onClose, onSent }: {
  statements: { name: string; charged: number; paid: number; balance: number; hasActivity: boolean }[]
  totalOwed: number; income: number; expense: number; net: number; startingBalance: number; defaultTo: string
  onClose: () => void; onSent: (to: string) => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setSending(true); setError('')
    try {
      const res = await fetch('/api/treasurer/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) })
      const data = await res.json()
      if (data.success) onSent(data.to)
      else setError(data.error || 'Send failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-brand-blue" /> Preview Treasurer Report</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-gray-900 rounded-lg py-2"><p className="text-xs text-gray-500">Start Bal</p><p className="text-green-400 font-bold">{money(startingBalance)}</p></div>
            <div className="bg-gray-900 rounded-lg py-2"><p className="text-xs text-gray-500">Outstanding</p><p className="text-red-400 font-bold">{money(totalOwed)}</p></div>
            <div className="bg-gray-900 rounded-lg py-2"><p className="text-xs text-gray-500">Income</p><p className="text-brand-blue font-bold">{money(income)}</p></div>
            <div className="bg-gray-900 rounded-lg py-2"><p className="text-xs text-gray-500">Net</p><p className={`font-bold ${net >= 0 ? 'text-purple-400' : 'text-orange-400'}`}>{net >= 0 ? '+' : ''}{money(net)}</p></div>
          </div>
          <div className="bg-gray-900 rounded-lg divide-y divide-gray-800">
            {statements.map((m) => (
              <div key={m.name} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-gray-300">{m.name}</span>
                <span className={!m.hasActivity ? 'text-gray-500' : m.balance > 0 ? 'text-red-400' : m.balance < 0 ? 'text-brand-blue' : 'text-green-400'}>
                  {!m.hasActivity ? 'No activity' : m.balance > 0 ? `Owes ${money(m.balance)}` : m.balance < 0 ? `Credit ${money(Math.abs(m.balance))}` : 'Paid Up'}
                </span>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Send To</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">{error}</div>}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-700">
          <button onClick={send} disabled={sending} className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-blue/90 transition disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{sending ? 'Sending…' : 'Confirm & Send'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:bg-gray-800 transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, color, sub }: { label: string; value: string; accent: string; color: string; sub?: string }) {
  return (
    <div className={`bg-gray-800/60 border border-gray-700 border-l-4 ${accent} rounded-xl p-3 sm:p-4`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg sm:text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Slides Tab ─────────────────────────────────────────────────────────────
function CopyBox({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div className={CARD + ' overflow-hidden'}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gray-900/40">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition">
          {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
        </button>
      </div>
      <pre className="px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">{text}</pre>
    </div>
  )
}

/** "2026-10-01" → "October 1" */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[m - 1]} ${d}`
}

function SlidesTab({ members, ledger, transactions, speakers, startingBalance, pendingMembers, refresh }: {
  members: Member[]; ledger: LedgerEntry[]; transactions: Transaction[]; speakers: Speaker[]
  startingBalance: number; pendingMembers: string[]; refresh: () => Promise<void>
}) {
  const [pushing, setPushing] = useState(false)
  const [pushMsg, setPushMsg] = useState('')

  const pushToSlides = async () => {
    setPushing(true); setPushMsg('')
    try {
      const res = await fetch('/api/treasurer/slides/push', { method: 'POST' })
      const data = await res.json()
      setPushMsg(res.ok ? `✓ Pushed to Google Slides (${data.pushedTokens} fields updated).` : `⚠️ ${data.error || 'Push failed.'}`)
    } catch {
      setPushMsg('⚠️ Push failed — check your network.')
    } finally {
      setPushing(false)
    }
  }

  // Toggle a member's manual "Pending" flag (persisted via settings API).
  const togglePending = async (memberId: string) => {
    const next = pendingMembers.includes(memberId)
      ? pendingMembers.filter((id) => id !== memberId)
      : [...pendingMembers, memberId]
    await fetch('/api/treasurer/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingMembers: next }),
    })
    await refresh()
  }

  // ── Slide 93: per-member status ──────────────────────────────
  const slide93 = members.map((m) => {
    const { balance } = memberBalance(ledger, m.name)
    let status: string
    if (pendingMembers.includes(m.id)) status = 'Pending'
    else if (balance > 0) status = `$${balance.toFixed(2)} due`
    else status = 'Paid'
    return { name: m.name, status }
  })
  const slide93Text = slide93.map((r) => `${r.name}\n${r.status}`).join('\n')

  // ── Slide 94: chapter summary (all-time running) ─────────────
  const duesCollected = transactions
    .filter((t) => t.type === 'income' && (t.category === 'Member Payment' || t.category === 'Dues'))
    .reduce((s, t) => s + t.amount, 0)
  const raffleIn = transactions.filter((t) => t.type === 'income' && t.category === '50/50 Collected').reduce((s, t) => s + t.amount, 0)
  const raffleOut = transactions.filter((t) => t.type === 'expense' && t.category === '50/50 Payout').reduce((s, t) => s + t.amount, 0)
  const chapterExpenses = transactions.filter((t) => t.type === 'expense' && t.category !== '50/50 Payout').reduce((s, t) => s + t.amount, 0)
  const totalInAccount = startingBalance + duesCollected + raffleIn - chapterExpenses - raffleOut

  const pad = (label: string) => (label + ' ').padEnd(20, ' ')
  const slide94Text = [
    `${pad('Starting Balance')}$${startingBalance.toFixed(2)}`,
    `${pad('Dues Collected')}$${duesCollected.toFixed(2)}`,
    `${pad('50/50 Collected')}$${raffleIn.toFixed(2)}`,
    `${pad('Chapter Expenses')}$${chapterExpenses.toFixed(2)}`,
    `${pad('50/50 Paid out')}$${raffleOut.toFixed(2)}`,
    `${pad('Total in Account')}$${totalInAccount.toFixed(2)}`,
  ].join('\n')

  // ── Slide 95: speaker rotation (next 4 upcoming) ─────────────
  const todayIso = today()
  const upcoming = [...speakers]
    .filter((s) => s.date >= todayIso)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4)
  const slide95Rows = upcoming.length > 0 ? upcoming : [...speakers].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-4)
  const slide95Text = slide95Rows.map((s) => `${longDate(s.date)}\t${s.name}`).join('\n')

  return (
    <div className="space-y-4">
      {/* Push to Google Slides */}
      <div className={CARD + ' p-4 flex flex-wrap items-center justify-between gap-3'}>
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Presentation className="w-4 h-4 text-brand-blue" /> Push to Google Slides</h3>
          <p className="text-xs text-gray-500 mt-0.5">Updates slides 93/94/95 in the deck directly. Requires the deck set up with placeholder tokens.</p>
          {pushMsg && <p className={`text-xs mt-1 ${pushMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>{pushMsg}</p>}
        </div>
        <button onClick={pushToSlides} disabled={pushing} className={BTN_PRIMARY}>
          {pushing ? <><Loader2 className="w-4 h-4 animate-spin" /> Pushing…</> : <><Send className="w-4 h-4" /> Push to Slides</>}
        </button>
      </div>

      <p className="text-xs text-gray-500">Or copy each block below and paste it onto the matching slide. Numbers update automatically from the ledger &amp; transactions.</p>

      {/* Slide 93 with pending toggles */}
      <div className={CARD + ' p-3'}>
        <p className="text-xs text-gray-500 mb-2">Tap a name to mark/unmark <span className="text-yellow-400">Pending</span>.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {members.map((m) => {
            const { balance } = memberBalance(ledger, m.name)
            const isPending = pendingMembers.includes(m.id)
            const label = isPending ? 'Pending' : balance > 0 ? `$${balance.toFixed(2)} due` : 'Paid'
            const color = isPending ? 'text-yellow-400' : balance > 0 ? 'text-red-400' : 'text-green-400'
            return (
              <button key={m.id} onClick={() => togglePending(m.id)}
                className="text-left rounded-lg px-2.5 py-1.5 border border-gray-700 bg-gray-900 hover:border-gray-600 transition">
                <span className="block text-xs text-gray-200 truncate">{m.name}</span>
                <span className={`block text-xs font-semibold ${color}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <CopyBox title="Slide 93 — Member Dues Status" text={slide93Text} />
      <CopyBox title="Slide 94 — Chapter Summary" text={slide94Text} />
      <CopyBox title="Slide 95 — Speaker Rotation" text={slide95Text || 'No speakers scheduled. Add them in the Speakers tab.'} />
    </div>
  )
}

// ─── Speakers Tab ───────────────────────────────────────────────────────────
function SpeakersTab({ members, speakers, refresh }: { members: Member[]; speakers: Speaker[]; refresh: () => Promise<void> }) {
  const [date, setDate] = useState(today())
  const [memberId, setMemberId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!date) return
    const member = members.find((m) => m.id === memberId)
    const name = member?.name || guestName.trim() || 'Speaker Name'
    setSaving(true)
    await fetch('/api/treasurer/speakers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, member_id: member?.id ?? null, name }),
    })
    setSaving(false)
    setMemberId(''); setGuestName('')
    await refresh()
  }

  const del = async (id: string) => {
    if (!confirm('Remove this speaker slot?')) return
    await fetch(`/api/treasurer/speakers?id=${id}`, { method: 'DELETE' })
    await refresh()
  }

  const sorted = [...speakers].sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <div className="space-y-4">
      <div className={CARD + ' p-4 space-y-3'}>
        <h3 className="text-sm font-semibold text-white">Add / Update Speaker</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Meeting Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} /></div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Member</label>
            <select value={memberId} onChange={(e) => { setMemberId(e.target.value); if (e.target.value) setGuestName('') }} className={INPUT}>
              <option value="">— pick member —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">or Guest name</label><input value={guestName} onChange={(e) => { setGuestName(e.target.value); if (e.target.value) setMemberId('') }} placeholder="Guest speaker" className={INPUT} /></div>
        </div>
        <button onClick={add} disabled={saving} className={BTN_PRIMARY}>{saving ? 'Saving…' : 'Save Speaker'}</button>
      </div>

      <div className={CARD + ' overflow-hidden'}>
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/40"><h3 className="text-sm font-semibold text-white">Speaker Rotation</h3></div>
        <div className="divide-y divide-gray-700/50">
          {sorted.length === 0 ? <p className="text-sm text-gray-500 px-4 py-6 text-center">No speakers scheduled yet.</p> :
            sorted.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-28">{longDate(s.date)}</span>
                  <span className="text-sm text-gray-100">{s.name}</span>
                </div>
                <button onClick={() => del(s.id)} className="text-gray-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ─── Social Tab ─────────────────────────────────────────────────────────────
const MEETING_LINE = 'Think Big St. Louis · Thursdays 11:30 AM · Mike Duffy\'s Pub & Grill, Kirkwood'
const MEETING_LINE_SHORT = "Thursdays 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood"

const SOCIAL_TYPES = [
  { id: 'meeting_promo', label: 'Weekly Meeting Promo' },
  { id: 'speaker', label: 'Speaker of the Week' },
  { id: 'spotlight', label: 'Member Spotlight' },
  { id: 'visitor_invite', label: 'Visitor-Day Invite' },
  { id: 'win', label: 'Win / Testimonial' },
  { id: 'open_seats', label: 'Open Seats — Who We\'re Looking For' },
  { id: 'custom', label: 'Custom' },
] as const

const PLATFORM_LABEL: Record<string, string> = { facebook: 'Facebook', linkedin: 'LinkedIn', instagram: 'Instagram' }

/** Build a caption from chapter data for the chosen post type. */
function generateCaption(opts: {
  type: string
  members: Member[]
  speakers: Speaker[]
  spotlightId?: string
  winText?: string
  openSeats?: string[]
}): string {
  const { type, members, speakers, spotlightId, winText, openSeats } = opts
  const todayIso = today()

  switch (type) {
    case 'meeting_promo':
      return [
        '📣 Join us this Thursday!',
        '',
        `${MEETING_LINE}.`,
        '',
        'Come see how our chapter of trusted local business professionals passes real referrals every week. Guests always welcome — bring your card and an appetite.',
        '',
        '#BNI #ThinkBigStL #Networking #Referrals #StLouisBusiness',
      ].join('\n')

    case 'speaker': {
      const next = [...speakers].filter((s) => s.date >= todayIso).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
      const name = next?.name && next.name !== 'Speaker Name' ? next.name : 'our featured member'
      const member = members.find((m) => m.id === next?.member_id)
      const biz = member?.company ? ` of ${member.company}` : ''
      const when = next ? ` on ${longDate(next.date)}` : ' this week'
      return [
        '🎤 Speaker of the Week',
        '',
        `This week${when} we're excited to hear from ${name}${biz}!`,
        '',
        `Join us — ${MEETING_LINE}.`,
        '',
        '#BNI #ThinkBigStL #FeaturedSpeaker #StLouisBusiness',
      ].join('\n')
    }

    case 'spotlight': {
      const m = members.find((x) => x.id === spotlightId) ?? members[0]
      if (!m) return 'Add members first to generate a spotlight.'
      const roleBiz = [m.role, m.company].filter(Boolean).join(' · ')
      return [
        '🌟 Member Spotlight',
        '',
        `Meet ${m.name}${roleBiz ? ` — ${roleBiz}` : ''}.`,
        '',
        `${m.name} is a valued part of Think Big St. Louis, helping our members and community grow through trusted referrals. Need ${m.role || 'their expertise'}? Reach out — we\'ve got you covered.`,
        '',
        '#MemberSpotlight #BNI #ThinkBigStL #SupportLocal',
      ].join('\n')
    }

    case 'visitor_invite':
      return [
        '👋 You\'re Invited — Visitor Day!',
        '',
        `Curious about BNI? Come be our guest. ${MEETING_LINE}.`,
        '',
        'Meet local business owners, learn how referral networking works, and enjoy a great lunch. No pressure — just good connections.',
        '',
        'Message us to reserve your seat 👇',
        '',
        '#VisitorDay #BNI #ThinkBigStL #Networking #StLouis',
      ].join('\n')

    case 'win':
      return [
        '🎉 Chapter Win!',
        '',
        winText?.trim() || 'Another closed referral inside Think Big St. Louis — members helping members win real business.',
        '',
        `This is what shows up every Thursday. ${MEETING_LINE}.`,
        '',
        '#ChapterWin #BNI #ThinkBigStL #Referrals #StLouisBusiness',
      ].join('\n')

    case 'open_seats': {
      const seats = (openSeats ?? []).filter(Boolean)
      const list = seats.length ? seats.map((s) => `• ${s}`).join('\n') : '• (loading open categories…)'
      return [
        '🪑 Open Seats — We\'re Looking For You!',
        '',
        'Our chapter holds just ONE seat per profession — and these categories are wide open:',
        '',
        list,
        '',
        `If that\'s your business, this is an exclusive referral opportunity with no competition inside the room. Come claim your seat — ${MEETING_LINE}.`,
        '',
        '#BNI #ThinkBigStL #OpenSeat #StLouisBusiness #Referrals #GrowYourBusiness',
      ].join('\n')
    }

    default:
      return ''
  }
}

function SocialTab({ members, speakers, social, refresh }: {
  members: Member[]; speakers: Speaker[]; social: SocialPost[]; refresh: () => Promise<void>
}) {
  const [type, setType] = useState<string>('meeting_promo')
  const [platform, setPlatform] = useState<'facebook' | 'linkedin' | 'instagram'>('facebook')
  const [date, setDate] = useState(today())
  const [spotlightId, setSpotlightId] = useState('')
  const [speakerMemberId, setSpeakerMemberId] = useState('')
  const [savingSpeaker, setSavingSpeaker] = useState(false)
  const [winText, setWinText] = useState('')
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [openSeats, setOpenSeats] = useState<string[]>([])

  // Load the open/unfilled seats (slide #79 — "who we're looking for").
  useEffect(() => {
    fetch('/api/seats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const seats = Array.isArray(data) ? data : data?.seats
        if (Array.isArray(seats)) {
          setOpenSeats(seats.filter((s: { status: string }) => s.status === 'open' || s.status === 'paused' || s.status === 'active').map((s: { profession: string }) => s.profession))
        }
      })
      .catch(() => {})
  }, [])

  const regenerate = () => {
    setContent(generateCaption({ type, members, speakers, spotlightId: spotlightId || members[0]?.id, winText, openSeats }))
  }

  // Auto-generate the template caption whenever the inputs change (fallback/base).
  useEffect(() => {
    setContent(generateCaption({ type, members, speakers, spotlightId: spotlightId || members[0]?.id, winText, openSeats }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, spotlightId, winText, members, speakers, openSeats])

  // Build the facts the AI is allowed to use from current chapter data.
  const buildFacts = () => {
    // For speaker posts: find the speaker assigned to the planned date (or closest upcoming)
    const plannedSpeaker = type === 'speaker'
      ? (speakers.find((s) => s.date === date) || [...speakers].filter((s) => s.date >= date).sort((a, b) => (a.date < b.date ? -1 : 1))[0])
      : [...speakers].filter((s) => s.date >= today()).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    const speakerMember = members.find((m) => m.id === plannedSpeaker?.member_id)
    const spot = members.find((m) => m.id === spotlightId) ?? members[0]
    return {
      chapterName: 'Think Big St. Louis',
      meetingLine: "Thursdays 11:30 AM at Mike Duffy's Pub & Grill, Kirkwood",
      speakerName: plannedSpeaker && plannedSpeaker.name !== 'Speaker Name' ? plannedSpeaker.name : undefined,
      speakerCompany: speakerMember?.company || undefined,
      speakerDate: plannedSpeaker ? longDate(plannedSpeaker.date) : undefined,
      spotlightName: type === 'spotlight' ? spot?.name : undefined,
      spotlightRole: type === 'spotlight' ? spot?.role : undefined,
      spotlightCompany: type === 'spotlight' ? spot?.company : undefined,
      winText: type === 'win' ? winText.trim() || undefined : undefined,
      openSeats: type === 'open_seats' && openSeats.length ? openSeats.join(', ') : undefined,
    }
  }

  // Build the BNI-branded graphic card for the current post type.
  const graphicData = ((): GraphicData => {
    const plannedSpeaker = type === 'speaker'
      ? (speakers.find((s) => s.date === date) || [...speakers].filter((s) => s.date >= date).sort((a, b) => (a.date < b.date ? -1 : 1))[0])
      : [...speakers].filter((s) => s.date >= today()).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    const speakerMember = members.find((m) => m.id === plannedSpeaker?.member_id)
    const spot = members.find((m) => m.id === spotlightId) ?? members[0]
    switch (type) {
      case 'open_seats':
        return { kind: 'open_seats' as const, title: 'Seats Open', subtitle: 'One business per profession — exclusive, no competition.', lines: openSeats.slice(0, 8), caption: content || undefined, footerCta: `Claim your seat · ${MEETING_LINE_SHORT}` }
      case 'speaker': {
        const sName = plannedSpeaker && plannedSpeaker.name !== 'Speaker Name' ? plannedSpeaker.name : 'This Week'
        const sCompany = speakerMember?.company || undefined
        return { kind: 'speaker' as const, title: sName, subtitle: sCompany, caption: content || undefined, memberPhoto: speakerMember?.photo || undefined, memberLogo: speakerMember?.logo || undefined, footerCta: MEETING_LINE_SHORT }
      }
      case 'spotlight': {
        const initials = spot ? spot.name.split(' ').map((s: string) => s[0]).slice(0, 2).join('') : 'TB'
        return { kind: 'spotlight' as const, title: spot?.name || 'Member Spotlight', subtitle: spot?.company || undefined, lines: spot?.role ? [spot.role] : [], caption: content || undefined, memberPhoto: spot?.photo || undefined, memberLogo: spot?.logo || undefined, initials, footerCta: undefined }
      }
      case 'visitor_invite':
        return { kind: 'visitor_invite' as const, title: "You're Invited", subtitle: 'Be our guest — meet trusted local pros.', caption: content || undefined, footerCta: MEETING_LINE_SHORT }
      case 'win':
        return { kind: 'win' as const, title: 'Chapter Win', subtitle: winText.trim() || undefined, caption: content || undefined, footerCta: MEETING_LINE_SHORT }
      default:
        return { kind: 'meeting_promo' as const, title: 'Join Us Thursday', subtitle: undefined, caption: content || undefined, footerCta: MEETING_LINE_SHORT }
    }
  })()

  const generateAI = async () => {
    setAiLoading(true); setAiError('')
    try {
      const res = await fetch('/api/treasurer/social/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, platform, facts: buildFacts() }),
      })
      const data = await res.json()
      if (res.ok && data.caption) {
        setContent(data.caption)
      } else {
        // Fall back to the local template, surface a soft notice.
        setAiError('AI unavailable — using template. ' + (data.error ? '' : ''))
        setContent(generateCaption({ type, members, speakers, spotlightId: spotlightId || members[0]?.id, winText, openSeats }))
      }
    } catch {
      setAiError('AI request failed — using template.')
      setContent(generateCaption({ type, members, speakers, spotlightId: spotlightId || members[0]?.id, winText, openSeats }))
    } finally {
      setAiLoading(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* no clipboard */ }
  }

  const save = async (status: 'drafted' | 'scheduled') => {
    if (!content.trim()) return
    setSaving(true)
    await fetch('/api/treasurer/social', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, platform, type, content, status }),
    })
    setSaving(false)
    await refresh()
  }

  const setStatus = async (id: string, status: string) => {
    await fetch(`/api/treasurer/social?id=${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    await refresh()
  }
  const del = async (id: string) => {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/treasurer/social?id=${id}`, { method: 'DELETE' })
    await refresh()
  }

  const STATUS_STYLE: Record<string, string> = {
    idea: 'bg-gray-500/15 text-gray-400',
    drafted: 'bg-brand-blue/15 text-brand-blue',
    scheduled: 'bg-yellow-500/15 text-yellow-400',
    posted: 'bg-green-500/15 text-green-400',
  }
  const PLATFORM_STYLE: Record<string, string> = {
    facebook: 'bg-blue-600/15 text-blue-400',
    linkedin: 'bg-sky-600/15 text-sky-400',
    instagram: 'bg-pink-600/15 text-pink-400',
  }

  const sorted = [...social].sort((a, b) => (a.date > b.date ? -1 : 1))

  return (
    <div className="space-y-4">
      {/* Generator */}
      <div className={CARD + ' p-4 space-y-3'}>
        <h3 className="text-sm font-semibold text-white">Generate a Post</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Post type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
              {SOCIAL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className={INPUT}>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Planned date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} className={`${INPUT} cursor-pointer`} />
          </div>
        </div>

        {/* Type-specific inputs */}
        {type === 'spotlight' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Member to spotlight</label>
            <select value={spotlightId} onChange={(e) => setSpotlightId(e.target.value)} className={INPUT}>
              <option value="">— first member —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        {type === 'win' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Win details (optional)</label>
            <input value={winText} onChange={(e) => setWinText(e.target.value)} placeholder="e.g. Sean closed a $12k policy from a referral by Mitch." className={INPUT} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Caption <span className="text-gray-600">({content.length} chars)</span></label>
            <button onClick={regenerate} className="text-xs text-brand-blue hover:underline">Reset to template</button>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={9}
            className={`${INPUT} font-mono leading-relaxed`} />
          {aiError && <p className="text-xs text-yellow-400 mt-1">{aiError}</p>}
        </div>

        {/* BNI-branded graphic */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Graphic</label>
          <SocialGraphic data={graphicData} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={generateAI} disabled={aiLoading} className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-brand-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
            {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Share2 className="w-4 h-4" /> Generate with AI</>}
          </button>
          <button onClick={copy} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
            {copied ? <><Check className="w-4 h-4 text-green-400" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
          <button onClick={() => save('drafted')} disabled={saving || !content.trim()} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
            <Plus className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={() => save('scheduled')} disabled={saving || !content.trim()} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Schedule for ' + date}
          </button>
        </div>
      </div>

      {/* Weekly plan */}
      <div className={CARD + ' overflow-hidden'}>
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/40"><h3 className="text-sm font-semibold text-white">Content Plan</h3></div>
        <div className="divide-y divide-gray-700/50">
          {sorted.length === 0 ? <p className="text-sm text-gray-500 px-4 py-6 text-center">No posts planned yet. Generate one above.</p> :
            sorted.map((p) => (
              <div key={p.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{p.date}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_STYLE[p.platform]}`}>{PLATFORM_LABEL[p.platform]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} className="bg-gray-900 border border-gray-700 rounded-md text-xs text-gray-300 px-2 py-1">
                      <option value="idea">idea</option>
                      <option value="drafted">drafted</option>
                      <option value="scheduled">scheduled</option>
                      <option value="posted">posted</option>
                    </select>
                    <button onClick={() => { navigator.clipboard?.writeText(p.content) }} className="text-gray-500 hover:text-brand-blue transition" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(p.id)} className="text-gray-600 hover:text-red-400 transition" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-4">{p.content}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
