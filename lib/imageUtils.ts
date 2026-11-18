/**
 * Client-side image helpers for the Social Studio.
 * Photos are compressed in the browser (JPEG, max 1600px) so uploads stay small.
 */

export interface ProcessedImage { data: string; thumb: string }

/** Draw `src` to a canvas, optionally center-cropped to `aspect` (w/h), and return a JPEG data URI. */
export function renderToJpeg(
  src: CanvasImageSource, sw: number, sh: number,
  opts: { maxSide: number; quality: number; aspect?: number }
): string {
  let cx = 0, cy = 0, cw = sw, ch = sh
  if (opts.aspect) {
    if (sw / sh > opts.aspect) { cw = sh * opts.aspect; cx = (sw - cw) / 2 }
    else { ch = sw / opts.aspect; cy = (sh - ch) * 0.3 }   // bias up: faces sit high in the frame
  }
  const scale = Math.min(1, opts.maxSide / Math.max(cw, ch))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(cw * scale))
  c.height = Math.max(1, Math.round(ch * scale))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', opts.quality)
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
    img.src = url
  })
}

/** Compress a File/Blob into a full-size + thumbnail pair. Optionally crop to `aspect`. */
export async function processImage(blob: Blob, aspect?: number): Promise<ProcessedImage> {
  const img = await blobToImage(blob)
  const w = img.naturalWidth, h = img.naturalHeight
  return {
    data: renderToJpeg(img, w, h, { maxSide: 1600, quality: 0.85, aspect }),
    thumb: renderToJpeg(img, w, h, { maxSide: 320, quality: 0.7, aspect }),
  }
}
