// lib/compass/compassProviderBoundary.architecture.test.ts
//
// Privacy boundary guard (Stage B2). buildCompassProviderPayload is the one
// place that decides what a Compass turn sends to the external model, and its
// own tests inspect that output. These guards prove the route actually uses
// it, so a future edit cannot quietly hand the raw message, raw history or a
// prompt built with the real name straight to the provider.
//
// Run: npm test (listed in scripts/standard-tests.json)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const route = readFileSync(path.join(ROOT, 'app/api/learn/route.ts'), 'utf8')

test('the Compass route sends only providerPayload fields to streamDeepSeek', () => {
  const calls = [...route.matchAll(/streamDeepSeek\(([^)]*)\)/g)].map(m => m[1])
  assert.equal(calls.length, 1, 'expected exactly one provider call in the Compass route')
  const args = calls[0].split(',').map(a => a.trim())
  assert.deepEqual(args.slice(0, 3), ['providerPayload.systemPrompt', 'providerPayload.message', 'providerPayload.history'])
})

test('the Compass route builds its payload through buildCompassProviderPayload, not buildCompassPrompt', () => {
  assert.match(route, /buildCompassProviderPayload\(/)
  assert.doesNotMatch(route, /\bbuildCompassPrompt\b/, 'building the prompt in the route bypasses the name scrub')
})

test('the Compass route never puts the real firstName into prompt params', () => {
  assert.match(route, /const promptParams: Omit<CompassPromptParams, 'firstName'>/)
})

test('the Compass route never logs a raw JSON.parse error for model-written eval text', () => {
  // V8's JSON.parse messages quote the start of the input — model-written
  // session text that can carry learner content.
  assert.doesNotMatch(route, /console\.(error|warn|log)\([^)]*,\s*parseErr\s*\)/)
})

test('the provider gate runs before any session write, prompt build or provider call', () => {
  const gate = route.indexOf('resolveCompassProviders()')
  assert.ok(gate > 0, 'route must resolve the allowed providers')
  assert.match(route, /if \(providers\.length === 0\) return apiError\(COMPASS_PAUSED_MESSAGE, 503\)/)
  for (const later of ['getOrCreateSession(studentId, earlySubject', 'buildCompassProviderPayload(', 'streamDeepSeek(']) {
    const at = route.indexOf(later)
    assert.ok(at > gate, `${later} must come after the provider gate`)
  }
})

test('the Compass route passes its approved provider list to streamDeepSeek', () => {
  assert.match(route, /streamDeepSeek\([^)]*\{\s*providers,/)
})

test('the Compass route never logs a raw error object in its fatal handler', () => {
  assert.doesNotMatch(route, /console\.error\('\[learn\] FATAL:', error\)/)
})
