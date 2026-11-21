'use client'

import { useEffect, useRef, useState } from 'react'
import type { SocialFlyerTemplate, SocialPhotoLayer } from '@/lib/models/SocialPost'

/**
 * Think Big St. Louis social graphics (HTML canvas, no external renderer).
 *
 * Every graphic shares one frame:
 *   header  : BNI chip (left) + chapter name (right)
 *   footer  : meeting line (left) + "Marketing by Webtek" logo (right)
 *
 * Templates: spotlight, speaker, open_seats, photo, and a statement card used
 * by meeting_promo / meeting_day / visitor_invite / win / recap / evergreen /
 * custom. Formats: square 1080×1080, portrait 1080×1350.
 */

export type GraphicKind =
  | 'open_seats' | 'speaker' | 'spotlight' | 'meeting_promo' | 'visitor_invite' | 'win'
  | 'meeting_day' | 'recap' | 'evergreen' | 'photo' | 'welcome' | 'seat_open' | 'custom'
  | 'community_spotlight'

export type GraphicFormat = 'square' | 'portrait' | 'landscape'

/** Photo template styles: full-bleed overlay, framed photo with text below, or photo over a red banner. */
export type PhotoWrapper = 'overlay' | 'frame' | 'banner'
export const PHOTO_WRAPPERS: { id: PhotoWrapper; label: string }[] = [
  { id: 'overlay', label: 'Full photo' },
  { id: 'frame', label: 'Framed' },
  { id: 'banner', label: 'Red banner' },
]

export const FORMAT_SIZE: Record<GraphicFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1536, h: 1024 },
}

export interface GraphicData {
  kind: GraphicKind
  title: string            // member name (spotlight/speaker) or headline
  subtitle?: string        // company name or supporting line
  lines?: string[]         // role (index 0) for spotlight, seat list for open_seats
  caption?: string         // short line printed on the image
  footerCta?: string       // override the default call to action
  dateLabel?: string       // e.g. "THURSDAY · OCT 29" (speaker)
  wrapper?: PhotoWrapper   // photo template style
  memberPhoto?: string     // data URI or URL
  photos?: string[]        // supporting photos for member and visitor spotlights
  collageLayout?: 'grid' | 'featured' | 'freeform' | 'mosaic' | 'strip' | 'stack'
  flyerTemplate?: SocialFlyerTemplate
  photoIds?: string[]
  photoLayers?: SocialPhotoLayer[]
  memberLogo?: string      // fallback image
  initials?: string
}

// ─── Brand ───────────────────────────────────────────────────────────────────

const RED = '#D81F2E'
const RED2 = '#ee3344'
const INDIGO = '#4338ca'          // Webtek indigo (matches the "Web" in the logo)
const BG1 = '#12151c'
const BG2 = '#0a0c10'
const WHITE = '#ffffff'
const SOFT = 'rgba(255,255,255,0.82)'
const MUTED = 'rgba(255,255,255,0.5)'
const FONT = 'Inter, Arial, Helvetica, sans-serif'

const f = (weight: number | string, px: number, italic = false) =>
  `${italic ? 'italic ' : ''}${weight} ${px}px ${FONT}`

const HEADER_H = 190
const FOOTER_H = 112
const PAD = 64

const EYEBROW: Record<GraphicKind, string> = {
  open_seats: 'NOW RECRUITING',
  speaker: 'SPEAKER OF THE WEEK',
  spotlight: 'MEMBER SPOTLIGHT',
  meeting_promo: 'THIS THURSDAY',
  meeting_day: 'TODAY · 11:30 AM',
  visitor_invite: "YOU'RE INVITED",
  win: 'CHAPTER WIN',
  recap: 'THIS WEEK AT THINK BIG',
  evergreen: 'WHY REFERRALS WORK',
  photo: 'THINK BIG ST. LOUIS',
  welcome: 'NEW MEMBER',
  seat_open: 'SEAT OPEN',
  community_spotlight: 'MEMBER & VISITOR SPOTLIGHT',
  custom: 'THINK BIG ST. LOUIS',
}

const DEFAULT_CTA: Record<GraphicKind, string> = {
  open_seats: 'Claim your exclusive seat →',
  speaker: 'Come hear them live →',
  spotlight: 'Connect with this member →',
  meeting_promo: 'Come see it in person →',
  meeting_day: 'Walk in. We saved you a seat →',
  visitor_invite: 'Reserve your guest spot →',
  win: 'See what showing up does →',
  recap: 'Join us next Thursday →',
  evergreen: 'Visit us this Thursday →',
  photo: 'Visit us this Thursday →',
  welcome: 'Reach out and welcome them →',
  seat_open: 'Visit free this Thursday →',
  community_spotlight: 'Connect with Think Big →',
  custom: 'Visit Think Big →',
}

const WATERMARK: Partial<Record<GraphicKind, string>> = {
  meeting_promo: 'THURSDAY', meeting_day: 'TODAY', visitor_invite: 'GUEST',
  win: 'WIN', recap: 'THANKS', evergreen: 'REFER', custom: 'BNI',
}

// ─── Canvas helpers ──────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function setSpacing(ctx: Ctx, px: number) {
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px` } catch { /* older browsers */ }
}

function wrapLines(ctx: Ctx, text: string, maxW: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w } else { line = test }
  }
  if (line) lines.push(line)
  return lines
}

/** Draw wrapped text; returns the y after the last line. Truncates with an ellipsis past maxLines. */
function drawWrapped(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): number {
  let lines = wrapLines(ctx, text, maxW)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    let last = lines[maxLines - 1]
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return y + lines.length * lineH
}

/** Largest font size (px) at which `text` wraps into <= maxLines lines. */
function fitWrapped(ctx: Ctx, text: string, weight: number, maxW: number, maxLines: number, maxPx: number, minPx: number): number {
  for (let px = maxPx; px >= minPx; px -= 4) {
    ctx.font = f(weight, px)
    if (wrapLines(ctx, text, maxW).length <= maxLines) return px
  }
  return minPx
}

/** Largest single-line font size that fits maxW. */
function fitLine(ctx: Ctx, text: string, weight: number, maxW: number, maxPx: number, minPx: number): number {
  for (let px = maxPx; px >= minPx; px -= 2) {
    ctx.font = f(weight, px)
    if (ctx.measureText(text).width <= maxW) return px
  }
  return minPx
}

function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r = 0, focusY = 0.2) {
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.clip()
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focusY, dw, dh)
  ctx.restore()
}

function drawCollage(
  ctx: Ctx, photos: HTMLImageElement[], x: number, y: number, w: number, h: number,
  layout: 'grid' | 'featured' | 'freeform' | 'mosaic' | 'strip' | 'stack' = 'grid', radius = 16,
  photoIds?: string[], photoLayers?: SocialPhotoLayer[]
) {
  const images = photos.slice(0, 4)
  if (!images.length) return
  if (photoIds && photoLayers?.length) {
    const imagesById = new Map<string, HTMLImageElement>()
    photoIds.slice(0, 4).forEach((id, index) => {
      const image = images[index]
      if (image) imagesById.set(id, image)
    })
    const layers = photoLayers
      .filter((layer) => imagesById.has(layer.photo_id))
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
    if (layers.length) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      layers.forEach((layer) => {
        const image = imagesById.get(layer.photo_id)
        if (!image) return
        const tileW = layer.width * w
        const tileH = layer.height * h
        const centerX = x + (layer.x + layer.width / 2) * w
        const centerY = y + (layer.y + layer.height / 2) * h
        const border = Math.max(5, Math.min(tileW, tileH) * 0.035)
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(layer.rotation * Math.PI / 180)
        ctx.shadowColor = 'rgba(0,0,0,0.42)'
        ctx.shadowBlur = Math.max(10, Math.min(tileW, tileH) * 0.08)
        ctx.shadowOffsetY = Math.max(4, Math.min(tileW, tileH) * 0.025)
        rr(ctx, -tileW / 2, -tileH / 2, tileW, tileH, 12)
        ctx.fillStyle = WHITE
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
        ctx.save()
        rr(ctx, -tileW / 2 + border, -tileH / 2 + border, tileW - border * 2, tileH - border * 2, 6)
        ctx.clip()
        const scale = Math.max((tileW - border * 2) / image.naturalWidth, (tileH - border * 2) / image.naturalHeight) * layer.zoom
        const drawW = image.naturalWidth * scale
        const drawH = image.naturalHeight * scale
        ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH)
        ctx.restore()
        ctx.restore()
      })
      ctx.restore()
      return
    }
  }
  const gap = 12
  if (layout === 'featured' && images.length > 1) {
    const mainW = (w - gap) * 0.62
    const stackX = x + mainW + gap
    const stackW = w - mainW - gap
    const stackPhotos = images.slice(1)
    const tileH = (h - gap * (stackPhotos.length - 1)) / stackPhotos.length
    cover(ctx, images[0], x, y, mainW, h, radius, 0.3)
    stackPhotos.forEach((photo, i) => cover(ctx, photo, stackX, y + i * (tileH + gap), stackW, tileH, radius, 0.3))
    return
  }
  const cols = images.length === 1 ? 1 : 2
  const rows = Math.ceil(images.length / cols)
  const tileW = (w - gap * (cols - 1)) / cols
  const tileH = (h - gap * (rows - 1)) / rows
  images.forEach((photo, i) => {
    const px = x + (i % cols) * (tileW + gap)
    const row = Math.floor(i / cols)
    cover(ctx, photo, px, y + row * (tileH + gap), tileW, tileH, radius, 0.3)
  })
}

interface PillOpts { bg: string; fg: string; size?: number; padX?: number; h?: number; align?: 'left' | 'center' | 'right'; border?: string; spacing?: number }

function pill(ctx: Ctx, text: string, x: number, y: number, o: PillOpts): number {
  const size = o.size ?? 22
  const padX = o.padX ?? 26
  const h = o.h ?? 52
  ctx.font = f(800, size)
  setSpacing(ctx, o.spacing ?? 2)
  const tw = ctx.measureText(text).width
  const w = tw + padX * 2
  const left = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x
  rr(ctx, left, y, w, h, h / 2)
  ctx.fillStyle = o.bg
  ctx.fill()
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 2; ctx.stroke() }
  ctx.fillStyle = o.fg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + padX, y + h / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  setSpacing(ctx, 0)
  return w
}

// ─── Frame: background, header, footer ───────────────────────────────────────

function drawBackground(ctx: Ctx, W: number, H: number, onRed: boolean) {
  if (onRed) {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#e8303f')
    g.addColorStop(1, '#a30f1c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // soft light + large rings
    const glow = ctx.createRadialGradient(W * 0.15, 0, 0, W * 0.15, 0, 760)
    glow.addColorStop(0, 'rgba(255,255,255,0.22)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 3
    for (const r of [420, 560, 700]) { ctx.beginPath(); ctx.arc(W * 0.95, H * 0.55, r, 0, Math.PI * 2); ctx.stroke() }
    return
  }
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, BG1)
  g.addColorStop(1, BG2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // red glow top-right, Webtek-indigo glow bottom-left
  const r1 = ctx.createRadialGradient(W * 0.92, 0, 0, W * 0.92, 0, 760)
  r1.addColorStop(0, 'rgba(216,31,46,0.34)')
  r1.addColorStop(1, 'rgba(216,31,46,0)')
  ctx.fillStyle = r1
  ctx.fillRect(0, 0, W, H)
  const r2 = ctx.createRadialGradient(0, H, 0, 0, H, 640)
  r2.addColorStop(0, 'rgba(67,56,202,0.22)')
  r2.addColorStop(1, 'rgba(67,56,202,0)')
  ctx.fillStyle = r2
  ctx.fillRect(0, 0, W, H)
  // dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (let y = 30; y < H; y += 38) for (let x = 30; x < W; x += 38) ctx.fillRect(x, y, 3, 3)
}

function drawHeader(ctx: Ctx, W: number, bni: HTMLImageElement | null) {
  // white BNI chip
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 18
  rr(ctx, PAD - 8, 44, 206, 92, 16)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.restore()
  if (bni) {
    const ih = 56
    const iw = ih * (bni.naturalWidth / bni.naturalHeight)
    ctx.drawImage(bni, PAD - 8 + (206 - iw) / 2, 44 + (92 - ih) / 2, iw, ih)
  } else {
    ctx.font = f(900, 56)
    ctx.fillStyle = RED
    ctx.textAlign = 'center'
    ctx.fillText('BNI', PAD - 8 + 103, 112)
    ctx.textAlign = 'left'
  }
  // chapter name
  ctx.textAlign = 'right'
  setSpacing(ctx, 1)
  ctx.font = f(800, 28)
  ctx.fillStyle = WHITE
  ctx.fillText('THINK BIG ST. LOUIS', W - PAD, 88)
  ctx.font = f(500, 19)
  ctx.fillStyle = MUTED
  ctx.fillText('BNI CHAPTER · KIRKWOOD, MO', W - PAD, 118)
  setSpacing(ctx, 0)
  ctx.textAlign = 'left'
}

function drawFooter(ctx: Ctx, W: number, H: number, webtek: HTMLImageElement | null) {
  const y = H - FOOTER_H
  ctx.fillStyle = 'rgba(5,7,10,0.94)'
  ctx.fillRect(0, y, W, FOOTER_H)
  // red → indigo accent line (the indigo is the Webtek nod)
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, RED)
  g.addColorStop(0.6, RED2)
  g.addColorStop(1, INDIGO)
  ctx.fillStyle = g
  ctx.fillRect(0, y, W, 5)

  // meeting line
  setSpacing(ctx, 1)
  ctx.font = f(800, 27)
  ctx.fillStyle = WHITE
  ctx.fillText('THURSDAYS · 11:30 AM', PAD, y + 50)
  ctx.font = f(500, 18)
  ctx.fillStyle = MUTED
  ctx.fillText("MIKE DUFFY'S PUB & GRILL · KIRKWOOD, MO · GUESTS WELCOME", PAD, y + 82)
  setSpacing(ctx, 0)

  // Marketing by Webtek
  ctx.textAlign = 'right'
  setSpacing(ctx, 2)
  ctx.font = f(700, 13)
  ctx.fillStyle = MUTED
  ctx.fillText('MARKETING BY', W - PAD, y + 36)
  setSpacing(ctx, 0)
  if (webtek) {
    const lh = 38
    const lw = lh * (webtek.naturalWidth / webtek.naturalHeight)
    ctx.drawImage(webtek, W - PAD - lw, y + 48, lw, lh)
  } else {
    ctx.font = f(900, 30)
    ctx.fillStyle = WHITE
    ctx.fillText('WEBTEK.AI', W - PAD, y + 80)
  }
  ctx.textAlign = 'left'
}

function initialsCircle(ctx: Ctx, cx: number, cy: number, r: number, initials: string) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  g.addColorStop(0, RED)
  g.addColorStop(1, '#8e0f1c')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = WHITE
  ctx.font = f(900, Math.floor(r * 0.78))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials || 'TB', cx, cy + 4)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
}

// ─── Templates ───────────────────────────────────────────────────────────────

function drawSpotlight(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement | null, photos: HTMLImageElement[]) {
  const top = HEADER_H
  const bottom = H - FOOTER_H - 28
  const ph = bottom - top
  const px = PAD
  const pw = 436
  // offset frame
  rr(ctx, px + 16, top + 16, pw, ph, 30)
  ctx.strokeStyle = RED
  ctx.lineWidth = 6
  ctx.stroke()
  if (photos.length) {
    drawCollage(ctx, photos, px, top, pw, ph, d.collageLayout, 16, d.photoIds, d.photoLayers)
  } else if (photo) {
    cover(ctx, photo, px, top, pw, ph, 30)
  } else {
    rr(ctx, px, top, pw, ph, 30)
    ctx.fillStyle = '#1b1f28'
    ctx.fill()
    initialsCircle(ctx, px + pw / 2, top + ph / 2, 150, d.initials || 'TB')
  }

  const rx = px + pw + 56
  const rw = W - rx - PAD
  let y = top + 8
  pill(ctx, 'MEMBER SPOTLIGHT', rx, y, { bg: RED, fg: WHITE, size: 20, h: 46, padX: 22 })
  y += 46 + 62

  const parts = (d.title || 'Member').trim().split(/\s+/)
  const first = parts[0]
  const last = parts.slice(1).join(' ')
  const nameSize = Math.min(fitLine(ctx, first, 900, rw, 96, 48), last ? fitLine(ctx, last, 900, rw, 96, 48) : 96)
  ctx.font = f(900, nameSize)
  ctx.fillStyle = WHITE
  ctx.fillText(first, rx, y + nameSize * 0.78)
  y += nameSize * 0.98
  if (last) { ctx.fillText(last, rx, y + nameSize * 0.78); y += nameSize * 0.98 }
  y += 14

  const role = d.lines?.[0]
  if (role) {
    const rs = fitLine(ctx, role, 700, rw - 40, 26, 17)
    ctx.font = f(700, rs)
    const w = Math.min(ctx.measureText(role).width + 40, rw)
    rr(ctx, rx, y, w, 52, 26)
    ctx.strokeStyle = RED
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.fillStyle = WHITE
    ctx.textBaseline = 'middle'
    ctx.fillText(role, rx + 20, y + 27)
    ctx.textBaseline = 'alphabetic'
    y += 52 + 22
  }
  if (d.subtitle) {
    ctx.font = f(600, 28)
    ctx.fillStyle = SOFT
    y = drawWrapped(ctx, d.subtitle, rx, y + 26, rw, 36, 2) + 6
  }

  // divider
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(rx, y + 10, rw, 2)
  y += 46
  const story = d.caption || 'A trusted member of Think Big St. Louis, helping our community grow through real referrals every week.'
  ctx.font = f(400, 30, true)
  ctx.fillStyle = SOFT
  const maxLines = Math.max(3, Math.floor((bottom - y - 70) / 44))
  y = drawWrapped(ctx, story, rx, y, rw, 44, Math.min(maxLines, 7))

  ctx.font = f(800, 26)
  ctx.fillStyle = RED2
  ctx.fillText(d.footerCta || DEFAULT_CTA.spotlight, rx, Math.min(y + 40, bottom - 4))
}

function drawSpeaker(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement | null, photos: HTMLImageElement[]) {
  const ph = Math.round(H * 0.5)
  if (photos.length) {
    drawCollage(ctx, photos, 0, 0, W, ph, d.collageLayout, 0, d.photoIds, d.photoLayers)
  } else if (photo) {
    cover(ctx, photo, 0, 0, W, ph, 0, 0.18)
  } else {
    ctx.fillStyle = '#1b1f28'
    ctx.fillRect(0, 0, W, ph)
    initialsCircle(ctx, W / 2, ph / 2 + 30, 170, d.initials || 'TB')
  }
  // fade into background + top shade for the header
  const fade = ctx.createLinearGradient(0, ph * 0.5, 0, ph)
  fade.addColorStop(0, 'rgba(10,12,16,0)')
  fade.addColorStop(1, BG2)
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, W, ph)
  const shade = ctx.createLinearGradient(0, 0, 0, 200)
  shade.addColorStop(0, 'rgba(0,0,0,0.65)')
  shade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, 200)

  let y = ph + 6
  pill(ctx, d.dateLabel ? `SPEAKER · ${d.dateLabel}` : 'SPEAKER OF THE WEEK', W / 2, y, { bg: RED, fg: WHITE, size: 21, h: 48, padX: 26, align: 'center' })
  y += 48 + 18

  const name = d.title || 'Speaker'
  const ns = fitLine(ctx, name, 900, W - PAD * 2, 104, 56)
  ctx.font = f(900, ns)
  ctx.fillStyle = WHITE
  ctx.textAlign = 'center'
  ctx.fillText(name, W / 2, y + ns * 0.8)
  y += ns * 0.95 + 14

  if (d.subtitle) {
    const cs = fitLine(ctx, d.subtitle, 700, W - PAD * 2 - 60, 30, 20)
    ctx.font = f(700, cs)
    ctx.fillStyle = SOFT
    ctx.fillText(d.subtitle, W / 2, y + cs)
    y += cs + 24
  }
  if (d.lines?.[0]) {
    ctx.font = f(800, 24)
    ctx.fillStyle = RED2
    drawWrapped(ctx, d.lines[0], W / 2, y + 24, W - PAD * 2 - 40, 34, 2)
    y += 68
  }
  const story = d.caption || "Come hear this week's featured speaker share their story and expertise."
  ctx.font = f(400, 28, true)
  ctx.fillStyle = SOFT
  const maxLines = Math.max(2, Math.floor((H - FOOTER_H - 20 - y) / 42))
  drawWrapped(ctx, story, W / 2, y + 22, W - PAD * 2 - 40, 42, Math.min(maxLines, 4))
  ctx.textAlign = 'left'
}

function drawCommunitySpotlight(ctx: Ctx, W: number, H: number, d: GraphicData, photos: HTMLImageElement[]) {
  const top = HEADER_H + 30
  const bottom = H - FOOTER_H - 30
  const photoX = Math.round(W * 0.52)
  const photoW = W - photoX - PAD
  const photoY = top
  const photoH = bottom - top
  const leftX = PAD
  const leftW = photoX - leftX - 36

  pill(ctx, 'MEMBER & VISITOR SPOTLIGHT', leftX, top, { bg: RED, fg: WHITE, size: 17, h: 44, padX: 18 })
  let y = top + 92
  const name = d.title || 'Think Big Member'
  const nameSize = fitWrapped(ctx, name, 900, leftW, 2, 72, 40)
  ctx.font = f(900, nameSize)
  ctx.fillStyle = WHITE
  y = drawWrapped(ctx, name, leftX, y + nameSize * 0.82, leftW, nameSize * 1.02, 2) + 18

  if (d.subtitle) {
    ctx.font = f(700, fitWrapped(ctx, d.subtitle, 700, leftW, 2, 32, 20))
    ctx.fillStyle = SOFT
    y = drawWrapped(ctx, d.subtitle, leftX, y + 18, leftW, 40, 2) + 24
  }

  const topic = d.lines?.[0]
  if (topic) {
    pill(ctx, 'BUSINESS / SPECIALTY', leftX, y, { bg: 'rgba(255,255,255,0.08)', fg: RED2, size: 15, h: 38, padX: 16, border: 'rgba(255,255,255,0.16)' })
    y += 58
    ctx.font = f(800, fitWrapped(ctx, topic, 800, leftW, 2, 32, 20))
    ctx.fillStyle = WHITE
    y = drawWrapped(ctx, topic, leftX, y + 22, leftW, 38, 2) + 20
  }

  const captionLines = Math.max(0, Math.min(3, Math.floor((bottom - y - 46) / 36)))
  if (d.caption && captionLines > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(leftX, y, Math.min(110, leftW), 4)
    ctx.font = f(400, 25)
    ctx.fillStyle = SOFT
    drawWrapped(ctx, d.caption, leftX, y + 42, leftW, 36, captionLines)
  }

  rr(ctx, photoX - 8, photoY - 8, photoW + 16, photoH + 16, 28)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 2
  ctx.stroke()
  if (!photos.length) {
    rr(ctx, photoX, photoY, photoW, photoH, 20)
    ctx.fillStyle = '#1b1f28'
    ctx.fill()
    ctx.fillStyle = MUTED
    ctx.font = f(700, 24)
    ctx.textAlign = 'center'
    drawWrapped(ctx, 'Add photos to feature this person', photoX + photoW / 2, photoY + photoH / 2, photoW - 40, 34, 2)
    ctx.textAlign = 'left'
    return
  }
  drawCollage(ctx, photos, photoX, photoY, photoW, photoH, d.collageLayout, 16, d.photoIds, d.photoLayers)
}

function drawFlyerStory(
  ctx: Ctx, d: GraphicData, x: number, y: number, w: number, bottom: number, align: 'left' | 'center'
) {
  const center = align === 'center'
  const textX = center ? x + w / 2 : x
  const kicker = d.kind === 'speaker'
    ? (d.dateLabel ? `SPEAKER · ${d.dateLabel}` : 'SPEAKER OF THE WEEK')
    : d.kind === 'spotlight' ? 'MEMBER SPOTLIGHT' : 'MEMBER / VISITOR SPOTLIGHT'
  pill(ctx, kicker, textX, y, { bg: RED, fg: WHITE, size: 18, h: 44, padX: 20, align })
  y += 68

  const title = d.title || (d.kind === 'speaker' ? 'Speaker' : 'Think Big Member')
  const titleSize = fitWrapped(ctx, title, 900, w, 2, Math.min(82, Math.floor(w * 0.13)), 38)
  ctx.font = f(900, titleSize)
  ctx.fillStyle = WHITE
  ctx.textAlign = align
  y = drawWrapped(ctx, title, textX, y + titleSize * 0.82, w, titleSize * 1.04, 2) + 10

  if (d.subtitle) {
    const size = fitWrapped(ctx, d.subtitle, 700, w, 2, Math.min(32, Math.floor(w * 0.07)), 19)
    ctx.font = f(700, size)
    ctx.fillStyle = SOFT
    y = drawWrapped(ctx, d.subtitle, textX, y + 8, w, size * 1.25, 2) + 10
  }

  const topic = d.lines?.[0]
  if (topic) {
    ctx.font = f(800, fitWrapped(ctx, topic, 800, w, 2, Math.min(27, Math.floor(w * 0.06)), 17))
    ctx.fillStyle = RED2
    y = drawWrapped(ctx, topic, textX, y + 10, w, 34, 2) + 4
  }

  const captionLines = Math.max(0, Math.min(3, Math.floor((bottom - y - 16) / 32)))
  if (d.caption && captionLines > 0) {
    ctx.font = f(400, 23)
    ctx.fillStyle = SOFT
    drawWrapped(ctx, d.caption, textX, y + 24, w, 32, captionLines)
  }
  ctx.textAlign = 'left'
}

function drawStyledFlyer(
  ctx: Ctx, W: number, H: number, d: GraphicData, photos: HTMLImageElement[],
  photo: HTMLImageElement | null, template: Exclude<SocialFlyerTemplate, 'classic'>
) {
  drawBackground(ctx, W, H, false)
  const top = HEADER_H + 24
  const bottom = H - FOOTER_H - 28

  if (template === 'photo-top') {
    const photoH = Math.min(Math.round(H * 0.31), bottom - top - 370)
    if (photos.length) {
      drawCollage(ctx, photos, PAD, top, W - PAD * 2, photoH, d.collageLayout, 18, d.photoIds, d.photoLayers)
    } else if (photo) {
      cover(ctx, photo, PAD, top, W - PAD * 2, photoH, 18)
    } else {
      rr(ctx, PAD, top, W - PAD * 2, photoH, 18)
      ctx.fillStyle = '#1b1f28'
      ctx.fill()
      initialsCircle(ctx, W / 2, top + photoH / 2, Math.min(photoH * 0.32, 130), d.initials || 'TB')
    }
    const ruleY = top + photoH + 22
    ctx.fillStyle = RED
    ctx.fillRect(PAD, ruleY, W - PAD * 2, 4)
    drawFlyerStory(ctx, d, PAD, ruleY + 22, W - PAD * 2, bottom, 'center')
    return
  }

  const photoX = PAD
  const photoY = top
  const photoW = Math.round((W - PAD * 3) * 0.42)
  const photoH = bottom - top
  const textX = photoX + photoW + PAD
  const textW = W - textX - PAD
  rr(ctx, photoX - 10, photoY - 10, photoW + 20, photoH + 20, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 2
  ctx.stroke()
  if (photos.length) {
    drawCollage(ctx, photos, photoX, photoY, photoW, photoH, d.collageLayout, 16, d.photoIds, d.photoLayers)
  } else if (photo) {
    cover(ctx, photo, photoX, photoY, photoW, photoH, 16)
  } else {
    rr(ctx, photoX, photoY, photoW, photoH, 16)
    ctx.fillStyle = '#1b1f28'
    ctx.fill()
    initialsCircle(ctx, photoX + photoW / 2, photoY + photoH / 2, Math.min(photoW * 0.3, 130), d.initials || 'TB')
  }
  drawFlyerStory(ctx, d, textX, photoY + 22, textW, bottom, 'left')
}

function drawOpenSeats(ctx: Ctx, W: number, H: number, d: GraphicData) {
  const cx = PAD - 8, cy = HEADER_H, cw = W - (PAD - 8) * 2, ch = H - FOOTER_H - 28 - cy
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  rr(ctx, cx, cy, cw, ch, 30)
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.restore()
  // red stripe
  rr(ctx, cx, cy, 14, ch, 7)
  const sg = ctx.createLinearGradient(0, cy, 0, cy + ch)
  sg.addColorStop(0, RED); sg.addColorStop(1, '#8e0f1c')
  ctx.fillStyle = sg
  ctx.fill()

  const ix = cx + 56, iw = cw - 112
  let y = cy + 64
  pill(ctx, EYEBROW.open_seats, ix, y - 36, { bg: RED, fg: WHITE, size: 19, h: 44, padX: 22 })
  y += 44

  const title = d.title || 'Your seat is waiting.'
  const ts = fitWrapped(ctx, title, 900, iw, 2, 92, 52)
  ctx.font = f(900, ts)
  ctx.fillStyle = '#10131a'
  y = drawWrapped(ctx, title, ix, y + ts * 0.85, iw, ts * 1.04, 2) + 6

  ctx.font = f(500, 28)
  ctx.fillStyle = '#5b6270'
  y = drawWrapped(ctx, d.subtitle || 'One business per category. Every seat is exclusive.', ix, y + 28, iw, 38, 2) + 18

  const seats = (d.lines || []).slice(0, H > 1200 ? 8 : 6)
  const colW = (iw - 20) / 2
  const rowH = 74
  seats.forEach((s, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const px = ix + col * (colW + 20)
    const py = y + row * rowH
    rr(ctx, px, py, colW, 60, 30)
    ctx.fillStyle = '#f2f4f8'
    ctx.fill()
    ctx.beginPath(); ctx.arc(px + 30, py + 30, 9, 0, Math.PI * 2); ctx.fillStyle = RED; ctx.fill()
    const fs = fitLine(ctx, s, 700, colW - 76, 28, 17)
    ctx.font = f(700, fs)
    ctx.fillStyle = '#10131a'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, px + 52, py + 31)
    ctx.textBaseline = 'alphabetic'
  })
  y += Math.ceil(seats.length / 2) * rowH + 8

  if (d.caption && y < cy + ch - 190) {
    ctx.font = f(400, 28, true)
    ctx.fillStyle = '#374151'
    y = drawWrapped(ctx, d.caption, ix, y + 20, iw, 40, 2)
  }
  // CTA button pinned to the bottom of the card
  const cta = d.footerCta || DEFAULT_CTA.open_seats
  ctx.font = f(800, 28)
  const bw = Math.min(ctx.measureText(cta).width + 64, iw)
  const by = cy + ch - 56 - 64
  rr(ctx, ix, by, bw, 64, 32)
  const bg = ctx.createLinearGradient(ix, 0, ix + bw, 0)
  bg.addColorStop(0, RED); bg.addColorStop(1, RED2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.fillStyle = WHITE
  ctx.textBaseline = 'middle'
  ctx.fillText(cta, ix + 32, by + 33)
  ctx.textBaseline = 'alphabetic'
}

function drawTiles(ctx: Ctx, x: number, y: number, w: number, tiles: [string, string, string][], onRed: boolean) {
  const gap = 18
  const tw = (w - gap * (tiles.length - 1)) / tiles.length
  tiles.forEach(([label, l1, l2], i) => {
    const tx = x + i * (tw + gap)
    rr(ctx, tx, y, tw, 124, 20)
    ctx.fillStyle = onRed ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'
    ctx.fill()
    ctx.strokeStyle = onRed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.stroke()
    setSpacing(ctx, 2)
    ctx.font = f(800, 15)
    ctx.fillStyle = onRed ? 'rgba(255,255,255,0.8)' : RED2
    ctx.fillText(label, tx + 22, y + 34)
    setSpacing(ctx, 0)
    ctx.fillStyle = WHITE
    const fs = Math.min(fitLine(ctx, l1, 800, tw - 40, 28, 16), fitLine(ctx, l2, 800, tw - 40, 28, 16))
    ctx.font = f(800, fs)
    ctx.fillText(l1, tx + 22, y + 74)
    ctx.font = f(600, Math.max(fs - 4, 15))
    ctx.fillStyle = onRed ? 'rgba(255,255,255,0.85)' : SOFT
    ctx.fillText(l2, tx + 22, y + 74 + fs * 0.95)
  })
}

function drawStatement(ctx: Ctx, W: number, H: number, d: GraphicData) {
  const onRed = d.kind === 'meeting_day' || d.kind === 'visitor_invite'
  const accent = onRed ? WHITE : RED
  const top = HEADER_H + 4
  const bottom = H - FOOTER_H - 34
  const iw = W - PAD * 2

  // giant faint watermark word
  const wm = WATERMARK[d.kind]
  if (wm) {
    ctx.save()
    ctx.font = f(900, 250)
    ctx.textAlign = 'right'
    ctx.fillStyle = onRed ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.045)'
    ctx.fillText(wm, W + 20, H * 0.5 + 110)
    ctx.restore()
  }

  let y = top
  pill(ctx, d.kind === 'custom' ? EYEBROW.custom : EYEBROW[d.kind], PAD, y, {
    bg: onRed ? WHITE : RED, fg: onRed ? RED : WHITE, size: 21, h: 48, padX: 24,
  })
  y += 48 + 28

  const title = d.title || 'See you Thursday.'
  const maxLines = H > 1200 ? 5 : 4
  const ts = fitWrapped(ctx, title, 900, iw, maxLines, 118, 58)
  ctx.font = f(900, ts)
  ctx.fillStyle = WHITE
  y = drawWrapped(ctx, title, PAD, y + ts * 0.88, iw, ts * 1.04, maxLines)
  // accent bar
  rr(ctx, PAD, y + 8, 130, 9, 4.5)
  ctx.fillStyle = accent
  ctx.fill()
  y += 8 + 9 + 34

  const line = d.caption || d.subtitle
  if (line) {
    ctx.font = f(500, 34)
    ctx.fillStyle = onRed ? 'rgba(255,255,255,0.92)' : SOFT
    drawWrapped(ctx, line, PAD, y + 30, iw, 50, 4)
  }

  // info tiles + CTA, anchored to the bottom
  const ctaH = 68
  const ctaY = bottom - ctaH
  const showTiles = d.kind === 'meeting_promo' || d.kind === 'meeting_day' || d.kind === 'visitor_invite'
  if (showTiles) {
    drawTiles(ctx, PAD, ctaY - 24 - 124, iw, [
      ['WHEN', 'THURSDAY', '11:30 AM'],
      ['WHERE', "MIKE DUFFY'S", 'KIRKWOOD, MO'],
      d.kind === 'visitor_invite' ? ['COST', 'FREE TO VISIT', 'NO COMMITMENT'] : ['GUESTS', 'ALWAYS', 'WELCOME'],
    ], onRed)
  }
  const cta = d.footerCta || DEFAULT_CTA[d.kind]
  ctx.font = f(800, 29)
  const bw = Math.min(ctx.measureText(cta).width + 70, iw)
  rr(ctx, PAD, ctaY, bw, ctaH, ctaH / 2)
  if (onRed) { ctx.fillStyle = WHITE; ctx.fill() } else {
    const g = ctx.createLinearGradient(PAD, 0, PAD + bw, 0)
    g.addColorStop(0, RED); g.addColorStop(1, RED2)
    ctx.fillStyle = g; ctx.fill()
  }
  ctx.fillStyle = onRed ? RED : WHITE
  ctx.textBaseline = 'middle'
  ctx.fillText(cta, PAD + 35, ctaY + ctaH / 2 + 1)
  ctx.textBaseline = 'alphabetic'
}

function drawPhotoCard(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement) {
  if (d.wrapper === 'frame') return drawPhotoFrame(ctx, W, H, d, photo)
  if (d.wrapper === 'banner') return drawPhotoBanner(ctx, W, H, d, photo)
  drawPhotoOverlay(ctx, W, H, d, photo)
}

/** Photo inset in a rounded frame on the dark brand background, headline underneath. */
function drawPhotoFrame(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement) {
  drawBackground(ctx, W, H, false)
  const iw = W - PAD * 2
  const title = d.title || 'Thursday at Think Big'
  const ts = fitWrapped(ctx, title, 900, iw, 2, 68, 42)
  ctx.font = f(900, ts)
  const titleLines = Math.min(2, wrapLines(ctx, title, iw).length)
  ctx.font = f(500, 28)
  const capLines = d.caption ? Math.min(2, wrapLines(ctx, d.caption, iw).length) : 0
  const textH = titleLines * ts * 1.05 + (capLines ? capLines * 40 + 16 : 0)
  const top = HEADER_H
  const bottom = H - FOOTER_H - 30
  const photoH = Math.max(300, bottom - top - textH - 34)

  rr(ctx, PAD + 14, top + 14, iw, photoH, 28)
  ctx.strokeStyle = RED
  ctx.lineWidth = 6
  ctx.stroke()
  cover(ctx, photo, PAD, top, iw, photoH, 28, 0.3)

  let y = top + photoH + 34
  ctx.font = f(900, ts)
  ctx.fillStyle = WHITE
  y = drawWrapped(ctx, title, PAD, y + ts * 0.85, iw, ts * 1.05, 2)
  if (d.caption) {
    ctx.font = f(500, 28)
    ctx.fillStyle = SOFT
    drawWrapped(ctx, d.caption, PAD, y + 26, iw, 40, 2)
  }
}

/** Photo across the top, solid brand-red banner below with the headline. */
function drawPhotoBanner(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement) {
  const ph = Math.round(H * 0.58)
  cover(ctx, photo, 0, 0, W, ph, 0, 0.3)
  const shade = ctx.createLinearGradient(0, 0, 0, 220)
  shade.addColorStop(0, 'rgba(0,0,0,0.7)')
  shade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, 220)

  const g = ctx.createLinearGradient(0, ph, W, H)
  g.addColorStop(0, '#e8303f')
  g.addColorStop(1, '#9d1120')
  ctx.fillStyle = g
  ctx.fillRect(0, ph, W, H - ph)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillRect(0, ph, W, 6)

  const iw = W - PAD * 2
  const avail = H - FOOTER_H - 24 - (ph + 34)
  const title = d.title || 'Thursday at Think Big'
  const ts = fitWrapped(ctx, title, 900, iw, 2, 74, 42)
  ctx.font = f(900, ts)
  ctx.fillStyle = WHITE
  let y = drawWrapped(ctx, title, PAD, ph + 34 + ts * 0.85, iw, ts * 1.05, 2)
  if (d.caption && y + 60 < ph + avail + 34) {
    ctx.font = f(500, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    drawWrapped(ctx, d.caption, PAD, y + 24, iw, 40, 2)
  }
}

function drawPhotoOverlay(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement) {
  cover(ctx, photo, 0, 0, W, H, 0, 0.3)
  const bot = ctx.createLinearGradient(0, H * 0.35, 0, H)
  bot.addColorStop(0, 'rgba(8,10,14,0)')
  bot.addColorStop(0.7, 'rgba(8,10,14,0.88)')
  bot.addColorStop(1, 'rgba(5,7,10,0.97)')
  ctx.fillStyle = bot
  ctx.fillRect(0, 0, W, H)
  const topShade = ctx.createLinearGradient(0, 0, 0, 220)
  topShade.addColorStop(0, 'rgba(0,0,0,0.7)')
  topShade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = topShade
  ctx.fillRect(0, 0, W, 220)

  const iw = W - PAD * 2
  const bottom = H - FOOTER_H - 34
  const title = d.title || 'Thursday at Think Big'
  const ts = fitWrapped(ctx, title, 900, iw, 3, 96, 50)
  ctx.font = f(900, ts)
  const lines = wrapLines(ctx, title, iw).slice(0, 3)
  const caption = d.caption || ''
  ctx.font = f(500, 30)
  const capLines = caption ? wrapLines(ctx, caption, iw).slice(0, 2) : []
  const blockH = 48 + 22 + lines.length * ts * 1.04 + (capLines.length ? capLines.length * 42 + 18 : 0)
  let y = bottom - blockH
  pill(ctx, EYEBROW.photo, PAD, y, { bg: RED, fg: WHITE, size: 19, h: 44, padX: 22 })
  y += 44 + 22
  ctx.font = f(900, ts)
  ctx.fillStyle = WHITE
  y = drawWrapped(ctx, title, PAD, y + ts * 0.85, iw, ts * 1.04, 3)
  if (capLines.length) {
    ctx.font = f(500, 30)
    ctx.fillStyle = SOFT
    drawWrapped(ctx, caption, PAD, y + 32, iw, 42, 2)
  }
}


// ─── Chapter poster family (landscape 1536×1024) ────────────────────────────
// Red/charcoal swoosh layout from the chapter's "Welcome Kelley" design.
// Shared frame: swoosh, BNI mark, badge, Webtek credit, footer band.

const W_RED = '#b30f1e'
const W_DARK = '#202327'
const W_FONT = "'Roboto Condensed', Arial, Helvetica, sans-serif"
const W_SCRIPT = "'Kaushan Script', cursive"
const wf = (weight: number, px: number, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px ${W_FONT}`

function posterBase(ctx: Ctx, W: number, H: number) {
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f3f3f3'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = W_RED
  ctx.fill(new Path2D('M1150 0 L1536 0 L1536 1024 L900 1024 C840 700 880 300 1150 0 Z'))
  ctx.fillStyle = W_DARK
  ctx.fill(new Path2D('M1190 0 L1536 0 L1536 1024 L960 1024 C890 700 940 300 1190 0 Z'))
  setSpacing(ctx, -4)
  ctx.fillStyle = W_RED
  ctx.font = wf(900, 112, true)
  ctx.fillText('BNI', 40, 122)
  setSpacing(ctx, 1)
  ctx.fillStyle = '#444'
  ctx.font = wf(700, 42)
  ctx.fillText('THINK BIG', 40, 164)
  ctx.fillText('ST. LOUIS', 40, 210)
  setSpacing(ctx, 0)
}

/** Big black word under the chapter name, e.g. WELCOME / SEAT OPEN. */
function posterTitle(ctx: Ctx, text: string) {
  ctx.fillStyle = '#111'
  ctx.font = wf(900, fitLine(ctx, text, 900, 770, 158, 90))
  ctx.fillText(text, 40, 344)
}

/** Centered label with rules on both sides, e.g. "OUR NEW MEMBER". */
function posterRuleLabel(ctx: Ctx, label: string) {
  setSpacing(ctx, 2)
  ctx.font = wf(700, 46)
  ctx.fillStyle = '#444'
  const lw = ctx.measureText(label).width
  const cx = 420
  ctx.textAlign = 'center'
  ctx.fillText(label, cx, 418)
  ctx.textAlign = 'left'
  ctx.fillRect(40, 400, Math.max(0, cx - lw / 2 - 60), 3)
  ctx.fillRect(cx + lw / 2 + 20, 400, Math.max(0, 800 - (cx + lw / 2 + 20)), 3)
  setSpacing(ctx, 0)
}

/** Big red line (name or seat) that shrinks to stay clear of the swoosh. */
function posterRedLine(ctx: Ctx, text: string) {
  ctx.fillStyle = W_RED
  let px = 122
  for (; px > 56; px -= 2) { ctx.font = wf(900, px); if (ctx.measureText(text).width <= 800) break }
  ctx.fillText(text, 40, 430 + px * 0.84 + (122 - px) * 0.1)
}

function posterScript(ctx: Ctx, text: string) {
  if (!text) return
  ctx.fillStyle = '#333'
  let px = 76
  for (; px > 36; px -= 2) { ctx.font = `${px}px ${W_SCRIPT}`; if (ctx.measureText(text).width <= 780) break }
  ctx.fillText(text, 44, 622)
}

function posterBadge(ctx: Ctx, l1: string, l2: string, icon: 'house' | 'join') {
  ctx.beginPath(); ctx.arc(960, 180, 140, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill()
  ctx.beginPath(); ctx.arc(960, 180, 132, 0, Math.PI * 2); ctx.fillStyle = W_RED; ctx.fill()
  ctx.save()
  ctx.translate(918, 98)
  ctx.strokeStyle = WHITE; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  if (icon === 'house') {
    ctx.stroke(new Path2D('M8 38 L42 8 L76 38 M16 32 V68 H68 V32'))
    ctx.fillStyle = WHITE; ctx.fillRect(34, 42, 16, 26)
  } else {
    // person + plus: "join us"
    ctx.fillStyle = WHITE
    ctx.beginPath(); ctx.arc(34, 22, 13, 0, Math.PI * 2); ctx.fill()
    ctx.fill(new Path2D('M8 68 C8 44 60 44 60 68 Z'))
    ctx.stroke(new Path2D('M70 22 V46 M58 34 H82'))
  }
  ctx.restore()
  ctx.fillStyle = WHITE; ctx.textAlign = 'center'
  ctx.font = wf(900, fitLine(ctx, l1, 900, 236, 36, 24))
  ctx.fillText(l1, 960, 216)
  ctx.font = wf(900, fitLine(ctx, l2, 900, 236, 36, 24))
  ctx.fillText(l2, 960, 256)
  ctx.textAlign = 'left'
}

/** White box with two columns and a black pill (bottom left). */
function posterBox(ctx: Ctx, draw: () => void, pill: string) {
  rr(ctx, 41.5, 691.5, 767, 223, 18)
  ctx.fillStyle = WHITE; ctx.fill()
  ctx.lineWidth = 3; ctx.strokeStyle = '#222'; ctx.stroke()
  ctx.save()
  rr(ctx, 41.5, 691.5, 767, 223, 18); ctx.clip()
  draw()
  ctx.fillStyle = '#222'; ctx.fillRect(423, 712, 3, 133)
  rr(ctx, 67, 859, 716, 44, 12); ctx.fillStyle = '#111'; ctx.fill()
  ctx.fillStyle = WHITE; ctx.textAlign = 'center'
  ctx.font = wf(700, fitLine(ctx, pill, 700, 680, 32, 20))
  ctx.fillText(pill, 425, 892)
  ctx.textAlign = 'left'
  ctx.restore()
}

function posterColLabel(ctx: Ctx, text: string, x: number, y: number) {
  setSpacing(ctx, 1)
  ctx.fillStyle = W_RED; ctx.font = wf(900, 26)
  ctx.fillText(text, x, y)
  setSpacing(ctx, 0)
}

/** Name + company under the circle, then "Marketing by Webtek" (always). */
function posterCaptionAndCredit(ctx: Ctx, line1: string, line2: string, webtek: HTMLImageElement | null) {
  const pcx = 1250
  ctx.textAlign = 'center'
  ctx.fillStyle = WHITE
  ctx.font = wf(900, fitLine(ctx, line1, 900, 500, 44, 24))
  ctx.fillText(line1, pcx, 797)
  if (line2) {
    setSpacing(ctx, 1)
    ctx.fillStyle = '#f2b8bc'
    ctx.font = wf(700, fitLine(ctx, line2, 700, 480, 28, 16))
    ctx.fillText(line2, pcx, 836)
    setSpacing(ctx, 0)
  }
  setSpacing(ctx, 3)
  ctx.font = wf(700, 17); ctx.fillStyle = MUTED
  ctx.fillText('MARKETING BY', pcx, 893)
  setSpacing(ctx, 0)
  if (webtek) {
    const lh = 34
    const lw = (webtek.width / webtek.height) * lh
    ctx.drawImage(webtek, pcx - lw / 2, 902, lw, lh)
  } else {
    ctx.font = wf(900, 30); ctx.fillStyle = WHITE
    ctx.fillText('WebTek.ai', pcx, 928)
  }
  ctx.textAlign = 'left'
}

function posterFooter(ctx: Ctx) {
  ctx.fillStyle = W_RED
  ctx.fill(new Path2D('M0 924 L940 924 L960 1024 L0 1024 Z'))
  ctx.fillStyle = WHITE
  ctx.beginPath(); ctx.arc(98, 962, 11, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(74, 970, 8, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(122, 970, 8, 0, Math.PI * 2); ctx.fill()
  ctx.save(); ctx.translate(62, 946)
  ctx.fill(new Path2D('M14 54 C14 36 58 36 58 54 Z'))
  ctx.restore()
  setSpacing(ctx, 1)
  const tag = 'MORE VISITORS. MORE REFERRALS. MORE BUSINESS.'
  ctx.font = wf(700, fitLine(ctx, tag, 700, 760, 34, 22))
  ctx.fillText(tag, 164, 987)
  setSpacing(ctx, 0)
  ctx.textAlign = 'right'
  ctx.font = wf(700, 20)
  ctx.fillText('Changing the Way', 1512, 974)
  ctx.fillText('the World Does Business®', 1512, 998)
  ctx.textAlign = 'left'
}

function drawWelcome(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement | null, webtek: HTMLImageElement | null) {
  const name = (d.title || 'New Member').trim()
  const first = name.split(/\s+/)[0] || 'our newest member'
  const company = (d.subtitle || '').trim()
  const classification = (d.lines?.[0] || '').trim()
  const role = (d.lines?.[1] || '').trim()
  const nameUp = name.toUpperCase()

  posterBase(ctx, W, H)
  posterTitle(ctx, 'WELCOME')
  posterRuleLabel(ctx, 'OUR NEW MEMBER')
  posterRedLine(ctx, nameUp)
  posterScript(ctx, company)
  posterBox(ctx, () => {
    posterColLabel(ctx, 'CLASSIFICATION', 67, 735)
    ctx.fillStyle = '#111'
    const cl = classification || 'Business Owner'
    ctx.font = wf(900, fitLine(ctx, cl, 900, 340, 36, 24))
    ctx.fillText(cl, 67, 772)
    if (role) {
      ctx.fillStyle = '#333'
      ctx.font = wf(700, fitLine(ctx, role, 700, 340, 28, 18))
      ctx.fillText(role, 67, 806)
    }
    posterColLabel(ctx, 'LEADERSHIP & SUPPORT', 451, 735)
    posterColLabel(ctx, 'TEAM', 451, 765)
    ctx.fillStyle = '#111'; ctx.font = wf(900, 30)
    drawWrapped(ctx, `Reach out and welcome ${first} personally!`, 451, 800, 335, 34, 2)
  }, `Welcome to the chapter, ${first}!`)
  posterBadge(ctx, 'NEW MEMBER', 'ALERT!', 'house')

  const pcx = 1250, pcy = 520
  ctx.beginPath(); ctx.arc(pcx, pcy, 210, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill()
  if (photo) {
    ctx.save()
    ctx.beginPath(); ctx.arc(pcx, pcy, 200, 0, Math.PI * 2); ctx.clip()
    cover(ctx, photo, pcx - 200, pcy - 200, 400, 400, 0, 0.25)
    ctx.restore()
  } else {
    ctx.beginPath(); ctx.arc(pcx, pcy, 200, 0, Math.PI * 2); ctx.fillStyle = '#3a3e44'; ctx.fill()
    initialsCircle(ctx, pcx, pcy, 150, d.initials || name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'TB')
  }
  posterCaptionAndCredit(ctx, nameUp, company.toUpperCase(), webtek)
  posterFooter(ctx)
}

/**
 * Open-seat poster: invites a new member for one of the chapter's business
 * categories. title = category, subtitle = script tagline,
 * lines = 3 "who we're looking for" lines.
 */
function drawSeatOpen(ctx: Ctx, W: number, H: number, d: GraphicData, webtek: HTMLImageElement | null, photos: HTMLImageElement[]) {
  const seat = (d.title || 'Your Business').trim()
  const seatUp = seat.toUpperCase()
  const fit = (d.lines || []).filter(Boolean).slice(0, 3)

  posterBase(ctx, W, H)
  posterTitle(ctx, 'SEAT OPEN')
  posterRuleLabel(ctx, "WE'RE LOOKING FOR A")
  posterRedLine(ctx, seatUp)
  posterScript(ctx, (d.subtitle || 'Your referral partners are waiting.').trim())
  posterBox(ctx, () => {
    posterColLabel(ctx, 'A GREAT FIT', 67, 735)
    ctx.fillStyle = '#111'
    const list = fit.length ? fit : [`An established local ${seat}`, 'Loves helping other owners', 'Ready for Thursdays']
    const lpx = Math.min(...list.map((r) => fitLine(ctx, `• ${r}`, 700, 340, 27, 17)))
    ctx.font = wf(700, lpx)
    list.forEach((r, i) => ctx.fillText(`• ${r}`, 67, 772 + i * 30))
    posterColLabel(ctx, 'WHY JOIN', 451, 735)
    ctx.fillStyle = '#111'
    const why = ['• The only one in your category', '• Referrals every week', '• A room of local owners']
    const wpx = Math.min(...why.map((t) => fitLine(ctx, t, 700, 335, 27, 17)))
    ctx.font = wf(700, wpx)
    why.forEach((t, i) => ctx.fillText(t, 451, 772 + i * 30))
  }, "Visit free · Thursdays 11:30 AM · Mike Duffy's, Kirkwood")
  posterBadge(ctx, 'SEAT', 'AVAILABLE!', 'join')

  // empty seat waiting for its member
  const pcx = 1250, pcy = 520
  ctx.beginPath(); ctx.arc(pcx, pcy, 210, 0, Math.PI * 2); ctx.fillStyle = WHITE; ctx.fill()
  if (photos.length) {
    ctx.save()
    ctx.beginPath(); ctx.arc(pcx, pcy, 200, 0, Math.PI * 2); ctx.clip()
    drawCollage(ctx, photos, pcx - 200, pcy - 200, 400, 400, d.collageLayout, 0, d.photoIds, d.photoLayers)
    ctx.restore()
  } else {
    ctx.beginPath(); ctx.arc(pcx, pcy, 200, 0, Math.PI * 2); ctx.fillStyle = '#2c3036'; ctx.fill()
    ctx.save()
    ctx.setLineDash([18, 14]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath(); ctx.arc(pcx, pcy, 170, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath(); ctx.arc(pcx, pcy - 50, 58, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(pcx, pcy + 95, 110, 70, 0, Math.PI, 0); ctx.fill()
    ctx.fillStyle = WHITE; ctx.textAlign = 'center'
    ctx.font = wf(900, 46)
    ctx.fillText('YOUR SEAT', pcx, pcy + 30)
    ctx.fillText('IS WAITING', pcx, pcy + 78)
    ctx.textAlign = 'left'
  }

  posterCaptionAndCredit(ctx, 'COULD THIS BE YOU?', `KNOW A GREAT ${seatUp}? TAG THEM`, webtek)
  posterFooter(ctx)
}

// ─── Component ───────────────────────────────────────────────────────────────

async function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

let templateFontsLoaded = false
async function ensureFonts() {
  try {
    if (typeof document === 'undefined' || !document.fonts) return
    await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Inter`)))
    if (!templateFontsLoaded) {
      const rc = new FontFace('Roboto Condensed', 'url(/fonts/RobotoCondensed-latin.woff2)', { weight: '100 900' })
      const ks = new FontFace('Kaushan Script', 'url(/fonts/KaushanScript-latin.woff2)')
      const loaded = await Promise.all([rc.load(), ks.load()])
      loaded.forEach((ff) => document.fonts.add(ff))
      templateFontsLoaded = true
    }
  } catch { /* fall back to Arial */ }
}

async function paint(canvas: HTMLCanvasElement, data: GraphicData, format: GraphicFormat) {
  const { w: W, h: H } = FORMAT_SIZE[format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  await ensureFonts()
  const [photo, bni, webtek, loadedCollagePhotos] = await Promise.all([
    loadImage(data.memberPhoto || data.memberLogo),
    loadImage('/BNI-Logo.png'),
    loadImage('/logo.png'),
    Promise.all((data.photos ?? []).slice(0, 4).map(loadImage)),
  ])
  const collageEntries = loadedCollagePhotos
    .map((image, index) => ({ image, id: data.photoIds?.[index] ?? String(index) }))
    .filter((entry): entry is { image: HTMLImageElement; id: string } => entry.image !== null)
  const collagePhotos = collageEntries.map((entry) => entry.image)
  const paintData = { ...data, photoIds: collageEntries.map((entry) => entry.id) }

  ctx.clearRect(0, 0, W, H)
  if (paintData.kind === 'welcome') {
    drawWelcome(ctx, W, H, paintData, photo, webtek)
    return
  }
  if (paintData.kind === 'seat_open') {
    drawSeatOpen(ctx, W, H, paintData, webtek, collagePhotos)
    return
  }
  if (paintData.kind === 'community_spotlight') {
    if (paintData.flyerTemplate && paintData.flyerTemplate !== 'classic') {
      drawStyledFlyer(ctx, W, H, paintData, collagePhotos, photo, paintData.flyerTemplate)
    } else {
      drawBackground(ctx, W, H, false)
      drawCommunitySpotlight(ctx, W, H, paintData, collagePhotos)
    }
    const bar = ctx.createLinearGradient(0, 0, W, 0)
    bar.addColorStop(0, RED); bar.addColorStop(1, RED2)
    ctx.fillStyle = bar
    ctx.fillRect(0, 0, W, 8)
    drawHeader(ctx, W, bni)
    drawFooter(ctx, W, H, webtek)
    return
  }
  const usePhotoCard = paintData.kind === 'photo' && !!photo
  const onRed = paintData.kind === 'meeting_day' || paintData.kind === 'visitor_invite'

  if (usePhotoCard) {
    drawPhotoCard(ctx, W, H, paintData, photo as HTMLImageElement)
  } else {
    drawBackground(ctx, W, H, onRed && !['spotlight', 'speaker', 'open_seats'].includes(paintData.kind))
    if (paintData.kind === 'spotlight') {
      if (paintData.flyerTemplate && paintData.flyerTemplate !== 'classic') {
        drawStyledFlyer(ctx, W, H, paintData, collagePhotos, photo, paintData.flyerTemplate)
      } else {
        drawSpotlight(ctx, W, H, paintData, photo, collagePhotos)
      }
    } else if (paintData.kind === 'speaker') {
      if (paintData.flyerTemplate && paintData.flyerTemplate !== 'classic') {
        drawStyledFlyer(ctx, W, H, paintData, collagePhotos, photo, paintData.flyerTemplate)
      } else {
        drawSpeaker(ctx, W, H, paintData, photo, collagePhotos)
      }
    }
    else if (paintData.kind === 'open_seats') drawOpenSeats(ctx, W, H, paintData)
    else drawStatement(ctx, W, H, paintData)
  }
  // top accent bar, then the shared frame on top of everything
  const bar = ctx.createLinearGradient(0, 0, W, 0)
  bar.addColorStop(0, RED); bar.addColorStop(1, RED2)
  ctx.fillStyle = bar
  ctx.fillRect(0, 0, W, 8)
  drawHeader(ctx, W, bni)
  drawFooter(ctx, W, H, webtek)
}

export default function SocialGraphic({
  data, format = 'square', compact = false, fileName, onRendered,
}: {
  data: GraphicData
  format?: GraphicFormat
  compact?: boolean
  fileName?: string
  /** Called with the finished canvas after every paint (used for share / download). */
  onRendered?: (canvas: HTMLCanvasElement) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderedCb = useRef(onRendered)
  renderedCb.current = onRendered
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  // Poster templates only exist in landscape.
  if (data.kind === 'welcome' || data.kind === 'seat_open') format = 'landscape'
  const { w, h } = FORMAT_SIZE[format]
  const dataKey = JSON.stringify(data)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setRendering(true)
      setError('')
      try {
        if (canvasRef.current) {
          await paint(canvasRef.current, JSON.parse(dataKey) as GraphicData, format)
          if (!cancelled && renderedCb.current) renderedCb.current(canvasRef.current)
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => { cancelled = true }
  }, [dataKey, format])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${fileName || `think-big-${data.kind}`}-${format}-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  return (
    <div className="space-y-2 w-full">
      <div className="relative w-full rounded-xl overflow-hidden border border-gray-700 shadow-xl bg-gray-900" style={{ aspectRatio: `${w} / ${h}` }}>
        <canvas ref={canvasRef} width={w} height={h} className="w-full h-full" />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
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
        className={`flex items-center justify-center gap-1.5 border border-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-40 ${compact ? 'w-full px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
      >
        Download PNG · {w} × {h}
      </button>
    </div>
  )
}
