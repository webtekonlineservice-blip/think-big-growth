'use client'

import { useState, useEffect, useCallback } from 'react'

const YOUTUBE_ID = 'JTLWbaIKJuw'

export default function VideoModal() {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, close])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-base px-8 py-4 group"
        type="button"
      >
        <svg className="w-5 h-5 text-brand-red group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Watch Video
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={close}
          />

          {/* Content */}
          <div className="relative w-full max-w-4xl z-10">
            {/* Close */}
            <button
              onClick={close}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2"
              aria-label="Close video"
              type="button"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 16:9 video container */}
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-gray-700/50 bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1`}
                title="Think Big St. Louis — BNI Chapter"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>

            <p className="text-center text-gray-400 text-sm mt-4">
              Think Big St. Louis · BNI Chapter · Every Thursday 11:30 AM
            </p>
          </div>
        </div>
      )}
    </>
  )
}
