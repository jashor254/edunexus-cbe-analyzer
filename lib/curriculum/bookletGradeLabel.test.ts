// lib/curriculum/bookletGradeLabel.test.ts
//
// (Lives outside the bracketed route folder on purpose: Node's test runner treats
// `[scheme_id]` in a path as a glob character class and would silently run zero tests.)
//
// Regression: the Booklet header printed "Grade Grade 8" (and "Grade Form 3")
// because it prefixed "Grade " to the stored grade, which already carries its
// label. Renders the real component to static markup from synthetic data.
//
// Run: npx tsx --test lib/curriculum/bookletGradeLabel.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BookletClient from '@/app/teacher/booklet/[scheme_id]/BookletClient'

function html(grade: string): string {
  return renderToStaticMarkup(React.createElement(BookletClient, {
    scheme: { id: 's', school: 'Synthetic Example School', learning_area: 'Integrated Science', grade, term: 2, year: 2026, teacher_name: 'Synthetic Teacher', tsc_number: '000000', textbook: 'Synthetic Textbook' },
    lessons: [{ id: 'l1', week_number: 1, lesson_number: 1, strand: 'S', sub_strand: 'SS', step_1: null, date_taught: null, activities_summary: null, reflection: null, is_taught: false }],
    breaks: [], totalLessons: 1, taughtLessons: 0,
  }))
}

test('BOOKLET-GRADE-001 Grade 7-9 and Grade 10 read once in the header and the field', () => {
  for (const g of ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']) {
    const out = html(g)
    assert.doesNotMatch(out, /Grade\s*(<!--\s*-->)?\s*Grade/i, `${g}: doubled word`)
    assert.ok((out.match(new RegExp(g.replace(' ', '\\s'), 'g')) ?? []).length >= 2, `${g} appears in the header and in the field`)
  }
})

test('BOOKLET-GRADE-002 forms read as forms, with a Form field label', () => {
  for (const f of ['Form 3', 'Form 4']) {
    const out = html(f)
    assert.doesNotMatch(out, /Grade\s*(<!--\s*-->)?\s*Form/i, `${f}: "Grade Form"`)
    assert.match(out, new RegExp(`>${f}<`), `${f} shown as the field value`)
    assert.match(out, />Form</, 'field label is "Form"')
  }
})

test('BOOKLET-GRADE-003 a bare number still gets the Grade label, once', () => {
  const out = html('8')
  assert.doesNotMatch(out, /Grade\s*(<!--\s*-->)?\s*Grade/i)
  assert.match(out, />Grade 8</)
})

test('BOOKLET-GRADE-004 formatting only: Grade 11 is shown as given (nothing enabled)', () => {
  const out = html('Grade 11')
  assert.match(out, />Grade 11</)
  assert.doesNotMatch(out, /Grade\s*(<!--\s*-->)?\s*Grade/i)
})
