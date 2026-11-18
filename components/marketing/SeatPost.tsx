'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Sparkles, Loader2, Copy, Check, Share2, Download, ExternalLink, UserPlus } from 'lucide-react'
import SocialGraphic, { GraphicData } from '@/components/SocialGraphic'
import { chicagoToday, dayLabel } from '@/lib/socialDates'
import { FACEBOOK_PAGE_URL, LINKEDIN_PROFILE_URL } from '@/lib/socialChannels'
import { copyText, downloadCanvas, shareImage } from '@/lib/shareImage'
import { POWER_TEAMS } from '@/lib/chapterSeats'

type Tone = 'witty' | 'heartfelt' | 'direct'
type Platform = 'facebook' | 'linkedin'
interface SeatRow { seat: string; team: string; last_posted: string | null }
interface Option { headline: string; tagline: string; lookingFor: string[]; facebook: string; linkedin: string; angle?: string }

const TONES: { id: Tone; label: string }[] = [
  { id: 'witty', label: '😄 Witty' },
  { id: 'heartfelt', label: '❤️ Heartfelt' },
  { id: 'direct', label: '🎯 Direct' },
]
const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-xs border transition ${on ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`

/** Open-seat recruiting post: pick a category + tone → 3 options → branded poster. */
export default function SeatPost({ onClose, onSaved, initialSeat }: { onClose: () => void; onSaved: () => void; initialSeat?: string }) {
  const [seats, setSeats] = useState<SeatRow[]>([])
  const [loadingSeats, setLoadingSeats] = useState(true)
  const [seat, setSeat] = useState(initialSeat ?? '')
  const [tone, setTone] = useState<Tone>('witty')
  const [team, setTeam] = useState('Home Services')
  const [note, setNote] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [pick, setPick] = useState(0)
  const [edit, setEdit] = useState<Option | null>(null)
  const [tab, setTab] = useState<Platform>('facebook')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onRendered = useCallback((c: HTMLCanvasElement) => { canvasRef.current = c }, [])

  useEffect(() => {
    fetch('/api/social/seats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SeatRow[]) => {
        setSeats(rows)
        const start = initialSeat ? rows.find((r) => r.seat === initialSeat) : rows.find((r) => r.team === 'Home Services') ?? rows[0]
        if (start) { setTeam(start.team); if (!initialSeat) setSeat(start.seat) }
      })
      .catch(() => undefined)
      .finally(() => setLoadingSeats(false))
  }, [initialSeat])

  const write = async () => {
    if (!seat) { setMsg({ ok: false, text: 'Pick a seat first.' }); return }
    setBusy('write'); setMsg(null)
    try {
      const r = await fetch('/api/social/seats', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat, tone, note }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not write the post.')
      setOptions(d.options); setPick(0); setEdit({ ...d.options[0] }); setSaved(false)
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not write the post.' }) }
    finally { setBusy('') }
  }

  const choose = (i: number) => { setPick(i); setEdit({ ...options[i] }); setSaved(false) }
  const caption = edit ? (tab === 'facebook' ? edit.facebook : edit.linkedin) : ''
  const setCaption = (v: string) => setEdit((e) => (e ? { ...e, [tab]: v } : e))
  const setReq = (i: number, v: string) => setEdit((e) => (e ? { ...e, lookingFor: e.lookingFor.map((r, j) => (j === i ? v : r)) } : e))

  const graphic: GraphicData = {
    kind: 'seat_open', title: seat, subtitle: edit?.tagline, lines: edit?.lookingFor, caption: edit?.headline,
  }
  const fileName = `think-big-seat-${seat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${chicagoToday()}.jpg`

  const save = async (status: 'drafted' | 'posted') => {
    if (!edit) return false
    setBusy('save'); setMsg(null)
    const g = { kind: 'seat_open', title: seat, subtitle: edit.tagline, lines: edit.lookingFor, caption: edit.headline, dateLabel: '', wrapper: '' }
    try {
      for (const [platform, content] of [['facebook', edit.facebook], ['linkedin', edit.linkedin]] as const) {
        const r = await fetch('/api/social/posts', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: chicagoToday(), platform, type: 'seat_open', content, status, graphic: g, format: 'landscape', source: 'manual' }),
        })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save.')
      }
      setSaved(true); onSaved()
      setMsg({ ok: true, text: status === 'posted' ? 'Saved as posted.' : 'Saved both posts as drafts.' })
      return true
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' }); return false }
    finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-brand-blue" /> Fill a seat</h2>
            <p className="text-xs text-gray-500">Invite a new member for one of our open business categories.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {/* Seat + tone */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Open seats by power team (least recently promoted first)</p>
          {!loadingSeats && seats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {POWER_TEAMS.filter((t) => seats.some((s) => s.team === t.id)).map((t) => (
                <button key={t.id} onClick={() => setTeam(t.id)} title={t.blurb}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border ${team === t.id ? 'bg-gray-100 text-gray-900 border-gray-100' : 'border-gray-700 text-gray-400 hover:text-white'}`}>
                  {t.id} ({seats.filter((s) => s.team === t.id).length})
                </button>
              ))}
            </div>
          )}
          {loadingSeats ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : seats.length === 0 ? (
            <p className="text-sm text-gray-500">No open seats found. Every category is covered.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {seats.filter((s) => s.team === team).map((s) => (
                <button key={s.seat} onClick={() => { setSeat(s.seat); setOptions([]); setEdit(null) }} className={chip(seat === s.seat)}
                  title={s.last_posted ? `Last posted ${dayLabel(s.last_posted)}` : 'Never posted'}>
                  {s.seat}{!s.last_posted && <span className="ml-1 text-[10px] text-green-400">new</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Tone</span>
            {TONES.map((t) => <button key={t.id} onClick={() => setTone(t.id)} className={chip(tone === t.id)}>{t.label}</button>)}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT}
            placeholder="Anything true to add? (optional, e.g. our members meet lots of homeowners)" />
          <button onClick={write} disabled={busy === 'write' || !seat}
            className="w-full flex items-center justify-center gap-2 bg-brand-blue text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {busy === 'write' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {options.length ? 'Write 3 new options' : 'Write 3 options'}
          </button>
        </div>

        {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

        {edit && (
          <div className="space-y-4 border-t border-gray-800 pt-4">
            {options.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {options.map((o, i) => (
                  <button key={i} onClick={() => choose(i)} className={chip(pick === i)}>Option {i + 1}{o.angle ? ` · ${o.angle}` : ''}</button>
                ))}
              </div>
            )}

            <SocialGraphic data={graphic} format="landscape" compact fileName="think-big-seat" onRendered={onRendered} />

            <div className="grid sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Script line on the image</label>
                <input value={edit.tagline} maxLength={34} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} className={INPUT} />
              </div>
              {edit.lookingFor.map((r, i) => (
                <div key={i} className={i === 2 ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs text-gray-500 mb-1">Great fit #{i + 1}</label>
                  <input value={r} maxLength={42} onChange={(e) => setReq(i, e.target.value)} className={INPUT} />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              {(['facebook', 'linkedin'] as Platform[]).map((p) => (
                <button key={p} onClick={() => setTab(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tab === p ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>
                  {p === 'facebook' ? 'Facebook (chapter)' : 'LinkedIn (Patrick)'}
                </button>
              ))}
            </div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={11} className={INPUT + ' leading-relaxed'} />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={async () => { const t = await shareImage(canvasRef.current, caption, fileName); if (t) setMsg({ ok: true, text: t }) }}
                className="col-span-2 flex items-center justify-center gap-2 bg-brand-blue text-white py-3 rounded-xl text-sm font-semibold">
                <Share2 className="w-4 h-4" /> Share image + caption
              </button>
              <button onClick={async () => { if (await copyText(caption)) { setCopied(true); setTimeout(() => setCopied(false), 1800) } }}
                className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-2.5 rounded-xl text-sm">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy caption'}
              </button>
              <button onClick={() => downloadCanvas(canvasRef.current, fileName)}
                className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-2.5 rounded-xl text-sm">
                <Download className="w-4 h-4" /> Save image
              </button>
              <a href={tab === 'facebook' ? FACEBOOK_PAGE_URL : LINKEDIN_PROFILE_URL} target="_blank" rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-center gap-1.5 text-xs text-brand-blue py-1">
                <ExternalLink className="w-3.5 h-3.5" /> Open {tab === 'facebook' ? 'the Facebook page' : 'LinkedIn'}
              </a>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => save('drafted')} disabled={busy === 'save' || saved}
                className="border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">{saved ? 'Saved' : 'Save both'}</button>
              <button onClick={async () => { if (await save('posted')) onClose() }} disabled={busy === 'save' || saved}
                className="border border-green-600/50 text-green-400 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">Mark posted</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
