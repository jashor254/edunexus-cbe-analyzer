// lib/config/compassProviders.test.ts
// Fail-closed parsing of COMPASS_AI_PROVIDERS. Pure, STANDARD-safe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCompassProviders } from './compassProviders'

test('unset or empty → no provider (Compass paused)', () => {
  assert.deepEqual(resolveCompassProviders(undefined), [])
  assert.deepEqual(resolveCompassProviders(''), [])
  assert.deepEqual(resolveCompassProviders(' , ,'), [])
})

test('unknown values are ignored, never treated as permission', () => {
  assert.deepEqual(resolveCompassProviders('true'), [])
  assert.deepEqual(resolveCompassProviders('all'), [])
  assert.deepEqual(resolveCompassProviders('together,openai'), [])
})

test('order is preserved, case and spacing normalised, duplicates dropped', () => {
  assert.deepEqual(resolveCompassProviders('gemini,deepseek'), ['gemini', 'deepseek'])
  assert.deepEqual(resolveCompassProviders(' DeepSeek , GEMINI '), ['deepseek', 'gemini'])
  assert.deepEqual(resolveCompassProviders('gemini,gemini'), ['gemini'])
  assert.deepEqual(resolveCompassProviders('gemini,bogus'), ['gemini'])
})
