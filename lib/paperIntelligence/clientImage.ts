// lib/paperIntelligence/clientImage.ts
//
// Browser-only image compression for Paper Intelligence capture. Runs in the
// phone's browser before any upload: resize to a long-edge bound and
// re-encode as JPEG, so a 4-8 MB phone photo becomes a few hundred KB over a
// cheap mobile connection. Pure client util (uses Image/canvas) — never
// imported by a server route. Shared by scheme capture (Commit 3) and script
// capture (Commit 4). sharpness.ts is pure and runtime-agnostic, so the phone
// runs the server's exact focus measure.

import { analysisSize, assessSharpness, type SharpnessResult } from './sharpness'

export type CompressedImage = {
  /** Raw base64, no "data:" prefix — the shape the API routes expect. */
  imageBase64: string
  mimeType: 'image/jpeg'
  /** Approximate byte size of the compressed JPEG. */
  bytes: number
  /**
   * The same focus measure the server applies, taken on the compressed image
   * the server will receive — so "too blurry, retake" shows before any upload.
   * Advisory only: the server re-measures every page itself.
   */
  sharpness: SharpnessResult
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the image file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the image'))
    img.src = dataUrl
  })
}

/**
 * Resize `file` so its longest edge is at most `maxEdge` px and re-encode as
 * JPEG at `quality`. Returns raw base64 + the approximate compressed size.
 */
export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<CompressedImage> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const longest = Math.max(img.width, img.height) || 1
  const scale = Math.min(1, maxEdge / longest)
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable on this device')
  ctx.drawImage(img, 0, 0, width, height)

  const jpegDataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = jpegDataUrl.split(',')[1] ?? ''
  const bytes = Math.ceil(base64.length * 0.75)
  const sharpness = measureSharpness(await loadImage(jpegDataUrl))
  return { imageBase64: base64, mimeType: 'image/jpeg', bytes, sharpness }
}

function measureSharpness(img: HTMLImageElement): SharpnessResult {
  const size = analysisSize(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context is unavailable on this device')
  ctx.drawImage(img, 0, 0, size.width, size.height)
  const rgba = ctx.getImageData(0, 0, size.width, size.height).data
  const grey = new Uint8ClampedArray(size.width * size.height)
  for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
    grey[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
  }
  return assessSharpness({ pixels: grey, width: size.width, height: size.height })
}

/** Human-readable KB/MB for the "average upload size" readout. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
