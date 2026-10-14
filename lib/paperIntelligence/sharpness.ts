// lib/paperIntelligence/sharpness.ts
//
// Is this photo of a script sharp enough to read? Pure, runtime-agnostic: it
// takes greyscale pixels, so the phone (canvas) and the server (sharp) run the
// exact same measurement on the same-sized image.
//
// Measure: variance of the second derivative — the Laplacian focus measure,
// split by direction. Blur removes edges and the second derivative responds
// to edges. It is taken horizontally and vertically SEPARATELY and the weaker
// direction counts, because a shaky hand blurs along one direction only: on
// ruled exercise paper the printed lines keep a plain Laplacian high even when
// the handwriting is smeared sideways (measured on the Phase 0 photos).
//
// A script page is mostly blank paper, so a whole-image variance would call a
// sharp page with little writing "blurry". Instead the page is split into
// tiles and the score is a high percentile across tiles: the ink-bearing tiles
// decide, the blank ones don't drag the score down. A blurred page has no
// sharp tiles anywhere.

import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'

export type GreyImage = {
  /** One luminance byte (0-255) per pixel, row-major, length = width × height. */
  pixels: ArrayLike<number>
  width: number
  height: number
}

export type SharpnessResult = {
  /** 0..1, higher is sharper. Stored as assignment_submission_pages.blur_score. */
  score: number
  acceptable: boolean
}

const TILES_PER_SIDE = 8
const TILE_PERCENTILE = 0.9
/**
 * Raw variance mapped to score 1. Calibration, 2026-10-14: the 16 Phase 0
 * phone photos (scheme + three learners' scripts) put through the capture
 * pipeline (1600px JPEG 0.8, then this 800px analysis copy) measured raw
 * 74..1951, median 402. Blurred copies of the same photos: Gaussian sigma 8
 * (full-res) max 5, shake of 31px max 49, shake of 61px max 11. With
 * minSharpnessScore 0.15 the cut sits at raw 45 — every real photo passes
 * with margin, unreadable smears fail. Deliberately permissive: a wrongly
 * rejected good photo costs the teacher a retake loop, while a borderline one
 * still reaches review with the AI's own recognition-uncertainty flag.
 */
const SHARP_REFERENCE_VARIANCE = 300

/** Raw focus measure: the TILE_PERCENTILE-th directional second-derivative variance across tiles. */
export function laplacianTileVariance(image: GreyImage): number {
  const { pixels, width, height } = image
  if (width < 3 || height < 3 || pixels.length < width * height) return 0

  const tileW = Math.max(3, Math.floor(width / TILES_PER_SIDE))
  const tileH = Math.max(3, Math.floor(height / TILES_PER_SIDE))
  const variances: number[] = []

  for (let ty = 0; ty + tileH <= height; ty += tileH) {
    for (let tx = 0; tx + tileW <= width; tx += tileW) {
      let sumX = 0, sumSqX = 0, sumY = 0, sumSqY = 0, n = 0
      const yEnd = Math.min(ty + tileH, height - 1)
      const xEnd = Math.min(tx + tileW, width - 1)
      for (let y = Math.max(ty, 1); y < yEnd; y++) {
        const row = y * width
        for (let x = Math.max(tx, 1); x < xEnd; x++) {
          const i = row + x
          const dxx = pixels[i - 1] + pixels[i + 1] - 2 * pixels[i]
          const dyy = pixels[i - width] + pixels[i + width] - 2 * pixels[i]
          sumX += dxx; sumSqX += dxx * dxx
          sumY += dyy; sumSqY += dyy * dyy
          n++
        }
      }
      if (n > 0) {
        const varX = sumSqX / n - (sumX / n) ** 2
        const varY = sumSqY / n - (sumY / n) ** 2
        variances.push(Math.min(varX, varY))
      }
    }
  }

  if (variances.length === 0) return 0
  variances.sort((a, b) => a - b)
  return variances[Math.min(variances.length - 1, Math.floor(variances.length * TILE_PERCENTILE))]
}

export function assessSharpness(
  image: GreyImage,
  minScore: number = PAPER_INTELLIGENCE_LIMITS.minSharpnessScore,
): SharpnessResult {
  const score = Math.min(1, laplacianTileVariance(image) / SHARP_REFERENCE_VARIANCE)
  return { score: Math.round(score * 1000) / 1000, acceptable: score >= minScore }
}

/** Long-edge-bounded target size for the analysis copy (never upscales). */
export function analysisSize(width: number, height: number, maxEdge: number = PAPER_INTELLIGENCE_LIMITS.sharpnessAnalysisEdgePx): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
