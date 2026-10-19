// lib/paperIntelligence/clientPdf.ts
//
// Browser-only — opens a scanned class PDF and renders its pages as the same
// JPEGs a phone capture produces (long edge 1600 px, quality 0.8; see
// clientImage.ts), so the server's sharpness check, metadata strip and the
// marking model see a scanned page exactly like a photographed one. pdf.js is
// loaded on demand (only when a teacher actually opens a PDF) and parses in a
// web worker, so a large scan does not freeze a cheap phone's UI thread.
// Never imported by a server route.

import type { PDFDocumentProxy } from 'pdfjs-dist'

export type RenderedPage = { imageBase64: string; mimeType: 'image/jpeg' }

export type OpenedPdf = {
  numPages: number
  /** Full-size page for upload. */
  renderPage(pageNumber: number): Promise<RenderedPage>
  /** Small data-URL thumbnail for the confirm screen. */
  thumbnail(pageNumber: number): Promise<string>
  close(): Promise<void>
}

const UPLOAD_EDGE = 1600
const THUMB_EDGE = 220
const JPEG_QUALITY = 0.8

async function render(doc: PDFDocumentProxy, pageNumber: number, longEdge: number, quality: number): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = longEdge / Math.max(base.width, base.height)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable on this device')
  // White under the page: a scan with transparency would otherwise encode black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  page.cleanup()
  return canvas.toDataURL('image/jpeg', quality)
}

export async function openPdf(file: File): Promise<OpenedPdf> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  return {
    numPages: doc.numPages,
    async renderPage(pageNumber) {
      const dataUrl = await render(doc, pageNumber, UPLOAD_EDGE, JPEG_QUALITY)
      return { imageBase64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' }
    },
    thumbnail: pageNumber => render(doc, pageNumber, THUMB_EDGE, 0.6),
    close: () => task.destroy(),
  }
}
