// Run: npx tsx --test lib/schoolConcepts/contrastRatio.test.ts
//
// Measures contrast against the real theme values in the live Kutus config
// (via getSchoolConcept), not a copy of them — so if the theme changes,
// this test measures the new colours automatically instead of silently
// drifting out of sync with what's actually rendered.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrastRatio, blendOver } from './contrastRatio'
import { getSchoolConcept } from '@/data/schoolConcepts'

const config = getSchoolConcept('kutus-municipality')!
const { primary, primaryDark, cream, clay, charcoal } = config.theme

const AA_NORMAL_TEXT = 4.5

test('institutional label colour (clay) on cream meets AA for normal text', () => {
  const ratio = contrastRatio(clay, cream)
  assert.ok(ratio >= AA_NORMAL_TEXT, `clay on cream is ${ratio.toFixed(2)}:1, needs >= ${AA_NORMAL_TEXT}:1`)
})

test('clay on the demo-badge tinted-white surface (clay at 15% over white) meets AA for normal text', () => {
  const tint = blendOver(clay, '#ffffff', 0.15)
  const ratio = contrastRatio(clay, tint)
  assert.ok(ratio >= AA_NORMAL_TEXT, `clay on ${tint} is ${ratio.toFixed(2)}:1, needs >= ${AA_NORMAL_TEXT}:1`)
})

test('clay on the notice-board tinted surface (clay at 15% over cream) meets AA for normal text', () => {
  const tint = blendOver(clay, cream, 0.15)
  const ratio = contrastRatio(clay, tint)
  assert.ok(ratio >= AA_NORMAL_TEXT, `clay on ${tint} is ${ratio.toFixed(2)}:1, needs >= ${AA_NORMAL_TEXT}:1`)
})

test('white on primary (button text) still passes AA', () => {
  const ratio = contrastRatio('#ffffff', primary)
  assert.ok(ratio >= AA_NORMAL_TEXT, `white on primary is ${ratio.toFixed(2)}:1`)
})

test('charcoal body text on cream still passes AA', () => {
  const ratio = contrastRatio(charcoal, cream)
  assert.ok(ratio >= AA_NORMAL_TEXT, `charcoal on cream is ${ratio.toFixed(2)}:1`)
})

test('footer disclaimer text (cream at 60% over primary-dark) remains AA compliant', () => {
  const blended = blendOver(cream, primaryDark, 0.6)
  const ratio = contrastRatio(blended, primaryDark)
  assert.ok(ratio >= AA_NORMAL_TEXT, `footer disclaimer text is ${ratio.toFixed(2)}:1`)
})

test('footer nav links (cream at 80% over primary-dark) remain AA compliant', () => {
  const blended = blendOver(cream, primaryDark, 0.8)
  const ratio = contrastRatio(blended, primaryDark)
  assert.ok(ratio >= AA_NORMAL_TEXT, `footer nav link text is ${ratio.toFixed(2)}:1`)
})
