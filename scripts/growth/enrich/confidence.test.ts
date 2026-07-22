// Run: npx tsx --test scripts/growth/enrich/confidence.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFieldConfidence, bestConfidence } from './confidence'

test('computeFieldConfidence: cross-confirmed always wins as Verified regardless of source type', () => {
  assert.equal(computeFieldConfidence('official_website', true), 'Verified')
  assert.equal(computeFieldConfidence('facebook', true), 'Verified')
})

test('computeFieldConfidence: contact_page is High', () => {
  assert.equal(computeFieldConfidence('contact_page', false), 'High')
})

test('computeFieldConfidence: official_website (homepage/about) is Medium', () => {
  assert.equal(computeFieldConfidence('official_website', false), 'Medium')
})

test('computeFieldConfidence: facebook is Low', () => {
  assert.equal(computeFieldConfidence('facebook', false), 'Low')
})

test('computeFieldConfidence: google_places/manual default to Unknown', () => {
  assert.equal(computeFieldConfidence('google_places', false), 'Unknown')
  assert.equal(computeFieldConfidence('manual', false), 'Unknown')
})

test('bestConfidence: picks the strongest confidence among found fields, ignoring Unknown', () => {
  assert.equal(bestConfidence(['Medium', 'Low', 'Unknown']), 'Medium')
  assert.equal(bestConfidence(['High', 'Verified']), 'Verified')
})

test('bestConfidence: all Unknown (nothing found) stays Unknown', () => {
  assert.equal(bestConfidence(['Unknown', 'Unknown']), 'Unknown')
  assert.equal(bestConfidence([]), 'Unknown')
})
