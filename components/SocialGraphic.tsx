'use client'

import { useEffect, useRef, useState } from 'react'

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
  | 'meeting_day' | 'recap' | 'evergreen' | 'photo' | 'custom'

export type GraphicFormat = 'square' | 'portrait'

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

function drawSpotlight(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement | null) {
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
  if (photo) {
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

function drawSpeaker(ctx: Ctx, W: number, H: number, d: GraphicData, photo: HTMLImageElement | null) {
  const ph = Math.round(H * 0.5)
  if (photo) {
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
  const story = d.caption || "Come hear this week's featured speaker share their story and expertise."
  ctx.font = f(400, 28, true)
  ctx.fillStyle = SOFT
  const maxLines = Math.max(2, Math.floor((H - FOOTER_H - 20 - y) / 42))
  drawWrapped(ctx, story, W / 2, y + 22, W - PAD * 2 - 40, 42, Math.min(maxLines, 4))
  ctx.textAlign = 'left'
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

async function ensureFonts() {
  try {
    if (typeof document === 'undefined' || !document.fonts) return
    await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Inter`)))
  } catch { /* fall back to Arial */ }
}

async function paint(canvas: HTMLCanvasElement, data: GraphicData, format: GraphicFormat) {
  const { w: W, h: H } = FORMAT_SIZE[format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  await ensureFonts()
  const [photo, bni, webtek] = await Promise.all([
    loadImage(data.memberPhoto || data.memberLogo),
    loadImage('/BNI-Logo.png'),
    loadImage('/logo.png'),
  ])

  ctx.clearRect(0, 0, W, H)
  const usePhotoCard = data.kind === 'photo' && !!photo
  const onRed = data.kind === 'meeting_day' || data.kind === 'visitor_invite'

  if (usePhotoCard) {
    drawPhotoCard(ctx, W, H, data, photo as HTMLImageElement)
  } else {
    drawBackground(ctx, W, H, onRed && !['spotlight', 'speaker', 'open_seats'].includes(data.kind))
    if (data.kind === 'spotlight') drawSpotlight(ctx, W, H, data, photo)
    else if (data.kind === 'speaker') drawSpeaker(ctx, W, H, data, photo)
    else if (data.kind === 'open_seats') drawOpenSeats(ctx, W, H, data)
    else drawStatement(ctx, W, H, data)
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
