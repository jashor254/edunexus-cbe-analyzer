// Run: npx tsx --test lib/growth/messaging/followUpSuggestion.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestFollowUp } from './followUpSuggestion'

const NOW = new Date('2026-07-22T00:00:00.000Z')
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

test('no suggestion when there is no prior contact', () => {
  assert.equal(suggestFollowUp(null, NOW), null)
})

test('no suggestion within the first 3 days', () => {
  assert.equal(suggestFollowUp(daysAgo(1), NOW), null)
})

test('suggests follow-up 1 at 3 days', () => {
  const s = suggestFollowUp(daysAgo(3), NOW)
  assert.equal(s?.templateId, 'follow_up_1')
})

test('suggests follow-up 2 at 7 days', () => {
  const s = suggestFollowUp(daysAgo(7), NOW)
  assert.equal(s?.templateId, 'follow_up_2')
})

test('suggests closing for now at 14 days, with no template', () => {
  const s = suggestFollowUp(daysAgo(14), NOW)
  assert.equal(s?.templateId, null)
  assert.match(s!.task, /close for now/i)
})
