import { test } from 'node:test'
import assert from 'node:assert/strict'
import { operatingModeLabel } from './attendanceOperatingMode'

const now = new Date('2026-07-18T12:00:00Z')

test('no sessions recorded yet -> paper', () => {
  const mode = operatingModeLabel([], now)
  assert.equal(mode.tone, 'paper')
  assert.equal(mode.label, 'No sessions recorded yet')
})

test('session marked today -> digital', () => {
  const mode = operatingModeLabel(['2026-07-18'], now)
  assert.equal(mode.tone, 'digital')
})

test('session 2 days ago -> hybrid', () => {
  const mode = operatingModeLabel(['2026-07-16'], now)
  assert.equal(mode.tone, 'hybrid')
  assert.match(mode.label, /2 days ago/)
})

test('session exactly 3 days ago is still hybrid, 4 days ago is not', () => {
  assert.equal(operatingModeLabel(['2026-07-15'], now).tone, 'hybrid')
  assert.equal(operatingModeLabel(['2026-07-14'], now).tone, 'paper')
})

test('session 10 days ago -> catching up (paper)', () => {
  const mode = operatingModeLabel(['2026-07-08'], now)
  assert.equal(mode.tone, 'paper')
  assert.match(mode.label, /Catching up/)
})

test('picks the most recent of multiple class dates, ignoring order', () => {
  const mode = operatingModeLabel(['2026-07-08', '2026-07-18', '2026-07-16'], now)
  assert.equal(mode.tone, 'digital')
})
