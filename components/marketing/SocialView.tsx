'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, CalendarDays, ExternalLink, Loader2, Copy, Check, Pencil, Trash2, Plus, Upload, PartyPopper, UserPlus } from 'lucide-react'
import PostEditor, { EditorSeed, MemberLite, PhotoThumb, PostRow, seedFromPost, uploadPhoto } from '@/components/marketing/PostEditor'
import QuickPost from '@/components/marketing/QuickPost'
import SeatPost from '@/components/marketing/SeatPost'
import { SubTabs, useView } from '@/components/marketing/SubTabs'
import { processImage } from '@/lib/imageUtils'
import { FACEBOOK_PAGE_URL, LINKEDIN_PROFILE_URL } from '@/lib/socialChannels'
import { addDays, chicagoToday, dayLabel, nextThursday } from '@/lib/socialDates'

const VIEWS = ['week', 'all', 'photos'] as const
type View = (typeof VIEWS)[number]

const STATUS_STYLE: Record<string, string> = {
  idea: 'bg-gray-700/50 text-gray-300',
  drafted: 'bg-yellow-500/15 text-yellow-300',
  scheduled: 'bg-blue-500/15 text-blue-300',
  posted: 'bg-green-500/15 text-green-300',
}

export default function SocialView() {
  const [view, setView] = useView<View>('week', VIEWS)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [photos, setPhotos] = useState<PhotoThumb[]>([])
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quick, setQuick] = useState(false)
  const params = useSearchParams()
  const seatParam = params.get('seat') || ''
  const [seatOpen, setSeatOpen] = useState(!!seatParam)
  const [editor, setEditor] = useState<EditorSeed | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planMsg, setPlanMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState('all')
  const [copiedId, setCopiedId] = useState('')
  const [uploading, setUploading] = useState(false)

  const loadPosts = useCallback(async () => {
    const r = await fetch('/api/social/posts', { credentials: 'include' })
    if (!r.ok) throw new Error('Could not load posts.')
    setPosts(await r.json())
  }, [])
  const loadPhotos = useCallback(async () => {
    const r = await fetch('/api/social/photos', { credentials: 'include' })
    if (!r.ok) throw new Error('Could not load photos.')
    setPhotos(await r.json())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [mr] = await Promise.all([fetch('/api/members', { credentials: 'include' }), loadPosts(), loadPhotos()])
        if (mr.ok) {
          const list = await mr.json()
          if (!cancelled && Array.isArray(list)) {
            setMembers(list.map((m: Record<string, unknown>) => ({
              id: String(m.id ?? m._id ?? ''), name: String(m.name ?? ''), role: String(m.role ?? ''),
              company: String(m.company ?? ''), photo: String(m.photo ?? ''),
            })))
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the Social Studio.')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [loadPosts, loadPhotos])

  const plan = async () => {
    setPlanning(true); setPlanMsg(null)
    try {
      const r = await fetch('/api/social/plan', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not build the plan.')
      await loadPosts()
      setPlanMsg({
        ok: true,
        text: d.created ? `Added ${d.created} drafts for ${dayLabel(d.week_of)}.${d.note ? ' ' + d.note : ''}` : 'This week is already planned.',
      })
      setView('week')
    } catch (e) { setPlanMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not build the plan.' }) }
    finally { setPlanning(false) }
  }

  const thu = nextThursday(chicagoToday())
  const weekPosts = useMemo(
    () => posts.filter((p) => p.date >= addDays(thu, -3) && p.date <= addDays(thu, 2)).sort((a, b) => a.date.localeCompare(b.date)),
    [posts, thu]
  )
  const allPosts = useMemo(() => posts.filter((p) => filter === 'all' || p.status === filter), [posts, filter])

  const copyPost = async (p: PostRow) => {
    try { await navigator.clipboard.writeText(p.content); setCopiedId(p.id); setTimeout(() => setCopiedId(''), 1800) } catch { /* ignore */ }
  }
  const markPosted = async (p: PostRow) => {
    await fetch(`/api/social/posts?id=${p.id}`, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, status: 'posted' }),
    })
    loadPosts()
  }
  const removePost = async (p: PostRow) => {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/social/posts?id=${p.id}`, { method: 'DELETE', credentials: 'include' })
    loadPosts()
  }
  const removePhoto = async (id: string) => {
    if (!confirm('Delete this photo from the library?')) return
    await fetch(`/api/social/photos?id=${id}`, { method: 'DELETE', credentials: 'include' })
    loadPhotos()
  }
  const uploadToLibrary = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try { await uploadPhoto(await processImage(file)); await loadPhotos() }
    catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.') }
    finally { setUploading(false) }
  }

  const renderPost = (p: PostRow) => (
    <div key={p.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-white">{dayLabel(p.date)}</span>
        <span className="text-gray-500 capitalize">{p.platform}</span>
        <span className="text-gray-500">{p.type.replace('_', ' ')}</span>
        <span className={`ml-auto px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? ''}`}>{p.status}</span>
      </div>
      {p.graphic?.title && <p className="text-sm font-medium text-gray-200">{p.graphic.title}</p>}
      <p className="text-sm text-gray-400 whitespace-pre-line line-clamp-4">{p.content || 'No caption yet.'}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => setEditor(seedFromPost(p))} className="flex items-center gap-1 text-xs border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg"><Pencil className="w-3.5 h-3.5" /> Edit</button>
        <button onClick={() => copyPost(p)} disabled={!p.content} className="flex items-center gap-1 text-xs border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-40">
          {copiedId === p.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copy
        </button>
        {p.status !== 'posted' && <button onClick={() => markPosted(p)} className="text-xs border border-green-600/50 text-green-400 px-3 py-1.5 rounded-lg">Mark posted</button>}
        <button onClick={() => setEditor(seedFromPost(p, true))} className="text-xs text-gray-500 hover:text-white px-2">Reuse</button>
        <button onClick={() => removePost(p)} aria-label="Delete post" className="ml-auto text-red-400 hover:text-red-300 p-1.5"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )

  return (
    <div className="px-4 sm:px-6 py-4 max-w-4xl mx-auto space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-blue/20 to-gray-800/40 border border-gray-700 rounded-2xl p-5 space-y-3">
        <div>
          <h1 className="text-xl font-bold text-white">Social Studio</h1>
          <p className="text-sm text-gray-400">Take a photo, say what it is, and get a Facebook post and a LinkedIn post with a branded image.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setQuick(true)} className="flex items-center gap-2 bg-brand-blue text-white px-5 py-3 rounded-xl text-sm font-semibold">
            <Camera className="w-4 h-4" /> New post from a photo
          </button>
          <button onClick={() => setSeatOpen(true)} className="flex items-center gap-2 bg-brand-red/90 hover:bg-brand-red text-white px-4 py-3 rounded-xl text-sm font-semibold">
            <UserPlus className="w-4 h-4" /> Fill a seat
          </button>
          <button onClick={() => setEditor({ type: 'welcome', format: 'landscape', title: '' })} className="flex items-center gap-2 border border-gray-600 text-gray-200 px-4 py-3 rounded-xl text-sm">
            <PartyPopper className="w-4 h-4" /> Welcome a member
          </button>
          <button onClick={plan} disabled={planning} className="flex items-center gap-2 border border-gray-600 text-gray-200 px-4 py-3 rounded-xl text-sm disabled:opacity-50">
            {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Plan this week
          </button>
          <button onClick={() => setEditor({ type: 'custom' })} className="flex items-center gap-2 border border-gray-700 text-gray-400 px-4 py-3 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> Other template
          </button>
        </div>
        <div className="flex gap-4 text-xs">
          <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-blue"><ExternalLink className="w-3.5 h-3.5" /> Facebook page</a>
          <a href={LINKEDIN_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-blue"><ExternalLink className="w-3.5 h-3.5" /> LinkedIn</a>
        </div>
        {planMsg && <p className={`text-sm ${planMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{planMsg.text}</p>}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <SubTabs<View>
        value={view}
        onChange={setView}
        tabs={[
          { id: 'week', label: 'This week' },
          { id: 'all', label: `All posts (${posts.length})` },
          { id: 'photos', label: `Photos (${photos.length})` },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
      ) : view === 'week' ? (
        weekPosts.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing planned around {dayLabel(thu)}. Tap Plan this week to draft the week from the speaker rotation and open seats.</p>
        ) : (
          <div className="space-y-3">{weekPosts.map(renderPost)}</div>
        )
      ) : view === 'all' ? (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto">
            {['all', 'idea', 'drafted', 'scheduled', 'posted'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-xs border capitalize ${filter === s ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>{s}</button>
            ))}
          </div>
          {allPosts.length === 0 ? <p className="text-sm text-gray-500">No posts here yet.</p> : allPosts.map(renderPost)}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="inline-flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadToLibrary(e.target.files?.[0])} />
          </label>
          {photos.length === 0 ? <p className="text-sm text-gray-500">No photos yet. Take one with New post from a photo.</p> : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.label || 'Library photo'} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(p.id)} aria-label="Delete photo" className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditor({ type: 'photo', photo_id: p.id })} className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">Create post</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {quick && (
        <QuickPost photos={photos} onClose={() => setQuick(false)} onSaved={loadPosts} onLibraryChanged={loadPhotos} />
      )}
      {seatOpen && <SeatPost initialSeat={seatParam || undefined} onClose={() => setSeatOpen(false)} onSaved={loadPosts} />}
      {editor && (
        <PostEditor
          seed={editor} members={members} photos={photos}
          onClose={() => setEditor(null)} onSaved={loadPosts} onLibraryChanged={loadPhotos}
        />
      )}
    </div>
  )
}
