'use client'

/** Client helpers for getting a finished canvas onto a phone's share sheet. */

export function canvasBlob(canvas: HTMLCanvasElement | null, type = 'image/jpeg', quality = 0.92): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!canvas) return resolve(null)
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}

export async function downloadCanvas(canvas: HTMLCanvasElement | null, name: string): Promise<void> {
  const blob = await canvasBlob(canvas)
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

/**
 * Copy the caption (most apps drop text when a file is attached), then open
 * the share sheet with the image. Falls back to a download on desktop.
 * Returns a short status message for the UI.
 */
export async function shareImage(canvas: HTMLCanvasElement | null, caption: string, name: string): Promise<string> {
  const copied = await copyText(caption)
  const blob = await canvasBlob(canvas)
  if (!blob) return 'The image is still rendering. Try again in a second.'
  const file = new File([blob], name, { type: 'image/jpeg' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: caption })
      return copied ? 'Caption copied. Paste it if the app did not fill it in.' : 'Shared.'
    } catch { return '' }
  }
  await downloadCanvas(canvas, name)
  return copied ? 'Caption copied and image downloaded. Open the page and attach the image.' : 'Image downloaded.'
}
