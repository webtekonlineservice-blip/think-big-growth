'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Camera, Image as ImageIcon, Upload, Sparkles, Copy, Check, Loader2, Trash2, GripVertical } from 'lucide-react'
import SocialGraphic, { GraphicData, GraphicKind, GraphicFormat, PhotoWrapper, PHOTO_WRAPPERS, FORMAT_SIZE } from '@/components/SocialGraphic'
import CollageEditor, { createPhotoLayers } from '@/components/marketing/CollageEditor'
import type { CollagePreset, CollagePhoto } from '@/components/marketing/CollageEditor'
import CameraCapture from '@/components/CameraCapture'
import { processImage, ProcessedImage } from '@/lib/imageUtils'
import { chicagoToday, nextThursday, shortUpper } from '@/lib/socialDates'
import type { SocialFlyerTemplate, SocialPhotoLayer, SocialType, SocialPlatform, SocialStatus } from '@/lib/models/SocialPost'

// ─── Shared types ────────────────────────────────────────────────────────────

export interface BusinessProfileLite {
  website: string
  summary: string
  services: string
  sources: { title: string; url: string }[]
  researched_at: string | null
}
export interface MemberLite {
  id: string; name: string; role: string; company: string; photo: string
  business_profile?: BusinessProfileLite | null
}
export interface VisitorLite {
  id: string; name: string; role: string; company: string; business_profile?: BusinessProfileLite | null
}
export interface PhotoThumb { id: string; thumb: string; label: string; member_id: string; created_at: string }
export interface PostRow {
  id: string; date: string; platform: SocialPlatform; type: SocialType; content: string; status: SocialStatus
  member_id: string; photo_id: string; format: GraphicFormat; week_of: string; source: string
  graphic: { kind: string; title: string; subtitle?: string; lines?: string[]; caption?: string; dateLabel?: string; wrapper?: string; photo_ids?: string[]; photo_layers?: SocialPhotoLayer[]; subject_type?: 'member' | 'visitor'; subject_id?: string; collage_layout?: CollagePreset; flyer_template?: SocialFlyerTemplate } | null
}
export interface EditorSeed {
  id?: string; week_of?: string; source?: string
  type?: SocialType; platform?: SocialPlatform; format?: GraphicFormat; date?: string; status?: SocialStatus
  member_id?: string; photo_id?: string; photo_ids?: string[]; photoData?: string
  subject_type?: 'member' | 'visitor'; subject_id?: string
  collage_layout?: CollagePreset; photo_layers?: SocialPhotoLayer[]; flyer_template?: SocialFlyerTemplate
  title?: string; subtitle?: string; role?: string; classification?: string; seats?: string; cardLine?: string; content?: string
  wrapper?: PhotoWrapper
}

export function seedFromPost(p: PostRow, asCopy = false): EditorSeed {
  const g = p.graphic
  return {
    id: asCopy ? undefined : p.id, week_of: asCopy ? '' : p.week_of, source: asCopy ? 'manual' : p.source,
    type: p.type, platform: p.platform, format: p.format, date: asCopy ? chicagoToday() : p.date,
    status: asCopy ? 'drafted' : p.status, member_id: p.member_id, photo_id: p.photo_id, photo_ids: g?.photo_ids ?? [],
    title: g?.title ?? '', subtitle: g?.subtitle ?? '',
    role: p.type === 'spotlight' || p.type === 'community_spotlight' ? (g?.lines?.[0] ?? '') : p.type === 'welcome' ? (g?.lines?.[1] ?? '') : '',
    classification: p.type === 'welcome' ? (g?.lines?.[0] ?? '') : '',
    seats: p.type === 'open_seats' ? (g?.lines ?? []).join(', ') : p.type === 'seat_open' ? (g?.lines ?? []).join(' | ') : '',
    cardLine: g?.caption ?? '', content: asCopy ? '' : p.content,
    wrapper: (g?.wrapper as PhotoWrapper | undefined) ?? 'overlay',
    subject_type: g?.subject_type === 'visitor' ? 'visitor' : 'member',
    subject_id: g?.subject_id ?? '',
    collage_layout: g?.collage_layout ?? 'freeform',
    photo_layers: g?.photo_layers,
    flyer_template: g?.flyer_template ?? 'classic',
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
  { id: 'community_spotlight', label: 'Member / visitor spotlight' },
  { id: 'meeting_day', label: 'Meeting day' },
  { id: 'meeting_promo', label: 'Thursday promo' },
  { id: 'visitor_invite', label: 'Guest invite' },
  { id: 'seat_open', label: 'Open seat' },
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
const COLLAGE_KINDS: SocialType[] = ['community_spotlight', 'spotlight', 'speaker', 'seat_open']
const MAX_FEATURE_PHOTOS = 4
const PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'instagram']
const STATUSES: SocialStatus[] = ['idea', 'drafted', 'scheduled', 'posted']

const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'
const LABEL = 'block text-xs text-gray-500 mb-1'
const initialsOf = (n: string) => n.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()
const collageAspectRatio = (type: SocialType, format: GraphicFormat) => {
  const { w, h } = FORMAT_SIZE[format]
  if (type === 'speaker') return w / Math.round(h * 0.5)
  if (type === 'spotlight') return 436 / (h - 112 - 28 - 190)
  if (type === 'seat_open') return 1
  const photoX = Math.round(w * 0.52)
  return (w - photoX - 64) / (h - 190 - 112 - 60)
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function PostEditor({
  seed, members, visitors, photos, onClose, onSaved, onLibraryChanged, onProfileSaved,
}: {
  seed: EditorSeed
  members: MemberLite[]
  visitors: VisitorLite[]
  photos: PhotoThumb[]
  onClose: () => void
  onSaved: () => void
  onLibraryChanged: () => void
  onProfileSaved: () => Promise<void>
}) {
  const [id] = useState(seed.id)
  const [type, setType] = useState<SocialType>(seed.type ?? 'photo')
  const [platform, setPlatform] = useState<SocialPlatform>(seed.platform ?? 'facebook')
  const [format, setFormat] = useState<GraphicFormat>(seed.format ?? 'square')
  const [date, setDate] = useState(seed.date ?? chicagoToday())
  const [status, setStatus] = useState<SocialStatus>(seed.status ?? 'drafted')
  const [memberId, setMemberId] = useState(seed.member_id ?? '')
  const [featureAudience, setFeatureAudience] = useState<'member' | 'visitor'>(seed.subject_type ?? 'member')
  const [visitorId, setVisitorId] = useState(seed.subject_type === 'visitor' ? seed.subject_id ?? '' : '')
  const [photoId, setPhotoId] = useState(seed.photo_id ?? '')
  const [photoData, setPhotoData] = useState(seed.photoData ?? '')
  const [featurePhotoIds, setFeaturePhotoIds] = useState<string[]>(seed.photo_ids ?? [])
  const [featurePhotoData, setFeaturePhotoData] = useState<Record<string, string>>({})
  const [photoLayers, setPhotoLayers] = useState<SocialPhotoLayer[]>(seed.photo_layers ?? [])
  const [includeMemberPhoto, setIncludeMemberPhoto] = useState(
    seed.photo_layers === undefined || seed.photo_layers.some((layer) => layer.photo_id === 'member-photo')
  )
  const [draggedFeaturePhotoId, setDraggedFeaturePhotoId] = useState('')
  const [title, setTitle] = useState(seed.title ?? DEFAULT_TITLE[seed.type ?? 'photo'] ?? '')
  const [subtitle, setSubtitle] = useState(seed.subtitle ?? '')
  const [role, setRole] = useState(seed.role ?? '')
  const [classification, setClassification] = useState(seed.classification ?? '')
  const [seats, setSeats] = useState(seed.seats ?? '')
  const [cardLine, setCardLine] = useState(seed.cardLine ?? '')
  const [content, setContent] = useState(seed.content ?? '')
  const [note, setNote] = useState('')
  const [wrapper, setWrapper] = useState<PhotoWrapper>(seed.wrapper ?? 'overlay')
  const [collageLayout, setCollageLayout] = useState<CollagePreset>(seed.collage_layout ?? 'freeform')
  const [flyerTemplate, setFlyerTemplate] = useState<SocialFlyerTemplate>(seed.flyer_template ?? 'classic')
  const [businessWebsite, setBusinessWebsite] = useState('')
  const [businessSummary, setBusinessSummary] = useState('')
  const [businessServices, setBusinessServices] = useState('')
  const [businessSources, setBusinessSources] = useState<{ title: string; url: string }[]>([])
  const [businessResearchedAt, setBusinessResearchedAt] = useState<string | null>(null)

  const [showCamera, setShowCamera] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [busy, setBusy] = useState('')          // 'save' | 'generate' | 'photo' | ''
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const member = members.find((m) => m.id === memberId)
  const visitor = visitors.find((v) => v.id === visitorId)
  const wantsPhoto = PHOTO_KINDS.includes(type)
  const supportsBusinessProfile = type === 'community_spotlight' || type === 'spotlight' || type === 'speaker'
  const profileSubjectType = type === 'community_spotlight' ? featureAudience : 'member'
  const profileSubjectId = profileSubjectType === 'member' ? memberId : visitorId
  const supportsCollage = COLLAGE_KINDS.includes(type)
  const supportsFlyerTemplates = type === 'community_spotlight' || type === 'spotlight' || type === 'speaker'
  const canUseMemberPhoto = (type === 'community_spotlight' && featureAudience === 'member') || type === 'spotlight' || type === 'speaker'
  const memberPortraitOmitted = supportsCollage && canUseMemberPhoto && !includeMemberPhoto
  const effectivePhoto = photoData || (wantsPhoto && !memberPortraitOmitted ? member?.photo || '' : '')
  const featurePhotoItems = useMemo(
    () => [
      ...(canUseMemberPhoto && includeMemberPhoto && member?.photo
        ? [{ id: 'member-photo', src: member.photo, label: `${member.name} portrait`, isMemberPhoto: true }]
        : []),
      ...featurePhotoIds
        .map((id) => ({ id, src: featurePhotoData[id], label: photos.find((p) => p.id === id)?.label || 'Flyer photo', isMemberPhoto: false }))
        .filter((p): p is { id: string; src: string; label: string; isMemberPhoto: false } => !!p.src),
    ].slice(0, MAX_FEATURE_PHOTOS),
    [canUseMemberPhoto, includeMemberPhoto, member?.photo, member?.name, featurePhotoIds, featurePhotoData, photos]
  )
  const featurePhotos = useMemo(
    () => featurePhotoItems.map((p) => p.src),
    [featurePhotoItems]
  )
  const collagePhotos = useMemo<CollagePhoto[]>(
    () => featurePhotoItems.map(({ id, src, label }) => ({ id, src, label, removable: true })),
    [featurePhotoItems]
  )

  useEffect(() => {
    const defaults = createPhotoLayers(featurePhotoItems.map((photo) => photo.id), collageLayout, collageAspectRatio(type, format))
    setPhotoLayers((current) => {
      const byId = new Map(current.map((layer) => [layer.photo_id, layer]))
      return defaults.map((layer) => byId.get(layer.photo_id) ?? layer)
    })
  }, [featurePhotoItems, collageLayout, type, format])

  useEffect(() => {
    const ids = (seed.photo_ids ?? []).slice(0, MAX_FEATURE_PHOTOS)
    if (!ids.length) return
    let cancelled = false
    Promise.all(ids.map(async (id) => {
      const r = await fetch(`/api/social/photos?id=${id}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || typeof d.data !== 'string') throw new Error(d.error || 'Could not load a flyer photo.')
      return [id, d.data] as const
    })).then((entries) => {
      if (!cancelled) setFeaturePhotoData(Object.fromEntries(entries))
    }).catch((e) => {
      if (!cancelled) setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load a flyer photo.' })
    })
    return () => { cancelled = true }
  }, [seed.photo_ids])

  useEffect(() => {
    if (!supportsBusinessProfile) return
    const profile = profileSubjectType === 'member' ? member?.business_profile : visitor?.business_profile
    if (profile) setBusinessProfile(profile)
  }, [supportsBusinessProfile, profileSubjectType, memberId, visitorId, member?.business_profile, visitor?.business_profile])

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
    if ((t === 'spotlight' || t === 'speaker' || t === 'welcome' || t === 'community_spotlight') && member) { setTitle(member.name); setSubtitle(member.company); if (t === 'spotlight' || t === 'welcome' || t === 'community_spotlight') setRole(member.role) }
    if (t === 'welcome' || t === 'seat_open' || t === 'community_spotlight' || t === 'speaker') setFormat('landscape')
  }

  const pickMember = (mid: string) => {
    setMemberId(mid)
    if (type === 'community_spotlight') {
      setFeatureAudience('member')
      setVisitorId('')
    }
    const m = members.find((x) => x.id === mid)
    if (m) {
      setTitle(m.name); setSubtitle(m.company); setRole(m.role); setPhotoData(''); setPhotoId('')
      setBusinessProfile(m.business_profile)
    }
  }

  const setBusinessProfile = (profile?: BusinessProfileLite | null) => {
    setBusinessWebsite(profile?.website ?? '')
    setBusinessSummary(profile?.summary ?? '')
    setBusinessServices(profile?.services ?? '')
    setBusinessSources(profile?.sources ?? [])
    setBusinessResearchedAt(profile?.researched_at ?? null)
  }

  const pickVisitor = (id: string) => {
    setVisitorId(id)
    const v = visitors.find((x) => x.id === id)
    if (v) {
      setMemberId('')
      setTitle(v.name)
      setSubtitle(v.company)
      setRole(v.role)
      setBusinessProfile(v.business_profile)
    } else {
      setBusinessProfile(null)
    }
  }

  const changeFeatureAudience = (value: 'member' | 'visitor') => {
    setFeatureAudience(value)
    setMemberId('')
    setVisitorId('')
    setTitle('')
    setSubtitle('')
    setRole('')
    setBusinessProfile(null)
  }

  const graphic: GraphicData = useMemo(() => ({
    kind: type as GraphicKind,
    title: title || DEFAULT_TITLE[type] || 'Think Big St. Louis',
    subtitle: subtitle || undefined,
    lines: type === 'seat_open' ? seats.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 3) : type === 'welcome' ? [classification, role] : type === 'spotlight' || type === 'community_spotlight' || type === 'speaker' ? (role ? [role] : []) : type === 'open_seats' ? seats.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    caption: cardLine || undefined,
    dateLabel: type === 'speaker' ? `THURSDAY · ${shortUpper(nextThursday(date))}` : undefined,
    memberPhoto: effectivePhoto || undefined,
    photos: supportsCollage ? featurePhotos : undefined,
    photoIds: supportsCollage ? collagePhotos.map((photo) => photo.id) : undefined,
    photoLayers: supportsCollage ? photoLayers : undefined,
    collageLayout,
    flyerTemplate: supportsFlyerTemplates ? flyerTemplate : 'classic',
    wrapper: type === 'photo' ? wrapper : undefined,
    initials: initialsOf(title || 'TB'),
  }), [type, title, subtitle, role, seats, cardLine, date, effectivePhoto, wrapper, featurePhotos, collagePhotos, photoLayers, collageLayout, flyerTemplate, supportsCollage, supportsFlyerTemplates])

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

  const removeFeaturePhoto = (id: string) => {
    if (id === 'member-photo') setIncludeMemberPhoto(false)
    else setFeaturePhotoIds((ids) => ids.filter((photoId) => photoId !== id))
  }

  const toggleMemberPhoto = (include: boolean) => {
    if (include && featurePhotoIds.length >= MAX_FEATURE_PHOTOS) {
      setMsg({ ok: false, text: 'Remove a flyer photo before adding the member portrait.' })
      return
    }
    setIncludeMemberPhoto(include)
  }

  const toggleFeaturePhoto = async (p: PhotoThumb) => {
    if (featurePhotoIds.includes(p.id)) {
      setFeaturePhotoIds((ids) => ids.filter((id) => id !== p.id))
      return
    }
    const memberPhotoCount = canUseMemberPhoto && includeMemberPhoto && member?.photo ? 1 : 0
    if (featurePhotoIds.length >= MAX_FEATURE_PHOTOS - memberPhotoCount) {
      setMsg({ ok: false, text: `Choose up to ${MAX_FEATURE_PHOTOS - memberPhotoCount} additional photos for the flyer.` })
      return
    }
    setBusy('photo'); setMsg(null)
    try {
      const r = await fetch(`/api/social/photos?id=${p.id}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || typeof d.data !== 'string') throw new Error(d.error || 'Could not load that photo.')
      setFeaturePhotoData((data) => ({ ...data, [p.id]: d.data }))
      setFeaturePhotoIds((ids) => ids.includes(p.id) ? ids : [...ids, p.id])
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load that photo.' })
    } finally { setBusy('') }
  }

  const uploadFeaturePhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const selected = Array.from(files)
    const memberPhotoCount = canUseMemberPhoto && includeMemberPhoto && member?.photo ? 1 : 0
    if (featurePhotoIds.length + selected.length > MAX_FEATURE_PHOTOS - memberPhotoCount) {
      setMsg({ ok: false, text: `Choose no more than ${MAX_FEATURE_PHOTOS - memberPhotoCount} additional photos.` })
      return
    }
    setBusy('photo'); setMsg(null)
    let uploaded = 0
    try {
      for (const file of selected) {
        const img = await processImage(file)
        const id = await uploadPhoto(img, canUseMemberPhoto ? memberId : '')
        uploaded += 1
        setFeaturePhotoData((data) => ({ ...data, [id]: img.data }))
        setFeaturePhotoIds((ids) => ids.includes(id) ? ids : [...ids, id])
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not upload the selected photos.' })
    } finally {
      if (uploaded) onLibraryChanged()
      setBusy('')
    }
  }

  const dropFeaturePhoto = (targetId: string) => {
    if (!draggedFeaturePhotoId || draggedFeaturePhotoId === targetId) return
    setFeaturePhotoIds((ids) => {
      const from = ids.indexOf(draggedFeaturePhotoId)
      const to = ids.indexOf(targetId)
      if (from < 0 || to < 0) return ids
      const next = ids.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDraggedFeaturePhotoId('')
  }

  const researchBusiness = async () => {
    if (!businessWebsite.trim()) {
      setMsg({ ok: false, text: 'Enter the business’s official website first.' })
      return
    }
    setBusy('research'); setMsg(null)
    try {
      const res = await fetch('/api/marketing/business-research', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: businessWebsite, company: subtitle, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not research this business.')
      setBusinessWebsite(data.website)
      setBusinessSummary(data.summary)
      setBusinessServices(data.services)
      setBusinessSources(data.sources)
      setBusinessResearchedAt(data.researched_at)
      setMsg({ ok: true, text: 'Research draft ready. Review and edit the facts, then approve to save them.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not research this business.' })
    } finally { setBusy('') }
  }

  const approveBusinessProfile = async () => {
    if (!profileSubjectId) {
      setMsg({ ok: false, text: `Select a saved ${profileSubjectType} record before saving its business profile.` })
      return
    }
    setBusy('profile'); setMsg(null)
    try {
      const res = await fetch('/api/marketing/business-profile', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_type: profileSubjectType,
          subject_id: profileSubjectId,
          profile: {
            website: businessWebsite,
            summary: businessSummary,
            services: businessServices,
            sources: businessSources,
            researched_at: businessResearchedAt,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save the business profile.')
      setMsg({ ok: true, text: 'Approved and saved to the business profile.' })
      try {
        await onProfileSaved()
      } catch {
        setMsg({ ok: false, text: 'Business profile saved, but the directory could not be refreshed.' })
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the business profile.' })
    } finally { setBusy('') }
  }

  // ── caption ──
  const generate = async () => {
    setBusy('generate'); setMsg(null)
    try {
      const isPerson = type === 'spotlight' || type === 'speaker' || type === 'welcome' || type === 'community_spotlight'
      const res = await fetch('/api/social/caption', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, platform,
          facts: {
            name: isPerson ? title : '', company: isPerson ? subtitle : '', role: type === 'spotlight' || type === 'welcome' || type === 'community_spotlight' || type === 'speaker' ? role : '',
            subject_type: type === 'community_spotlight' ? featureAudience : '',
            business_summary: ['community_spotlight', 'spotlight', 'speaker'].includes(type) ? businessSummary : '',
            services: ['community_spotlight', 'spotlight', 'speaker'].includes(type) ? businessServices : '',
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
      date, platform, type, content, status: st, member_id: memberId,
      photo_id: supportsCollage ? featurePhotoIds[0] ?? photoId : photoId, format,
      week_of: seed.week_of ?? '', source: seed.source === 'plan' ? 'plan' : 'manual',
      graphic: {
        kind: type, title: graphic.title, subtitle: graphic.subtitle ?? '', lines: graphic.lines ?? [],
        caption: cardLine, dateLabel: graphic.dateLabel ?? '', wrapper: type === 'photo' ? wrapper : '',
        photo_ids: supportsCollage ? featurePhotoIds : [],
        photo_layers: supportsCollage ? photoLayers : [],
        flyer_template: supportsFlyerTemplates ? flyerTemplate : 'classic',
        subject_type: type === 'community_spotlight' ? featureAudience : '',
        subject_id: type === 'community_spotlight' && featureAudience === 'visitor' ? visitorId : '',
        collage_layout: supportsCollage ? collageLayout : 'grid',
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
            {(wantsPhoto || supportsCollage) && (
              <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white">{supportsCollage ? 'Flyer photos' : 'Photo'}</p>
                {supportsCollage ? (
                  <>
                    <p className="text-xs text-gray-500">Arrange up to four photos. Drag, resize, rotate, zoom, and layer them. Select a photo and choose Remove to take it out of the flyer.</p>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center gap-1.5 bg-brand-blue text-white px-3 py-2 rounded-lg text-sm font-medium cursor-pointer">
                        <Upload className="w-4 h-4" /> Upload photos
                        <input type="file" accept="image/*" multiple disabled={busy === 'photo'} className="hidden" onChange={(e) => { uploadFeaturePhotos(e.target.files); e.currentTarget.value = '' }} />
                      </label>
                      <button onClick={() => setShowLibrary((v) => !v)} disabled={busy === 'photo'} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm disabled:opacity-50"><ImageIcon className="w-4 h-4" /> Library ({photos.length})</button>
                      {busy === 'photo' && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
                    </div>
                    {canUseMemberPhoto && member?.photo && (
                      <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                        <input type="checkbox" checked={includeMemberPhoto} onChange={(event) => toggleMemberPhoto(event.target.checked)} />
                        Include member portrait
                      </label>
                    )}
                    {featurePhotos.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {featurePhotoItems.map((photo, i) => (
                          <div
                            key={photo.id}
                            draggable={!photo.isMemberPhoto}
                            onDragStart={() => setDraggedFeaturePhotoId(photo.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => dropFeaturePhoto(photo.id)}
                            onDragEnd={() => setDraggedFeaturePhotoId('')}
                            title={photo.isMemberPhoto ? 'Member photo stays first' : 'Drag to reorder'}
                            className={`relative aspect-square rounded-lg overflow-hidden border border-gray-700 ${photo.isMemberPhoto ? '' : 'cursor-grab active:cursor-grabbing'}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.src} alt={`Flyer photo ${i + 1}`} className="w-full h-full object-cover" />
                            {!photo.isMemberPhoto && <GripVertical className="absolute bottom-1 left-1 w-5 h-5 text-white drop-shadow" />}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                removeFeaturePhoto(photo.id)
                              }}
                              aria-label="Remove flyer photo"
                              title="Remove from flyer"
                              className="absolute top-1 right-1 bg-black/75 text-white rounded-full w-7 h-7 grid place-items-center text-base leading-none hover:bg-red-700"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <CollageEditor
                      photos={collagePhotos}
                      layers={photoLayers}
                      preset={collageLayout}
                      aspectRatio={collageAspectRatio(type, format)}
                      onChange={setPhotoLayers}
                      onRemove={removeFeaturePhoto}
                      onPresetChange={(preset) => {
                        setCollageLayout(preset)
                        setPhotoLayers(createPhotoLayers(collagePhotos.map((photo) => photo.id), preset, collageAspectRatio(type, format)))
                      }}
                    />
                    {supportsFlyerTemplates && (
                      <div className="space-y-2 border-t border-gray-800 pt-3">
                        <p className="text-xs font-medium text-gray-300">Flyer design</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {([
                            ['classic', 'Classic', 'Existing branded layout'],
                            ['photo-top', 'Photo-led', 'Large collage above the story'],
                            ['editorial', 'Editorial split', 'Photo column beside the story'],
                          ] as const).map(([value, label, description]) => (
                            <button key={value} type="button" onClick={() => setFlyerTemplate(value)}
                              aria-pressed={flyerTemplate === value}
                              className={`rounded-lg border p-2 text-left ${flyerTemplate === value ? 'border-brand-blue bg-brand-blue/10 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                              <span className="block text-xs font-semibold">{label}</span>
                              <span className="mt-1 block text-[11px] text-gray-500">{description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {showLibrary && (
                      photos.length === 0 ? <p className="text-xs text-gray-500">No photos yet. Upload a few to get started.</p> : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                          {photos.map((p) => {
                            const selected = featurePhotoIds.includes(p.id)
                            return (
                              <button key={p.id} onClick={() => toggleFeaturePhoto(p)} aria-pressed={selected}
                                className={`relative aspect-square rounded-lg overflow-hidden border ${selected ? 'border-brand-blue ring-2 ring-brand-blue' : 'border-gray-700 hover:border-brand-blue'}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.thumb} alt={p.label || 'Library photo'} className="w-full h-full object-cover" />
                                {selected && <Check className="absolute top-1 right-1 w-5 h-5 text-white drop-shadow" />}
                              </button>
                            )
                          })}
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )}

            {/* Content fields */}
            <div className="grid sm:grid-cols-2 gap-3">
              {type === 'community_spotlight' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Who are we featuring?</label>
                  <select value={featureAudience} onChange={(e) => changeFeatureAudience(e.target.value as 'member' | 'visitor')} className={INPUT}>
                    <option value="member">Think Big member</option>
                    <option value="visitor">Chapter visitor</option>
                  </select>
                </div>
              )}
              {(type === 'spotlight' || type === 'speaker' || type === 'welcome' || (type === 'community_spotlight' && featureAudience === 'member')) && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>{type === 'speaker' ? 'Speaker (member)' : 'Member'}</label>
                  <select value={memberId} onChange={(e) => pickMember(e.target.value)} className={INPUT}>
                    <option value="">Choose a member…</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.company ? ` · ${m.company}` : ''}</option>)}
                  </select>
                </div>
              )}
              {type === 'community_spotlight' && featureAudience === 'visitor' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Saved visitor (or enter details below)</label>
                  <select value={visitorId} onChange={(e) => pickVisitor(e.target.value)} className={INPUT}>
                    <option value="">Enter visitor manually</option>
                    {visitors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.company ? ` · ${v.company}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className={type === 'open_seats' || type === 'meeting_day' ? 'sm:col-span-2' : ''}>
                <label className={LABEL}>{type === 'spotlight' || type === 'speaker' || type === 'welcome' || type === 'community_spotlight' ? 'Name' : type === 'seat_open' ? 'Business category' : 'Headline'}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
              </div>
              {(type === 'spotlight' || type === 'speaker' || type === 'welcome' || type === 'community_spotlight' || type === 'open_seats' || type === 'seat_open') && (
                <div>
                  <label className={LABEL}>{type === 'open_seats' ? 'Supporting line' : type === 'seat_open' ? 'Script line' : 'Business / company'}</label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={INPUT} />
                </div>
              )}
              {type === 'welcome' && (
                <div>
                  <label className={LABEL}>Classification (on the card)</label>
                  <input value={classification} onChange={(e) => setClassification(e.target.value)} className={INPUT} placeholder="Real Estate Services" />
                </div>
              )}
              {(type === 'spotlight' || type === 'welcome' || type === 'community_spotlight' || type === 'speaker') && (
                <div>
                  <label className={LABEL}>{type === 'community_spotlight' ? 'What they do / specialty' : type === 'speaker' ? '10-minute presentation topic' : 'Role'}</label>
                  <input value={role} onChange={(e) => setRole(e.target.value)} className={INPUT} />
                </div>
              )}
              {supportsBusinessProfile && (
                <section className="sm:col-span-2 bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Business profile research</p>
                    <p className="text-xs text-gray-500 mt-1">Research the official website, review the draft facts, then approve them to save to the selected record.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} className={INPUT} placeholder="https://business-website.com" aria-label="Official business website" />
                    <button onClick={researchBusiness} disabled={busy === 'research' || busy === 'profile'} className="shrink-0 flex items-center justify-center gap-1.5 bg-brand-blue text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50">
                      {busy === 'research' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Research website
                    </button>
                  </div>
                  <div>
                    <label className={LABEL}>Business summary</label>
                    <textarea value={businessSummary} onChange={(e) => setBusinessSummary(e.target.value)} rows={3} maxLength={2000} className={INPUT} placeholder="Review or edit the researched summary." />
                  </div>
                  <div>
                    <label className={LABEL}>Services and products</label>
                    <textarea value={businessServices} onChange={(e) => setBusinessServices(e.target.value)} rows={3} maxLength={2000} className={INPUT} placeholder="Review or edit the services and products." />
                  </div>
                  {businessSources.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <p>Research source{businessSources.length > 1 ? 's' : ''}{businessResearchedAt ? ` · ${new Date(businessResearchedAt).toLocaleDateString()}` : ''}</p>
                      {businessSources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-brand-blue underline break-all">{source.title}: {source.url}</a>
                      ))}
                    </div>
                  )}
                  <button onClick={approveBusinessProfile} disabled={busy === 'profile' || busy === 'research' || !profileSubjectId} className="border border-green-600/50 text-green-400 px-4 py-2 rounded-lg text-sm disabled:opacity-40">
                  {busy === 'profile' ? 'Saving profile…' : `Approve & save ${profileSubjectType} business profile`}
                  </button>
                  {!profileSubjectId && <p className="text-xs text-yellow-400">Choose a saved member or visitor to save this profile to the database.</p>}
                </section>
              )}
              {type === 'seat_open' && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Great fit lines (separate with |)</label>
                  <input value={seats} onChange={(e) => setSeats(e.target.value)} className={INPUT} placeholder="Established local CPA | Loves helping owners | Ready for Thursdays" />
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
              placeholder={type === 'speaker' ? 'What will their 10-minute talk cover? (optional)' : type === 'community_spotlight' ? 'Anything else about this person, their business, or their visit (optional)' : type === 'spotlight' ? 'Anything else people should know about this member (optional)' : type === 'win' ? 'What happened? (the AI only uses what you write here)' : type === 'photo' ? "What's in the photo? (optional)" : type === 'evergreen' ? 'Topic (optional)' : 'Anything the writer should know (optional)'} />
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
