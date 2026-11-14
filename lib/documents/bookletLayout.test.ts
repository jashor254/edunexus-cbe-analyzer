// lib/documents/bookletLayout.test.ts
//
// Regression: in the teacher Booklet a very long unbroken word stretched its
// column and squeezed the neighbouring ones until their text was clipped.
// Text cells now wrap anywhere; the Date column is excluded so a date never
// breaks mid-number. Real component, synthetic data, no network.
//
// Run: npx tsx --test lib/documents/bookletLayout.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BookletClient from '@/app/teacher/booklet/[scheme_id]/BookletClient'

const markup = renderToStaticMarkup(React.createElement(BookletClient, {
  scheme: { id: 's', school: 'Example School', learning_area: 'Integrated Science', grade: 'Grade 8', term: 2, year: 2026, teacher_name: 'T', tsc_number: '0', textbook: 'B' },
  lessons: [
    { id: 'a', week_number: 1, lesson_number: 1, strand: 'x'.repeat(120), sub_strand: 'SS', step_1: null, date_taught: '2026-05-04', activities_summary: ['did it'], reflection: null, is_taught: true },
    { id: 'b', week_number: 1, lesson_number: 2, strand: 'S', sub_strand: 'SS', step_1: null, date_taught: null, activities_summary: null, reflection: null, is_taught: false },
  ],
  breaks: [], totalLessons: 2, taughtLessons: 1,
}))

test('BOOKLET-LAYOUT-001 the table wraps long unbroken words', () => {
  assert.match(markup, /<table[^>]*class="booklet-table[^"]*"[^>]*style="[^"]*overflow-wrap:anywhere/)
})

test('BOOKLET-LAYOUT-002 date cells never break mid-date and still show the date or the placeholder', () => {
  const dateCells = markup.match(/<td[^>]*white-space:nowrap[^>]*>[\s\S]*?<\/td>/g) ?? []
  assert.equal(dateCells.length, 2, 'one nowrap date cell per lesson')
  assert.match(dateCells[0], /04\/05\/2026/)
  assert.match(dateCells[1], /dd\/mm\/yyyy/)
  for (const c of dateCells) assert.match(c, /overflow-wrap:normal/)
})

test('BOOKLET-LAYOUT-003 the long word is still present in full (wrapping, not truncation)', () => {
  assert.ok(markup.includes('x'.repeat(120)))
})

test('BOOKLET-LAYOUT-004 the recorded count still follows the teacher-confirmed rule', () => {
  assert.match(markup, /1 of 2/)
})
