// lib/paperIntelligence/sharpness.test.ts
// Pure unit tests — no DB, no network, no image library. Synthetic greyscale
// pages stand in for photos; the real-photo calibration is recorded on
// SHARP_REFERENCE_VARIANCE in sharpness.ts.
// Run with: npm test -- lib/paperIntelligence/sharpness.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessSharpness, laplacianTileVariance, analysisSize, type GreyImage } from './sharpness'

const W = 400
const H = 560

/** White page, ruled lines every 28px, dark "handwriting" strokes in a band of each line. */
function scriptPage(): GreyImage {
  const pixels = new Uint8ClampedArray(W * H).fill(235)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y % 28 === 0) pixels[y * W + x] = 150 // printed rule
      const inWritingBand = y % 28 > 8 && y % 28 < 22 && x > 30 && x < 340
      // Pseudo-glyphs: short vertical and diagonal strokes.
      if (inWritingBand && ((x % 11 < 2) || ((x + y) % 13 === 0))) pixels[y * W + x] = 40
    }
  }
  return { pixels, width: W, height: H }
}

function boxBlur(img: GreyImage, radiusX: number, radiusY: number): GreyImage {
  const { pixels, width, height } = img
  const out = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -radiusY; dy <= radiusY; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy))
        for (let dx = -radiusX; dx <= radiusX; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          sum += pixels[yy * width + xx]
          n++
        }
      }
      out[y * width + x] = sum / n
    }
  }
  return { pixels: out, width, height }
}

test('a sharp script page is acceptable', () => {
  const r = assessSharpness(scriptPage())
  assert.equal(r.acceptable, true)
  assert.ok(r.score > 0.5, `expected a high score, got ${r.score}`)
})

test('an out-of-focus page is rejected', () => {
  const r = assessSharpness(boxBlur(scriptPage(), 4, 4))
  assert.equal(r.acceptable, false, `score ${r.score}`)
})

test('a page shaken sideways is rejected even though the printed rules stay crisp', () => {
  // Horizontal-only smear: the ruled lines (horizontal) survive it, the
  // handwriting does not. A plain Laplacian would pass this page.
  const r = assessSharpness(boxBlur(scriptPage(), 8, 0))
  assert.equal(r.acceptable, false, `score ${r.score}`)
})

test('a page shaken vertically is rejected', () => {
  const r = assessSharpness(boxBlur(scriptPage(), 0, 8))
  assert.equal(r.acceptable, false, `score ${r.score}`)
})

test('blurrier means a lower score', () => {
  const sharp = laplacianTileVariance(scriptPage())
  const soft = laplacianTileVariance(boxBlur(scriptPage(), 1, 1))
  const softer = laplacianTileVariance(boxBlur(scriptPage(), 3, 3))
  assert.ok(sharp > soft && soft > softer, `${sharp} > ${soft} > ${softer}`)
})

test('a blank page scores zero and is rejected — nothing to read', () => {
  const blank: GreyImage = { pixels: new Uint8ClampedArray(W * H).fill(240), width: W, height: H }
  const r = assessSharpness(blank)
  assert.equal(r.score, 0)
  assert.equal(r.acceptable, false)
})

test('a degenerate or truncated image scores zero rather than throwing', () => {
  assert.equal(laplacianTileVariance({ pixels: [], width: 0, height: 0 }), 0)
  assert.equal(laplacianTileVariance({ pixels: new Uint8ClampedArray(10), width: 100, height: 100 }), 0)
})

test('score is bounded to 0..1', () => {
  // Checkerboard: maximal detail in both directions.
  const checker = new Uint8ClampedArray(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) checker[y * W + x] = (x + y) % 2 === 0 ? 0 : 255
  const r = assessSharpness({ pixels: checker, width: W, height: H })
  assert.equal(r.score, 1)
})

test('analysisSize bounds the long edge and never upscales', () => {
  assert.deepEqual(analysisSize(3264, 2448), { width: 800, height: 600 })
  assert.deepEqual(analysisSize(2448, 3264), { width: 600, height: 800 })
  assert.deepEqual(analysisSize(640, 480), { width: 640, height: 480 })
})
