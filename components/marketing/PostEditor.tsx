'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Camera, Image as ImageIcon, Upload, Sparkles, Copy, Check, Loader2, Trash2 } from 'lucide-react'
import SocialGraphic, { GraphicData, GraphicKind, GraphicFormat, PhotoWrapper, PHOTO_WRAPPERS } from '@/components/SocialGraphic'
import CameraCapture from '@/components/CameraCapture'
import { processImage, ProcessedImage } from '@/lib/imageUtils'
import { chicagoToday, nextThursday, shortUpper } from '@/lib/socialDates'
import type { SocialType, SocialPlatform, SocialStatus } from '@/lib/models/SocialPost'

// ─── Shared types ────────────────────────────────────────────────────────────

export interface MemberLite { id: string; name: string; role: string; company: string; photo: string }
export interface PhotoThumb { id: string; thumb: string; label: string; member_id: string; created_at: string }
export interface PostRow {
  id: string; date: string; platform: SocialPlatform; type: SocialType; content: string; status: SocialStatus
  member_id: string; photo_id: string; format: GraphicFormat; week_of: string; source: string
  graphic: { kind: string; title: string; subtitle?: string; lines?: string[]; caption?: string; dateLabel?: string; wrapper?: string } | null
}
export interface EditorSeed {
  id?: string; week_of?: string; source?: string
  type?: SocialType; platform?: SocialPlatform; format?: GraphicFormat; date?: string; status?: SocialStatus
  member_id?: string; photo_id?: string; photoData?: string
  title?: string; subtitle?: string; role?: string; classification?: string; seats?: string; cardLine?: string; content?: string
  wrapper?: PhotoWrapper
}

export function seedFromPost(p: PostRow, asCopy = false): EditorSeed {
  const g = p.graphic
  return {
    id: asCopy ? undefined : p.id, week_of: asCopy ? '' : p.week_of, source: asCopy ? 'manual' : p.source,
    type: p.type, platform: p.platform, format: p.format, date: asCopy ? chicagoToday() : p.date,
    status: asCopy ? 'drafted' : p.status, member_id: p.member_id, photo_id: p.photo_id,
    title: g?.title ?? '', subtitle: g?.subtitle ?? '',
    role: p.type === 'spotlight' ? (g?.lines?.[0] ?? '') : p.type === 'welcome' ? (g?.lines?.[1] ?? '') : '',
    classification: p.type === 'welcome' ? (g?.lines?.[0] ?? '') : '',
    seats: p.type === 'open_seats' ? (g?.lines ?? []).join(', ') : '',
    cardLine: g?.caption ?? '', content: asCopy ? '' : p.content,
    wrapper: (g?.wrapper as PhotoWrapper | undefined) ?? 'overlay',
  }
}

export async function uploadPhoto(img: ProcessedImage, memberId = ''): Promise<string> {
  const res = await fetch('/api/social/photos', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: img.data, thumb: img.thumb, member_id: memberId }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error || 'Could not save the photo.')
  return d.id as string
}

// ─── Templates ───────────────────────────────────────────────────────────────

const KINDS: { id: SocialType; label: string }[] = [
  { id: 'photo', label: 'Photo' },
  { id: 'welcome', label: 'Welcome new member' },
  { id: 'spotlight', label: 'Member spotlight' },
  { id: 'speaker', label: 'Speaker' },
  { id: 'meeting_day', label: 'Meeting day' },
  { id: 'meeting_promo', label: 'Thursday promo' },
  { id: 'visitor_invite', label: 'Guest invite' },
  { id: 'open_seats', label: 'Open seats' },
  { id: 'recap', label: 'Recap' },
  { id: 'win', label: 'Win' },
  { id: 'evergreen', label: 'Referral tip' },
  { id: 'custom', label: 'Custom' },
]
const DEFAULT_TITLE: Partial<Record<SocialType, string>> = {
  photo: 'Thursday at Think Big', meeting_day: 'See you at 11:30.', meeting_promo: 'Thursday, 11:30. Come see it.',
  visitor_invite: 'You are invited.', open_seats: 'Your seat is waiting.', recap: 'Thank you, Think Big.',
  win: 'Referrals at work.', evergreen: 'How referrals really work.', custom: 'Think Big St. Louis',
}
const PHOTO_KINDS: SocialType[] = ['photo', 'spotlight', 'speaker', 'welcome']
const PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram']
const STATUSES: SocialStatus[] = ['idea', 'drafted', 'scheduled', 'posted']

const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const LABEL = 'block text-xs text-gray-500 mb-1'
const initialsOf = (n: string) => n.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function PostEditor({
  seed, members, photos, onClose, onSaved, onLibraryChanged,
}: {
  seed: EditorSeed
  members: MemberLite[]
  photos: PhotoThumb[]
  onClose: () => void
  onSaved: () => void
  onLibraryChanged: () => void
}) {
  const [id] = useState(seed.id)
  const [type, setType] = useState<SocialType>(seed.type ?? 'photo')
  const [platform, setPlatform] = useState<SocialPlatform>(seed.platform ?? 'facebook')
  const [format, setFormat] = useState<GraphicFormat>(seed.format ?? 'square')
  const [date, setDate] = useState(seed.date ?? chicagoToday())
  const [status, setStatus] = useState<SocialStatus>(seed.status ?? 'drafted')
  const [memberId, setMemberId] = useState(seed.member_id ?? '')
  const [photoId, setPhotoId] = useState(seed.photo_id ?? '')
  const [photoData, setPhotoData] = useState(seed.photoData ?? '')
  const [title, setTitle] = useState(seed.title ?? DEFAULT_TITLE[seed.type ?? 'photo'] ?? '')
  const [subtitle, setSubtitle] = useState(seed.subtitle ?? '')
  const [role, setRole] = useState(seed.role ?? '')
  const [classification, setClassification] = useState(seed.classification ?? '')
  const [seats, setSeats] = useState(seed.seats ?? '')
  const [cardLine, setCardLine] = useState(seed.cardLine ?? '')
  const [content, setContent] = useState(seed.content ?? '')
  const [note, setNote] = useState('')
  const [wrapper, setWrapper] = useState<PhotoWrapper>(seed.wrapper ?? 'overlay')

  const [showCamera, setShowCamera] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [busy, setBusy] = useState('')          // 'save' | 'generate' | 'photo' | ''
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const member = members.find((m) => m.id === memberId)
  const wantsPhoto = PHOTO_KINDS.includes(type)
  const effectivePhoto = photoData || (wantsPhoto ? member?.photo || '' : '')

  // An existing post that references a library photo: load the full image once.
  useEffect(() => {
    if (!seed.photo_id || seed.photoData) return
    let cancelled = false
    fetch(`/api/social/photos?id=${seed.photo_id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data && !cancelled) setPhotoData(d.data) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [seed.photo_id, seed.photoData])

  const pickTemplate = (t: SocialType) => {
    setType(t)
    if (DEFAULT_TITLE[t] && (!title || Object.values(DEFAULT_TITLE).includes(title))) setTitle(DEFAULT_TITLE[t] as string)
    if ((t === 'spotlight' || t === 'speaker' || t === 'welcome') && member) { setTitle(member.name); setSubtitle(member.company); if (t === 'spotlight' || t === 'welcome') setRole(member.role) }
    if (t === 'welcome') setFormat('landscape')
  }

  const pickMember = (mid: string) => {
    setMemberId(mid)
    const m = members.find((x) => x.id === mid)
    if (m) { setTitle(m.name); setSubtitle(m.company); setRole(m.role); setPhotoData(''); setPhotoId('') }
  }

  const graphic: GraphicData = useMemo(() => ({
    kind: type as GraphicKind,
    title: title || DEFAULT_TITLE[type] || 'Think Big St. Louis',
    subtitle: subtitle || undefined,
    lines: type === 'welcome' ? [classification, role] : type === 'spotlight' ? (role ? [role] : []) : type === 'open_seats' ? seats.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    caption: cardLine || undefined,
    dateLabel: type === 'speaker' ? `THURSDAY · ${shortUpper(nextThursday(date))}` : undefined,
    memberPhoto: effectivePhoto || undefined,
    wrapper: type === 'photo' ? wrapper : undefined,
    initials: initialsOf(title || 'TB'),
  }), [type, title, subtitle, role, seats, cardLine, date, effectivePhoto, wrapper])

  // ── photo actions ──
  const saveToLibrary = async (img: ProcessedImage) => {
    setBusy('photo'); setMsg(null)
    try {
      const pid = await uploadPhoto(img, memberId)
      setPhotoId(pid); setPhotoData(img.data)
      onLibraryChanged()
      setMsg({ ok: true, text: 'Photo saved to your library.' })
    } catch (e) {
      // Still usable for this post even if the library save failed.
      setPhotoData(img.data); setPhotoId('')
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the photo to the library.' })
    } finally { setBusy('') }
  }
  const onFile = async (file?: File | null) => {
    if (!file) return
    setBusy('photo')
    try { await saveToLibrary(await processImage(file)) } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not read that image.' }) } finally { setBusy('') }
  }
  const useLibraryPhoto = async (p: PhotoThumb) => {
    setBusy('photo'); setShowLibrary(false)
    try {
      const r = await fetch(`/api/social/photos?id=${p.id}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not load that photo.')
      setPhotoData(d.data); setPhotoId(p.id)
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load that photo.' }) } finally { setBusy('') }
  }

  // ── caption ──
  const generate = async () => {
    setBusy('generate'); setMsg(null)
    try {
      const isPerson = type === 'spotlight' || type === 'speaker' || type === 'welcome'
      const res = await fetch('/api/social/caption', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, platform,
          facts: {
            name: isPerson ? title : '', company: isPerson ? subtitle : '', role: type === 'spotlight' || type === 'welcome' ? role : '',
            seats: type === 'open_seats' ? seats : '', details: note, topic: type === 'evergreen' ? note : '', photo_note: type === 'photo' ? note : '',
          },
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not write a caption.')
      setContent(d.post); setCardLine(d.cardLine)
      if (!isPerson && d.headline) setTitle(d.headline)
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not write a caption.' }) } finally { setBusy('') }
  }

  // ── save ──
  const save = async (nextStatus?: SocialStatus) => {
    setBusy('save'); setMsg(null)
    const st = nextStatus ?? status
    const body = {
      date, platform, type, content, status: st, member_id: memberId, photo_id: photoId, format,
      week_of: seed.week_of ?? '', source: seed.source === 'plan' ? 'plan' : 'manual',
      graphic: {
        kind: type, title: graphic.title, subtitle: graphic.subtitle ?? '', lines: graphic.lines ?? [],
        caption: cardLine, dateLabel: graphic.dateLabel ?? '', wrapper: type === 'photo' ? wrapper : '',
      },
    }
    try {
      const res = await fetch(id ? `/api/social/posts?id=${id}` : '/api/social/posts', {
        method: id ? 'PUT' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save the post.')
      setStatus(st)
      onSaved()
      if (nextStatus === 'posted') onClose()
      else setMsg({ ok: true, text: id ? 'Saved.' : 'Saved as a draft. You can close this or keep editing.' })
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the post.' }) } finally { setBusy('') }
  }

  const remove = async () => {
    if (!id || !confirm('Delete this post?')) return
    await fetch(`/api/social/posts?id=${id}`, { method: 'DELETE', credentials: 'include' })
    onSaved(); onClose()
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { setMsg({ ok: false, text: 'Copy failed. Select the text and copy it by hand.' }) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{id ? 'Edit post' : 'New post'}</h2>
          <button onClick={onClose} aria-label="Close editor" className="p-1 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* ── Controls ── */}
          <div className="space-y-5 order-2 lg:order-1">
            {/* Template */}
            <div>
              <p className={LABEL}>Template</p>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k.id} onClick={() => pickTemplate(k.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${type === k.id ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo */}
            {wantsPhoto && (
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Photo</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowCamera(true)} className="flex items-center gap-1.5 bg-brand-blue text-white px-3 py-2 rounded-lg text-sm font-medium"><Camera className="w-4 h-4" /> Take photo</button>
                  <button onClick={() => setShowLibrary((v) => !v)} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm"><ImageIcon className="w-4 h-4" /> Library ({photos.length})</button>
                  <label className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm cursor-pointer">
                    <Upload className="w-4 h-4" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  {member?.photo && photoData && (
                    <button onClick={() => { setPhotoData(''); setPhotoId('') }} className="text-xs text-brand-blue px-2">Use member photo</button>
                  )}
                  {busy === 'photo' && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
                </div>
                {showLibrary && (
                  photos.length === 0 ? <p className="text-xs text-gray-500">No photos yet. Take one with the camera.</p> : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {photos.map((p) => (
                        <button key={p.id} onClick={() => useLibraryPhoto(p)} className="aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-brand-blue">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumb} alt={p.label || 'Library photo'} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )
                )}
                {type === 'photo' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Style</span>
                    {PHOTO_WRAPPERS.map((w) => (
                      <button key={w.id} onClick={() => setWrapper(w.id)} className={`px-3 py-1 rounded-full text-xs border ${wrapper === w.id ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>{w.label}</button>
                    ))}
                  </div>
                )}
                {type === 'photo' && !effectivePhoto && <p className="text-xs text-yellow-400">Add a photo to see the full Think Big photo frame.</p>}
              </div>
            )}

            {/* Content fields */}
            <div className="grid sm:grid-cols-2 gap-3">
              {(type === 'spotlight' || type === 'speaker' || type === 'welcome') && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>{type === 'speaker' ? 'Speaker (member)' : 'Member'}</label>
                  <select value={memberId} onChange={(e) => pickMember(e.target.value)} className={INPUT}>
                    <option value="">Choose a member…</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.company ? ` · ${m.company}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className={type === 'open_seats' || type === 'meeting_day' ? 'sm:col-span-2' : ''}>
                <label className={LABEL}>{type === 'spotlight' || type === 'speaker' || type === 'welcome' ? 'Name' : 'Headline'}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
              </div>
              {(type === 'spotlight' || type === 'speaker' || type === 'welcome' || type === 'open_seats') && (
                <div>
                  <label className={LABEL}>{type === 'open_seats' ? 'Supporting line' : 'Company'}</label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={INPUT} />
                </div>
              )}
              {type === 'welcome' && (
                <div>
                  <label className={LABEL}>Classification (on the card)</label>
                  <input value={classification} onChange={(e) => setClassification(e.target.value)} className={INPUT} placeholder="Real Estate Services" />
                </div>
              )}
              {(type === 'spotlight' || type === 'welcome') && (
                <div>
                  <label className={LABEL}>Role</label>
                  <input value={role} onChange={(e) => setRole(e.target.value)} className={INPUT} />
                </div>
              )}
              {type === 'open_seats' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Open seats (comma separated)</label>
                  <input value={seats} onChange={(e) => setSeats(e.target.value)} className={INPUT} placeholder="Dentist, Chiropractor, Accountant / CPA" />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={LABEL}>Line printed on the image</label>
                <input value={cardLine} onChange={(e) => setCardLine(e.target.value)} className={INPUT} maxLength={140} />
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={LABEL + ' mb-0'}>Caption</label>
                <button onClick={generate} disabled={busy === 'generate'} className="flex items-center gap-1.5 text-xs text-brand-blue hover:text-white disabled:opacity-50">
                  {busy === 'generate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Write with AI
                </button>
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT}
                placeholder={type === 'win' ? 'What happened? (the AI only uses what you write here)' : type === 'photo' ? "What's in the photo? (optional)" : type === 'evergreen' ? 'Topic (optional)' : 'Anything the writer should know (optional)'} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={9} className={INPUT + ' font-sans leading-relaxed'}
                placeholder="The caption appears here. The meeting details and the Webtek credit are added automatically." />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={LABEL}>Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} className={INPUT}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Image size</label>
                <select value={format} onChange={(e) => setFormat(e.target.value as GraphicFormat)} className={INPUT}>
                  <option value="square">Square 1:1</option>
                  <option value="portrait">Portrait 4:5</option>
                  <option value="landscape">Landscape 3:2</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Post date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as SocialStatus)} className={INPUT}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

            <div className="flex flex-wrap gap-2">
              <button onClick={() => save()} disabled={busy === 'save'} className="bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                {busy === 'save' ? 'Saving…' : id ? 'Save' : 'Save draft'}
              </button>
              <button onClick={copy} disabled={!content} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-lg text-sm disabled:opacity-40">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy caption'}
              </button>
              <button onClick={() => save('posted')} disabled={busy === 'save' || !content} className="border border-green-600/50 text-green-400 hover:bg-green-600/10 px-4 py-2.5 rounded-lg text-sm disabled:opacity-40">
                Mark posted
              </button>
              {id && <button onClick={remove} className="ml-auto flex items-center gap-1.5 text-red-400 hover:text-red-300 px-3 py-2.5 text-sm"><Trash2 className="w-4 h-4" /> Delete</button>}
            </div>
          </div>

          {/* ── Live preview ── */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-4 self-start w-full max-w-sm mx-auto lg:max-w-none">
            <p className={LABEL}>Preview</p>
            <SocialGraphic data={graphic} format={format} fileName={`think-big-${type}`} />
            <p className="text-[11px] text-gray-600 mt-2">Every image carries the BNI header, the Thursday meeting line, and Marketing by Webtek.</p>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          aspect={format === 'portrait' ? 0.8 : 1}
          onClose={() => setShowCamera(false)}
          onCapture={(img) => { setShowCamera(false); saveToLibrary(img) }}
        />
      )}
    </div>
  )
}
