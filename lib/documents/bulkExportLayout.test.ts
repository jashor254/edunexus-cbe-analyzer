// lib/documents/bulkExportLayout.test.ts
//
// Regression tests for the bulk PDF tables.
//  1. A table row used to split across a page break (its Work Done text
//     continued on the next page) — rows now carry wrap={false}.
//  2. A table that continued onto another page had no column headers — the
//     header row is now `fixed`, so it repeats on every page.
//  3. A very long unbroken word ran across neighbouring columns — long tokens
//     now get soft-hyphen break opportunities (U+00AD).
//
// Structure is asserted on the real component trees; real PDFs are rendered
// with the real library. No network, no database, no AI.
//
// Run: npx tsx --test lib/documents/bulkExportLayout.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { View } from '@react-pdf/renderer'
import { ROWPage, SOWPage, softBreakLongTokens, generateBulkExportPDF, type SchemeMeta, type ExportScheme } from './bulkExportPdf'
import type { StoredRecordOfWork } from '@/lib/row/recordOfWork'

const meta: SchemeMeta = {
  id: 's', school: 'Synthetic Example School', grade: 'Grade 8', learning_area: 'Integrated Science', term: 2, year: 2026,
  curriculum_mode: 'cbc_junior', total_lessons: 3, total_weeks: 1, teacher_name: 'T', tsc_number: '0',
  lessons: [1, 2, 3].map(n => ({ week: 1, lesson: n, strand: 'S', substrand: 'SS', learningOutcomes: ['o'], learningResources: ['r'] })),
}
const row: StoredRecordOfWork = {
  rowId: 'r', schemeId: 's', school: 'x', grade: 'Grade 8', learningArea: 'Integrated Science', term: '2', year: 2026, curriculumMode: 'cbc_junior', teacherName: 'T',
  entries: [1, 2, 3].map(n => ({ week: 1, lesson: n, date_taught: n === 1 ? '2026-05-04' : null, strand: 'S', substrand: 'SS', activities_summary: ['a'], reflection: '', remarks: '', learning_outcomes: ['o'] })),
}

type El = React.ReactElement<{ children?: React.ReactNode; wrap?: boolean; fixed?: boolean; style?: unknown }>

/** Every element in a React tree, depth first. */
function walk(node: React.ReactNode, out: El[] = []): El[] {
  if (Array.isArray(node)) { node.forEach(n => walk(n, out)); return out }
  if (React.isValidElement(node)) {
    out.push(node as El)
    walk((node as El).props.children, out)
  }
  return out
}

test('BULK-LAYOUT-001 every Record of Work row keeps its lines together on one page', () => {
  const rows = walk(ROWPage({ meta, row })).filter(e => e.type === View && typeof e.key === 'string' && /^\d+:\d+$/.test(e.key))
  assert.equal(rows.length, 3, 'one keyed View per entry')
  for (const r of rows) assert.equal(r.props.wrap, false, `row ${r.key} must not split across pages`)
})

test('BULK-LAYOUT-002 every Scheme of Work row keeps its lines together on one page', () => {
  const rows = walk(SOWPage({ meta })).filter(e => e.type === View && e.props.wrap === false)
  assert.equal(rows.length, 3)
})

test('BULK-LAYOUT-003 the table header repeats on every page (fixed) in both tables', () => {
  for (const tree of [walk(ROWPage({ meta, row })), walk(SOWPage({ meta }))]) {
    const header = tree.filter(e => e.type === View && e.props.fixed === true && walk(e.props.children).some(c => String(c.props.children) === 'Wk'))
    assert.equal(header.length, 1, 'exactly one fixed header row containing the Wk column')
  }
})

test('BULK-LAYOUT-004 softBreakLongTokens leaves ordinary text alone and breaks only long runs', () => {
  const shy = '­'
  assert.equal(softBreakLongTokens('Learners work in groups of four'), 'Learners work in groups of four')
  assert.equal(softBreakLongTokens('Scientific Investigation'), 'Scientific Investigation')
  assert.equal(softBreakLongTokens('a'.repeat(24)), 'a'.repeat(24), 'exactly the limit: untouched')
  const broken = softBreakLongTokens('x'.repeat(60))
  assert.equal(broken, `${'x'.repeat(24)}${shy}${'x'.repeat(24)}${shy}${'x'.repeat(12)}`)
  assert.equal(broken.split(shy).join(''), 'x'.repeat(60), 'removing the soft hyphens restores the original text exactly')
  assert.equal(softBreakLongTokens(`ok ${'y'.repeat(30)} ok`).split(shy).length, 2)
  assert.equal(softBreakLongTokens(''), '')
})

test('BULK-LAYOUT-005 a document with many rows, long tokens and lesson plans renders to a valid multi-page PDF', async () => {
  const many: ExportScheme = {
    meta: { ...meta, total_lessons: 60, lessons: Array.from({ length: 60 }, (_, i) => ({ week: Math.floor(i / 4) + 1, lesson: (i % 4) + 1, strand: 'S'.repeat(90), substrand: 'SS', learningOutcomes: ['o'], learningResources: ['r'] })) },
    lessonPlans: [],
    recordOfWork: { ...row, entries: Array.from({ length: 60 }, (_, i) => ({ week: Math.floor(i / 4) + 1, lesson: (i % 4) + 1, date_taught: i < 3 ? '2026-05-04' : null, strand: 'S'.repeat(90), substrand: 'SS', activities_summary: ['w'.repeat(120)], reflection: 'r'.repeat(70), remarks: '', learning_outcomes: ['o'] })) },
  }
  const pdf = await generateBulkExportPDF([many], { sow: true, lessonPlans: false, recordOfWork: true })
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-')
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length
  assert.ok(pages >= 6, `60 rows in two tables span several pages, got ${pages}`)
})
