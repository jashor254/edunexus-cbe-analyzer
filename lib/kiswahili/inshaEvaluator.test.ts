// lib/kiswahili/inshaEvaluator.test.ts
//
// Sprint 2 (Pilot Hardening): AI Fallback Integrity.
// Proves evaluateInsha() correctly flags isFallback on every non-genuine
// path (AI call failure/timeout, malformed AI response) and never flags it
// on a real, successfully parsed evaluation. DeepSeek is mocked once for
// the whole file (node:test's experimental mock.module is unreliable across
// repeated mock/restore cycles in one process) — each test instead switches
// a shared mutable behavior flag before calling evaluateInsha. These tests
// make no real AI calls and cost no tokens.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/kiswahili/inshaEvaluator.test.ts
import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { EvaluateInshaParams, InshaFeedback } from './inshaEvaluator'

const VALID_AI_RESPONSE = JSON.stringify({
  dimensions: {
    utangulizi: { score: 3, mwongozo: 'Nzuri.' },
    kiini:      { score: 3, mwongozo: 'Nzuri.' },
    hitimisho:  { score: 3, mwongozo: 'Nzuri.' },
    msamiati:   { score: 3, mwongozo: 'Nzuri.' },
    sarufi:     { score: 2, mwongozo: 'Boresha.' },
    mtiririko:  { score: 3, mwongozo: 'Nzuri.' },
  },
  nguvu: ['Msamiati mzuri', 'Muundo sahihi'],
  udhaifu: ['Sarufi'],
  hatua_inayofuata: 'Fanya mazoezi ya sarufi.',
  makosa_ya_sarufi: [],
  ngeli_zilizokosewa: [],
})

let deepSeekBehavior: 'success' | 'reject' | 'malformed' = 'success'

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      if (deepSeekBehavior === 'reject') throw new Error('DeepSeek request timed out')
      if (deepSeekBehavior === 'malformed') return 'this is not valid JSON {{{'
      return VALID_AI_RESPONSE
    },
  },
})
mock.module('@/lib/ai/logger', {
  namedExports: { logAICall: async () => {} }, // no-op — logging correctness tested separately
})

let evaluateInsha: (params: EvaluateInshaParams) => Promise<InshaFeedback>

before(async () => {
  ;({ evaluateInsha } = await import('./inshaEvaluator'))
})

test('AI success → isFallback is false and the real evaluation is returned', async () => {
  deepSeekBehavior = 'success'
  const feedback = await evaluateInsha({ insha: 'Hadithi ya mvulana...', inshaType: 'masimulizi', grade: 8 })

  assert.equal(feedback.isFallback, false)
  assert.equal(feedback.dimensions.utangulizi.score, 3)
  assert.equal(feedback.dimensions.sarufi.score, 2)
  assert.deepEqual(feedback.nguvu, ['Msamiati mzuri', 'Muundo sahihi'])
})

test('AI call failure/timeout → isFallback is true, never a genuine score', async () => {
  deepSeekBehavior = 'reject'
  const feedback = await evaluateInsha({ insha: 'Hadithi ya mvulana...', inshaType: 'masimulizi', grade: 8 })

  assert.equal(feedback.isFallback, true)
  assert.equal(feedback.jumla, 2)
  assert.deepEqual(feedback.nguvu, [], 'fallback must not fabricate strengths')
})

test('malformed AI JSON response → isFallback is true, never a genuine score', async () => {
  deepSeekBehavior = 'malformed'
  const feedback = await evaluateInsha({ insha: 'Hadithi ya mvulana...', inshaType: 'masimulizi', grade: 8 })

  assert.equal(feedback.isFallback, true)
  assert.equal(feedback.jumla, 2)
})
