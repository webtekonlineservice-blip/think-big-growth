'use client'

import { useCallback, useRef, useState } from 'react'
import { X, Camera, Image as ImageIcon, Upload, Sparkles, Loader2, Copy, Check, Share2, Download, ExternalLink } from 'lucide-react'
import SocialGraphic, { GraphicData, GraphicFormat, PhotoWrapper, PHOTO_WRAPPERS } from '@/components/SocialGraphic'
import CameraCapture from '@/components/CameraCapture'
import { processImage, ProcessedImage } from '@/lib/imageUtils'
import { chicagoToday } from '@/lib/socialDates'
import { FACEBOOK_PAGE_URL, LINKEDIN_PROFILE_URL } from '@/lib/socialChannels'
import { PhotoThumb, uploadPhoto } from '@/components/marketing/PostEditor'

const CHIPS = [
  'Thursday meeting recap',
  'Welcoming a new member',
  'Guest day',
  'Thank you to our speaker',
  'Open seat: ',
]
const INPUT = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue/50'

type Step = 'photo' | 'subject' | 'review'
type Tone = 'witty' | 'heartfelt' | 'direct'
interface Option { headline: string; cardLine: string; facebook: string; linkedin: string; angle?: string }
const TONES: { id: Tone; label: string }[] = [
  { id: 'witty', label: '😄 Witty' },
  { id: 'heartfelt', label: '❤️ Heartfelt' },
  { id: 'direct', label: '🎯 Direct' },
]
type Platform = 'facebook' | 'linkedin'

export default function QuickPost({
  photos, onClose, onSaved, onLibraryChanged,
}: {
  photos: PhotoThumb[]
  onClose: () => void
  onSaved: () => void
  onLibraryChanged: () => void
}) {
  const [step, setStep] = useState<Step>('photo')
  const [showCamera, setShowCamera] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [photoData, setPhotoData] = useState('')
  const [photoId, setPhotoId] = useState('')
  const [subject, setSubject] = useState('')
  const [format, setFormat] = useState<GraphicFormat>('portrait')
  const [wrapper, setWrapper] = useState<PhotoWrapper>('overlay')
  const [headline, setHeadline] = useState('')
  const [cardLine, setCardLine] = useState('')
  const [facebook, setFacebook] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [tab, setTab] = useState<Platform>('facebook')
  const [tone, setTone] = useState<Tone>('witty')
  const [options, setOptions] = useState<Option[]>([])
  const [pick, setPick] = useState(0)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onRendered = useCallback((c: HTMLCanvasElement) => { canvasRef.current = c }, [])

  const caption = tab === 'facebook' ? facebook : linkedin
  const setCaption = tab === 'facebook' ? setFacebook : setLinkedin

  const graphic: GraphicData = {
    kind: 'photo',
    title: headline || 'Thursday at Think Big',
    caption: cardLine || undefined,
    memberPhoto: photoData || undefined,
    wrapper,
  }

  // ── photo ──
  const takeImage = async (img: ProcessedImage) => {
    setPhotoData(img.data); setPhotoId(''); setStep('subject'); setMsg(null)
    try {
      const pid = await uploadPhoto(img)
      setPhotoId(pid); onLibraryChanged()
    } catch { /* the post still works without a library copy */ }
  }
  const onFile = async (file?: File | null) => {
    if (!file) return
    setBusy('photo')
    try { await takeImage(await processImage(file)) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not read that image.' }) }
    finally { setBusy('') }
  }
  const pickLibrary = async (p: PhotoThumb) => {
    setBusy('photo'); setMsg(null)
    try {
      const r = await fetch(`/api/social/photos?id=${p.id}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not load that photo.')
      setPhotoData(d.data); setPhotoId(p.id); setStep('subject')
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load that photo.' }) }
    finally { setBusy('') }
  }

  // ── write ──
  const write = async () => {
    if (subject.trim().length < 3) { setMsg({ ok: false, text: 'Add a few words about the post first.' }); return }
    setBusy('write'); setMsg(null)
    try {
      const res = await fetch('/api/social/quick', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, tone }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Could not write the posts.')
      const opts: Option[] = Array.isArray(d.options) && d.options.length ? d.options : [d]
      setOptions(opts); applyOption(opts, 0)
      setStep('review'); setSaved(false)
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not write the posts.' }) }
    finally { setBusy('') }
  }

  const applyOption = (opts: Option[], i: number) => {
    const o = opts[i]
    if (!o) return
    setPick(i); setHeadline(o.headline); setCardLine(o.cardLine); setFacebook(o.facebook); setLinkedin(o.linkedin); setSaved(false)
  }

  // ── output ──
  const getBlob = () => new Promise<Blob | null>((resolve) => {
    if (!canvasRef.current) return resolve(null)
    canvasRef.current.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
  const copy = async () => {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1800); return true }
    catch { setMsg({ ok: false, text: 'Copy failed. Select the caption and copy it by hand.' }); return false }
  }
  const download = async () => {
    const blob = await getBlob()
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `think-big-${chicagoToday()}-${format}.jpg`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const share = async () => {
    setMsg(null)
    await copy() // most apps drop shared text when a file is attached, so the caption goes to the clipboard too
    const blob = await getBlob()
    if (!blob) return
    const file = new File([blob], `think-big-${chicagoToday()}.jpg`, { type: 'image/jpeg' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text: caption })
        setMsg({ ok: true, text: 'Caption copied. Paste it if the app did not fill it in.' })
      } catch { /* user cancelled */ }
    } else {
      await download()
      setMsg({ ok: true, text: 'Caption copied and image downloaded. Open the page and attach the image.' })
    }
  }
  const saveBoth = async (status: 'drafted' | 'posted'): Promise<boolean> => {
    setBusy('save'); setMsg(null)
    const g = { kind: 'photo', title: graphic.title, subtitle: '', lines: [], caption: cardLine, dateLabel: '', wrapper }
    try {
      for (const [platform, content] of [['facebook', facebook], ['linkedin', linkedin]] as const) {
        const res = await fetch('/api/social/posts', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: chicagoToday(), platform, type: 'photo', content, status, photo_id: photoId, graphic: g, format, source: 'manual' }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error || 'Could not save the posts.')
      }
      setSaved(true); onSaved()
      setMsg({ ok: true, text: status === 'posted' ? 'Saved as posted.' : 'Saved to All posts as drafts.' })
      return true
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the posts.' }); return false }
    finally { setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">New post from a photo</h2>
            <p className="text-xs text-gray-500">Step {step === 'photo' ? 1 : step === 'subject' ? 2 : 3} of 3</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {msg && <p className={`text-sm mb-3 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

        {/* ── Step 1 ── */}
        {step === 'photo' && (
          <div className="space-y-3">
            <button onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center gap-2 bg-brand-blue text-white py-4 rounded-xl text-base font-semibold">
              <Camera className="w-5 h-5" /> Take a photo
            </button>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-3 rounded-xl text-sm cursor-pointer">
                <Upload className="w-4 h-4" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              <button onClick={() => setShowLibrary((v) => !v)} className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-3 rounded-xl text-sm">
                <ImageIcon className="w-4 h-4" /> Library ({photos.length})
              </button>
            </div>
            {busy === 'photo' && <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />}
            {showLibrary && (
              photos.length === 0 ? <p className="text-xs text-gray-500">No photos yet.</p> : (
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {photos.map((p) => (
                    <button key={p.id} onClick={() => pickLibrary(p)} className="aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-brand-blue">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumb} alt={p.label || 'Library photo'} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 'subject' && (
          <div className="space-y-3">
            {photoData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoData} alt="Your photo" className="w-full max-h-64 object-cover rounded-xl border border-gray-700" />
            )}
            <label className="block text-sm text-gray-300">What is this post about?</label>
            <textarea value={subject} onChange={(e) => setSubject(e.target.value)} rows={3} className={INPUT}
              placeholder="e.g. Great turnout Thursday, Dana gave a 10-minute talk on estate planning" />
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setSubject((s) => (s ? `${s.trim()}. ${c}` : c))}
                  className="px-3 py-1.5 rounded-full text-xs border border-gray-700 text-gray-400 hover:text-white">{c.trim()}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Tone</span>
              {TONES.map((t) => (
                <button key={t.id} onClick={() => setTone(t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${tone === t.id ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>{t.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-600">You get 3 different takes. The writer only uses facts you give it here. Meeting details and the Webtek credit are added automatically.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep('photo')} className="border border-gray-700 text-gray-300 px-4 py-3 rounded-xl text-sm">Back</button>
              <button onClick={write} disabled={busy === 'write'} className="flex-1 flex items-center justify-center gap-2 bg-brand-blue text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                {busy === 'write' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Write my posts
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 'review' && (
          <div className="space-y-4">
            {options.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {options.map((o, i) => (
                  <button key={i} onClick={() => applyOption(options, i)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${pick === i ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>
                    Option {i + 1}{o.angle ? ` · ${o.angle}` : ''}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {PHOTO_WRAPPERS.map((w) => (
                <button key={w.id} onClick={() => setWrapper(w.id)}
                  className={`px-3 py-1 rounded-full text-xs border ${wrapper === w.id ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>{w.label}</button>
              ))}
              <button onClick={() => setFormat(format === 'portrait' ? 'square' : 'portrait')} className="ml-auto text-xs text-gray-400 underline">
                {format === 'portrait' ? 'Portrait 4:5' : 'Square 1:1'}
              </button>
            </div>

            <SocialGraphic data={graphic} format={format} compact fileName="think-big-photo" onRendered={onRendered} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Headline on image</label>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Line on image</label>
                <input value={cardLine} onChange={(e) => setCardLine(e.target.value)} maxLength={140} className={INPUT} />
              </div>
            </div>

            <div className="flex gap-2">
              {(['facebook', 'linkedin'] as Platform[]).map((p) => (
                <button key={p} onClick={() => setTab(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tab === p ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400'}`}>
                  {p === 'facebook' ? 'Facebook' : 'LinkedIn'}
                </button>
              ))}
            </div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={11} className={INPUT + ' leading-relaxed'} />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={share} className="col-span-2 flex items-center justify-center gap-2 bg-brand-blue text-white py-3 rounded-xl text-sm font-semibold">
                <Share2 className="w-4 h-4" /> Share image + caption
              </button>
              <button onClick={copy} className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-2.5 rounded-xl text-sm">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy caption'}
              </button>
              <button onClick={download} className="flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 py-2.5 rounded-xl text-sm">
                <Download className="w-4 h-4" /> Save image
              </button>
              <a href={tab === 'facebook' ? FACEBOOK_PAGE_URL : LINKEDIN_PROFILE_URL} target="_blank" rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-center gap-1.5 text-xs text-brand-blue py-1">
                <ExternalLink className="w-3.5 h-3.5" /> Open {tab === 'facebook' ? 'the Facebook page' : 'LinkedIn'}
              </a>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => setStep('subject')} className="border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm">Rewrite</button>
              <button onClick={write} disabled={busy === 'write'} className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm disabled:opacity-50">
                {busy === 'write' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Regenerate
              </button>
              <button onClick={() => saveBoth('drafted')} disabled={busy === 'save' || saved} className="border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">
                {saved ? 'Saved' : 'Save both'}
              </button>
              <button onClick={async () => { if (await saveBoth('posted')) onClose() }} disabled={busy === 'save' || saved}
                className="border border-green-600/50 text-green-400 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">Mark posted</button>
            </div>
          </div>
        )}
      </div>

      {showCamera && (
        <CameraCapture
          aspect={0.8}
          onClose={() => setShowCamera(false)}
          onCapture={(img) => { setShowCamera(false); takeImage(img) }}
        />
      )}
    </div>
  )
}
