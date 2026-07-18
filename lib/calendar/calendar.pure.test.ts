// Run: npx tsx --test lib/calendar/calendar.pure.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCalendar } from './calendarPure'

test('mergeCalendar: combines events and assignment due dates into one sorted list', () => {
  const entries = mergeCalendar({
    events: [{ id: 'e1', class_id: 'c1', title: 'CAT 1', description: 'Bring calculator', event_date: '2026-08-10' }],
    assignments: [{ id: 'a1', class_id: 'c1', title: 'Homework 1', due_date: '2026-08-05T00:00:00Z' }],
  })
  assert.equal(entries.length, 2)
  assert.equal(entries[0].id, 'a1') // earlier date sorts first
  assert.equal(entries[0].kind, 'assignment_due')
  assert.equal(entries[0].title, 'Homework 1 due')
  assert.equal(entries[1].id, 'e1')
  assert.equal(entries[1].kind, 'event')
})

test('mergeCalendar: assignment due_date is truncated to a plain date (time-of-day dropped)', () => {
  const entries = mergeCalendar({
    events: [],
    assignments: [{ id: 'a1', class_id: 'c1', title: 'Homework', due_date: '2026-08-05T23:59:00Z' }],
  })
  assert.equal(entries[0].date, '2026-08-05')
})

test('mergeCalendar: empty input produces an empty list, not an error', () => {
  assert.deepEqual(mergeCalendar({ events: [], assignments: [] }), [])
})

test('mergeCalendar: event without a description round-trips as null', () => {
  const entries = mergeCalendar({
    events: [{ id: 'e1', class_id: 'c1', title: 'Trip', description: null, event_date: '2026-09-01' }],
    assignments: [],
  })
  assert.equal(entries[0].description, null)
})
