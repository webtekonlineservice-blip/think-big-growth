'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * BNI-branded social graphics — 1080×1080 canvas renderer.
 * Uses HTML Canvas (not SVG) so images load properly (cross-origin),
 * text wraps correctly, and nothing ever cuts off.
 *
 * Three card types:
 *   spotlight  – photo fills left half, name/role/caption on dark right
 *   speaker    – photo fills top 55%, name large + company chip on dark bottom
 *   red cards  – dark bg, white content card (open seats / promo / invite / win)
 */

const S = 1080
const RED = '#D81F2E'
const RED2 = '#ee3344'
const DARK = '#0e1115'
const DARK2 = '#16191f'
const WHITE = '#ffffff'
const OFFWHITE = 'rgba(255,255,255,0.85)'
const MUTED = 'rgba(255,255,255,0.45)'
const MEETING = "Thursdays · 11:30 AM · Mike Duffy's Pub & Grill, Kirkwood"

export interface GraphicData {
  kind: 'open_seats' | 'speaker' | 'spotlight' | 'meeting_promo' | 'visitor_invite' | 'win'
  title: string           // member name (spotlight/speaker) or card headline
  subtitle?: string       // company name
  lines?: string[]        // role (index 0) or open-seat list
  caption?: string        // AI-generated story text shown inside the card
  footerCta?: string      // override the default CTA line
  memberPhoto?: string    // data URI – fetched from BNI or uploaded
  memberLogo?: string     // business logo data URI (fallback)
  initials?: string       // fallback when no photo/logo
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines = 99
): number {
  const words = text.split(/\s+/)
  let line = ''
  let drawn = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      if (drawn >= maxLines) break
      ctx.fillText(line, x, y + drawn * lineH)
      drawn++
      line = word
    } else {
      line = test
    }
  }
  if (line && drawn < maxLines) {
    ctx.fillText(line, x, y + drawn * lineH)
    drawn++
  }
  return drawn
}

function drawGradientBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  const g = ctx.createLinearGradient(x, y, x + w, y)
  g.addColorStop(0, RED)
  g.addColorStop(1, RED2)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
}

function drawBniChip(ctx: CanvasRenderingContext2D, x: number, y: number, bniImg: HTMLImageElement | null) {
  // white chip
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 20
  roundRect(ctx, x, y, 210, 96, 14)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.shadowBlur = 0

  if (bniImg) {
    // draw BNI logo image inside chip
    const aspect = bniImg.naturalWidth / bniImg.naturalHeight
    const imgH = 58
    const imgW = imgH * aspect
    ctx.drawImage(bniImg, x + (210 - imgW) / 2, y + (96 - imgH) / 2, imgW, imgH)
  } else {
    // text fallback
    ctx.font = '900 58px Arial'
    ctx.fillStyle = RED
    ctx.textAlign = 'center'
    ctx.fillText('BNI', x + 105, y + 68)
    ctx.font = '900 18px Arial'
    ctx.fillText('®', x + 162, y + 30)
    ctx.textAlign = 'left'
  }
}

function drawChapterName(ctx: CanvasRenderingContext2D, onDark: boolean) {
  const c1 = onDark ? WHITE : '#111318'
  const c2 = onDark ? 'rgba(255,255,255,0.5)' : '#6b7280'
  ctx.textAlign = 'right'
  ctx.font = '800 26px Arial'
  ctx.fillStyle = c1
  ctx.fillText('THINK BIG ST. LOUIS', S - 56, 102)
  ctx.font = '400 20px Arial'
  ctx.fillStyle = c2
  ctx.fillText('KIRKWOOD, MO', S - 56, 134)
  ctx.textAlign = 'left'
}

function drawCirclePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number, cy: number, r: number,
  initials: string,
  ringColor = RED
) {
  ctx.save()
  // red ring
  ctx.beginPath()
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
  ctx.strokeStyle = ringColor
  ctx.lineWidth = 7
  ctx.stroke()

  // clip to circle
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  if (img) {
    // draw image centered and cropped
    const side = r * 2
    ctx.drawImage(img, cx - r, cy - r, side, side)
  } else {
    // initials fallback
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, RED)
    g.addColorStop(1, '#9b1020')
    ctx.fillStyle = g
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = WHITE
    ctx.font = `900 ${Math.floor(r * 0.8)}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, cx, cy)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

function chip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  bg: string, textColor: string,
  fontSize = 26, padding = 32, height = 52
) {
  ctx.font = `700 ${fontSize}px Arial`
  const tw = ctx.measureText(text).width
  const w = tw + padding * 2
  roundRect(ctx, x, y, w, height, height / 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.fillStyle = textColor
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padding, y + height / 2)
  ctx.textBaseline = 'alphabetic'
  return w
}

// ─── Card renderers ──────────────────────────────────────────────────────────

function drawSpotlight(
  ctx: CanvasRenderingContext2D,
  d: GraphicData,
  photo: HTMLImageElement | null,
  bni: HTMLImageElement | null
) {
  // Dark background
  const bg = ctx.createLinearGradient(0, 0, 0, S)
  bg.addColorStop(0, DARK2)
  bg.addColorStop(1, DARK)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // Photo fills LEFT half (full bleed, clipped)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, S * 0.48, S)
  ctx.clip()
  if (photo) {
    // cover-fit into left half
    const ph = S
    const pw = ph * (photo.naturalWidth / photo.naturalHeight)
    const ox = pw > S * 0.48 ? -(pw - S * 0.48) / 2 : 0
    ctx.drawImage(photo, ox, 0, pw, ph)
  } else {
    // initials circle centered in left half
    drawCirclePhoto(ctx, null, S * 0.24, S * 0.5, 180, d.initials || 'TB')
  }
  ctx.restore()

  // Gradient over left photo (right edge fade into dark bg)
  const fade = ctx.createLinearGradient(S * 0.28, 0, S * 0.48, 0)
  fade.addColorStop(0, 'rgba(14,17,21,0)')
  fade.addColorStop(1, DARK)
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, S * 0.48, S)

  // top + bottom red bars
  drawGradientBar(ctx, 0, 0, S, 8)
  drawGradientBar(ctx, 0, S - 8, S, 8)

  // BNI chip + chapter name
  drawBniChip(ctx, 48, 48, bni)
  drawChapterName(ctx, true)

  // MEMBER SPOTLIGHT eyebrow (right half)
  const RX = S * 0.50  // right content zone x start
  const RW = S - RX - 56
  // red pill eyebrow
  ctx.font = '800 18px Arial'
  ctx.letterSpacing = '4px'
  ctx.fillStyle = RED
  ctx.fillText('MEMBER SPOTLIGHT', RX, 162)
  ctx.letterSpacing = '0px'
  // thin red line under
  ctx.fillStyle = RED
  ctx.fillRect(RX, 172, 280, 3)

  // Name — split first/last
  const nameParts = (d.title || 'Member').split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')
  ctx.font = '900 92px Arial'
  ctx.fillStyle = WHITE
  ctx.fillText(firstName, RX, 280)
  ctx.fillText(lastName, RX, 378)

  // Role chip
  const role = d.lines?.[0] || ''
  if (role) chip(ctx, role, RX, 404, RED, WHITE, 28, 28, 56)

  // Company
  ctx.font = '500 28px Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.fillText(d.subtitle || '', RX, 498)

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(RX, 524, RW, 2)

  // Caption / story text
  const captionText = d.caption
    || `A trusted member of Think Big St. Louis — helping our community grow through real referrals every week.`
  ctx.font = '400 italic 30px Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.80)'
  const captionLines = wrapText(ctx, captionText, RX, 572, RW, 46, 4)

  // CTA
  const ctaY = 572 + captionLines * 46 + 20
  ctx.font = '700 28px Arial'
  ctx.fillStyle = RED
  const ctaText = d.footerCta || 'Connect with this member →'
  ctx.fillText(ctaText, RX, ctaY)

  // Meeting footer bottom-right
  ctx.textAlign = 'right'
  ctx.font = '500 22px Arial'
  ctx.fillStyle = MUTED
  ctx.fillText(MEETING, S - 56, S - 28)
  ctx.textAlign = 'left'
}

function drawSpeaker(
  ctx: CanvasRenderingContext2D,
  d: GraphicData,
  photo: HTMLImageElement | null,
  bni: HTMLImageElement | null
) {
  // Dark bg
  ctx.fillStyle = DARK
  ctx.fillRect(0, 0, S, S)

  // Photo fills top 55%
  const photoH = S * 0.55
  if (photo) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, S, photoH)
    ctx.clip()
    // cover fit
    const pw = S
    const ph = pw * (photo.naturalHeight / photo.naturalWidth)
    const oy = ph > photoH ? -(ph - photoH) / 2 : 0
    ctx.drawImage(photo, 0, oy, pw, ph)
    ctx.restore()
  } else {
    drawCirclePhoto(ctx, null, S / 2, photoH / 2, 200, d.initials || 'TB')
  }

  // gradient fade: photo → dark
  const fade = ctx.createLinearGradient(0, photoH * 0.55, 0, photoH)
  fade.addColorStop(0, 'rgba(14,17,21,0)')
  fade.addColorStop(1, DARK)
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, S, photoH)

  // top + bottom bars
  drawGradientBar(ctx, 0, 0, S, 8)
  drawGradientBar(ctx, 0, S - 8, S, 8)

  // BNI chip + chapter
  drawBniChip(ctx, 48, 48, bni)
  drawChapterName(ctx, true)

  // SPEAKER eyebrow centered
  const eyeY = photoH + 52
  ctx.font = '800 20px Arial'
  ctx.fillStyle = RED
  ctx.textAlign = 'center'
  ctx.fillText('SPEAKER OF THE WEEK', S / 2, eyeY)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(56, eyeY + 12, S - 112, 2)
  ctx.textAlign = 'left'

  // Name — centered
  const nameParts = (d.title || 'Speaker').split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')
  ctx.textAlign = 'center'
  ctx.font = '900 94px Arial'
  ctx.fillStyle = WHITE
  ctx.fillText(firstName, S / 2, eyeY + 112)
  ctx.fillText(lastName, S / 2, eyeY + 208)

  // Company chip centered
  if (d.subtitle) {
    const cw = chip(ctx, d.subtitle, 0, eyeY + 232, RED, WHITE, 30, 36, 60)
    // re-draw centered
    ctx.clearRect(0, eyeY + 232, S, 60)
    roundRect(ctx, (S - cw) / 2, eyeY + 232, cw, 60, 30)
    ctx.fillStyle = RED
    ctx.fill()
    ctx.font = '700 30px Arial'
    ctx.fillStyle = WHITE
    ctx.fillText(d.subtitle, (S - cw) / 2 + 36, eyeY + 272)
  }

  // Caption
  const captionText = d.caption || 'Come hear this week\'s featured speaker share their story and expertise with the chapter.'
  ctx.textAlign = 'center'
  ctx.font = '400 italic 28px Arial'
  ctx.fillStyle = OFFWHITE
  const lines = wrapText(ctx, captionText, 0, eyeY + 320, S - 112, 44, 2)
  // re-draw centered since wrapText uses x=0
  const captionY = eyeY + 320
  const captionW = S - 112
  ctx.clearRect(0, captionY - 40, S, lines * 44 + 50)
  ctx.font = '400 italic 28px Arial'
  ctx.fillStyle = OFFWHITE
  wrapText(ctx, captionText, (S - captionW) / 2, captionY, captionW, 44, 2)
  ctx.textAlign = 'left'

  // footer
  ctx.textAlign = 'center'
  ctx.font = '500 22px Arial'
  ctx.fillStyle = MUTED
  ctx.fillText(MEETING, S / 2, S - 28)
  ctx.textAlign = 'left'
}

function drawRedCard(
  ctx: CanvasRenderingContext2D,
  d: GraphicData,
  bni: HTMLImageElement | null
) {
  // Dark bg
  const bg = ctx.createLinearGradient(0, 0, S * 0.7, S)
  bg.addColorStop(0, '#1a1d23')
  bg.addColorStop(1, DARK)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, S, S)

  // faint BNI watermark
  ctx.save()
  ctx.globalAlpha = 0.04
  ctx.font = '900 560px Arial'
  ctx.fillStyle = WHITE
  ctx.textAlign = 'right'
  ctx.fillText('BNI', S + 60, S - 10)
  ctx.textAlign = 'left'
  ctx.globalAlpha = 1
  ctx.restore()

  drawGradientBar(ctx, 0, 0, S, 8)
  drawGradientBar(ctx, 0, S - 8, S, 8)
  drawBniChip(ctx, 56, 56, bni)
  drawChapterName(ctx, true)

  // White content card
  const CX = 68, CY = 230, CW = S - 136, CH = 666
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 40
  roundRect(ctx, CX, CY, CW, CH, 24)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.shadowBlur = 0

  // Red left accent stripe on card
  roundRect(ctx, CX, CY, 12, CH, 6)
  const g = ctx.createLinearGradient(0, CY, 0, CY + CH)
  g.addColorStop(0, RED)
  g.addColorStop(1, RED2)
  ctx.fillStyle = g
  ctx.fill()

  const IX = CX + 52  // inner x
  const IW = CW - 104 // inner width

  // Eyebrow label
  const eyebrow = d.kind === 'open_seats' ? 'NOW RECRUITING'
    : d.kind === 'visitor_invite' ? "YOU'RE INVITED"
    : d.kind === 'win' ? 'CHAPTER WIN'
    : 'THIS THURSDAY'
  ctx.font = '800 19px Arial'
  ctx.fillStyle = RED
  ctx.fillText(eyebrow, IX, CY + 60)
  ctx.fillStyle = '#e0e4ea'
  ctx.fillRect(IX, CY + 70, IW, 2)

  // Title
  const titleFontSize = d.title.length > 16 ? 72 : 88
  ctx.font = `900 ${titleFontSize}px Arial`
  ctx.fillStyle = '#111318'
  const titleLines = wrapText(ctx, d.title, IX, CY + 160, IW, titleFontSize * 1.1, 2)

  // Subtitle
  let contentY = CY + 160 + titleLines * (titleFontSize * 1.1) + 12
  if (d.subtitle) {
    ctx.font = '400 32px Arial'
    ctx.fillStyle = '#5b6270'
    wrapText(ctx, d.subtitle, IX, contentY, IW, 44, 2)
    contentY += 52
  }

  // List items (open seats)
  const items = (d.lines || []).slice(0, 6)
  if (items.length > 0) {
    contentY += 16
    const half = Math.ceil(items.length / 2)
    const colW = IW / 2 - 20
    items.forEach((item, i) => {
      const col = i < half ? 0 : 1
      const row = i < half ? i : i - half
      const ix = IX + col * (IW / 2 + 10)
      const iy = contentY + row * 62
      // dot
      ctx.beginPath()
      ctx.arc(ix + 8, iy - 10, 8, 0, Math.PI * 2)
      ctx.fillStyle = RED
      ctx.fill()
      // text — truncate if too long
      ctx.font = '700 32px Arial'
      ctx.fillStyle = '#111318'
      const truncated = ctx.measureText(item).width > colW - 30
        ? item.substring(0, Math.floor(item.length * (colW - 30) / ctx.measureText(item).width)) + '…'
        : item
      ctx.fillText(truncated, ix + 26, iy)
    })
    contentY += Math.ceil(items.length / 2) * 62 + 16
  }

  // Caption / story text
  const captionText = d.caption
    || (d.kind === 'visitor_invite'
      ? 'Come be our guest — meet trusted local business owners and see how referral networking actually works.'
      : d.kind === 'win'
      ? 'Members helping members win real business. This is what shows up every Thursday.'
      : 'Join St. Louis\'s most connected business community. Guests always welcome.')
  ctx.font = '400 30px Arial'
  ctx.fillStyle = '#374151'
  const capLines = wrapText(ctx, captionText, IX, contentY + 24, IW, 44, 3)

  // CTA
  const ctaY = contentY + 24 + capLines * 44 + 24
  ctx.fillStyle = '#e0e4ea'
  ctx.fillRect(IX, ctaY - 12, IW, 2)
  ctx.font = '800 30px Arial'
  ctx.fillStyle = RED
  const cta = d.footerCta || (d.kind === 'open_seats' ? 'Claim your exclusive seat →' : 'Reserve your guest spot →')
  ctx.fillText(cta, IX, ctaY + 36)

  // Footer
  ctx.textAlign = 'center'
  ctx.font = '500 22px Arial'
  ctx.fillStyle = MUTED
  ctx.fillText(MEETING, S / 2, S - 28)
  ctx.textAlign = 'left'
}

// ─── Main component ──────────────────────────────────────────────────────────

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export default function SocialGraphic({ data }: { data: GraphicData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function render() {
      setRendering(true)
      setError('')
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Load images in parallel
        const [photo, bni] = await Promise.all([
          loadImage(data.memberPhoto || data.memberLogo || ''),
          loadImage('/BNI-Logo.png'),
        ])
        if (cancelled) return

        ctx.clearRect(0, 0, S, S)

        if (data.kind === 'spotlight') drawSpotlight(ctx, data, photo, bni)
        else if (data.kind === 'speaker') drawSpeaker(ctx, data, photo, bni)
        else drawRedCard(ctx, data, bni)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    render()
    return () => { cancelled = true }
  }, [data])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `bni-${data.kind}-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden border border-gray-700 shadow-xl bg-gray-900">
        <canvas
          ref={canvasRef}
          width={S}
          height={S}
          className="w-full h-full"
        />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 p-4">
            <p className="text-red-400 text-xs text-center">{error}</p>
          </div>
        )}
      </div>
      <button
        onClick={download}
        disabled={rendering}
        className="flex items-center gap-1.5 border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-40"
      >
        Download PNG · 1080 × 1080
      </button>
    </div>
  )
}
