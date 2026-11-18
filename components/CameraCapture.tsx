'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, RefreshCw, Image as ImageIcon, Check, RotateCcw } from 'lucide-react'
import { processImage, renderToJpeg, ProcessedImage } from '@/lib/imageUtils'

/**
 * In-app camera. Shows a live viewfinder with the branded header/footer
 * zones drawn over it so the shot is framed for the final graphic.
 * Falls back to the phone's native camera (file input) if live video is
 * blocked or unsupported. Needs HTTPS, which production has.
 */

const HEADER_PX = 190
const FOOTER_PX = 112

export default function CameraCapture({
  aspect, onCapture, onClose,
}: {
  aspect: number                       // width / height of the final graphic (1 or 0.8)
  onCapture: (img: ProcessedImage) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [shot, setShot] = useState<ProcessedImage | null>(null)
  const [busy, setBusy] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (shot) return
    let cancelled = false
    setReady(false)
    setError('')
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is not available in this browser.')
        stop()
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; await v.play().catch(() => undefined) }
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the camera.')
      }
    })()
    return () => { cancelled = true }
  }, [facing, shot, stop])

  useEffect(() => stop, [stop])

  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const data = renderToJpeg(v, v.videoWidth, v.videoHeight, { maxSide: 1600, quality: 0.85, aspect })
    const thumb = renderToJpeg(v, v.videoWidth, v.videoHeight, { maxSide: 320, quality: 0.7, aspect })
    stop()
    setShot({ data, thumb })
  }

  const fromFile = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      stop()
      setShot(await processImage(file, aspect))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo.')
    } finally { setBusy(false) }
  }

  const finalH = 1080 / aspect
  const topPct = (HEADER_PX / finalH) * 100
  const botPct = (FOOTER_PX / finalH) * 100
  const frameStyle = { aspectRatio: `${aspect}`, maxHeight: '66vh', maxWidth: `calc(66vh * ${aspect})` }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-semibold">{shot ? 'Use this photo?' : 'Take a photo'}</p>
        <button onClick={() => { stop(); onClose() }} aria-label="Close camera" className="p-1 text-gray-300 hover:text-white"><X className="w-6 h-6" /></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-3 gap-4 overflow-hidden">
        <div className="relative w-full bg-gray-900 rounded-xl overflow-hidden" style={frameStyle}>
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.data} alt="Captured" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
          )}

          {/* Branded zones: the header and footer will cover these parts of the photo */}
          <div className="absolute inset-x-0 top-0 bg-black/55 border-b border-dashed border-white/40 flex items-center justify-center" style={{ height: `${topPct}%` }}>
            <span className="text-[10px] tracking-widest text-white/80 font-semibold">BNI HEADER</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-black/55 border-t border-dashed border-white/40 flex items-center justify-center" style={{ height: `${botPct}%` }}>
            <span className="text-[10px] tracking-widest text-white/80 font-semibold">MEETING + WEBTEK FOOTER</span>
          </div>

          {!ready && !shot && !error && (
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /></div>
          )}
        </div>

        {error && !shot && (
          <div className="max-w-sm text-center space-y-3">
            <p className="text-sm text-yellow-300">{error}</p>
            <label className="inline-flex items-center gap-2 bg-brand-blue text-white px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer">
              Open phone camera
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </div>

      <div className="px-6 pb-8 pt-3 flex items-center justify-between max-w-md w-full mx-auto">
        {shot ? (
          <>
            <button onClick={() => setShot(null)} className="flex items-center gap-2 text-gray-200 px-4 py-3 rounded-xl border border-gray-600 text-sm">
              <RotateCcw className="w-4 h-4" /> Retake
            </button>
            <button onClick={() => onCapture(shot)} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-semibold">
              <Check className="w-4 h-4" /> Use photo
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col items-center gap-1 text-gray-300 text-[11px] cursor-pointer">
              <span className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center"><ImageIcon className="w-5 h-5" /></span>
              {busy ? 'Reading…' : 'Library'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
            </label>
            <button onClick={snap} disabled={!ready} aria-label="Take photo"
              className="w-[72px] h-[72px] rounded-full bg-white border-4 border-gray-400 active:scale-95 transition disabled:opacity-40" />
            <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} aria-label="Flip camera"
              className="flex flex-col items-center gap-1 text-gray-300 text-[11px]">
              <span className="w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center"><RefreshCw className="w-5 h-5" /></span>
              Flip
            </button>
          </>
        )}
      </div>
    </div>
  )
}
