// lib/row/recordOfWorkCompletion.test.ts
//
// Regression tests for the Record of Work completion semantics.
//
// The defect: the printed footer read "N of N lessons recorded" before any
// lesson had been taught, because "recorded" was computed from the Work Done
// text — which is always non-empty (it is the PLAN, seeded from the lesson
// plan's steps, falling back to the sub-strand). A plan is not evidence of
// delivery. The only teacher-owned evidence is date_taught.
//
// Pure tests: no DB, no AI, no network. (recordOfWork.ts only builds a database
// client lazily inside its async functions; importing it for workDoneFor is inert.)
//
// Run: npx tsx --experimental-test-module-mocks --test lib/row/recordOfWorkCompletion.test.ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

let generateROWHTML: typeof import('./pdfRenderer').generateROWHTML
let isTeacherConfirmed: typeof import('./completion').isTeacherConfirmed
let countConfirmed: typeof import('./completion').countConfirmed
let progressStatement: typeof import('./completion').progressStatement
let describeWorkDone: typeof import('./completion').describeWorkDone
let plannedPrefix: typeof import('./completion').plannedPrefix
let rowWorkDoneCell: typeof import('@/lib/documents/bulkExportPdf').rowWorkDoneCell
let workDoneFor: typeof import('./recordOfWork').workDoneFor

before(async () => {
  ;({ generateROWHTML } = await import('./pdfRenderer'))
  ;({ isTeacherConfirmed, countConfirmed, progressStatement, describeWorkDone, plannedPrefix } = await import('./completion'))
  ;({ rowWorkDoneCell } = await import('@/lib/documents/bulkExportPdf'))
  ;({ workDoneFor } = await import('./recordOfWork'))
})

type Entry = {
  week_number: number; lesson_number: number; date_taught?: string | null
  strand: string; sub_strand: string; work_done: string; reflection: string
}

function entry(lesson: number, date: string | null | undefined, work = `Plan step for lesson ${lesson}`): Entry {
  return { week_number: 1, lesson_number: lesson, date_taught: date, strand: 'S', sub_strand: 'SS', work_done: work, reflection: '' }
}

function row(entries: Entry[], learning_area = 'Integrated Science') {
  return { teacher_name: 'T', school: 'Example School', grade: 'Grade 7', learning_area, term: 1, year: 2026, entries }
}

/** Footer sentence of the rendered HTML. */
function footer(html: string): string {
  const m = html.match(/<div class="row-status">\s*([\s\S]*?)\s*<\/div>/)
  assert.ok(m, 'row-status footer present')
  return m[1].trim()
}

test('ROW-C-001 all lessons only planned: footer must not claim any lesson is recorded', () => {
  const html = generateROWHTML(row([entry(1, null), entry(2, null), entry(3, null)]))
  const f = footer(html)
  assert.doesNotMatch(f, /3 of 3/)
  assert.match(f, /No lessons taught and recorded yet — 3 planned/)
})

test('ROW-C-002 no lesson taught: every Work Done cell is labelled Planned', () => {
  const html = generateROWHTML(row([entry(1, null), entry(2, undefined)]))
  const planned = html.match(/<span class="planned-tag">Planned: <\/span>/g) ?? []
  assert.equal(planned.length, 2)
  assert.match(html, /Plan step for lesson 1/, 'planned text is kept, not deleted')
})

test('ROW-C-003 partly taught: only teacher-dated lessons count and read as done', () => {
  const html = generateROWHTML(row([entry(1, '2026-02-03'), entry(2, null), entry(3, null)]))
  assert.equal(footer(html), '1 of 3 lessons taught and recorded — the rest are planned')
  const planned = html.match(/<span class="planned-tag">/g) ?? []
  assert.equal(planned.length, 2, 'the dated lesson is not labelled Planned')
  assert.match(html, /<td class="col-work">Plan step for lesson 1<\/td>/)
})

test('ROW-C-004 missing / blank dates never imply completion', () => {
  for (const missing of [null, undefined, '', '   ']) {
    assert.equal(isTeacherConfirmed({ date_taught: missing }), false, `date ${JSON.stringify(missing)}`)
  }
  assert.equal(isTeacherConfirmed(null), false)
  assert.equal(isTeacherConfirmed(undefined), false)
  assert.equal(isTeacherConfirmed({ date_taught: '2026-02-03' }), true)
  assert.equal(countConfirmed([{ date_taught: null }, { date_taught: ' ' }, { date_taught: '2026-02-03' }]), 1)
})

test('ROW-C-005 all lessons taught: footer states every lesson, no planned labels', () => {
  const html = generateROWHTML(row([entry(1, '2026-02-03'), entry(2, '2026-02-05')]))
  assert.equal(footer(html), '2 of 2 lessons taught and recorded — the rest are planned')
  assert.doesNotMatch(html, /<span class="planned-tag">/)
})

test('ROW-C-006 existing records: a legacy "completed" status without a date is still planned', () => {
  // row_entries.status is not part of the read model; a legacy row that the old
  // default marked 'completed' but that carries no teacher date must not read
  // as taught.
  const legacy = { ...entry(1, null), status: 'completed' } as Entry
  const html = generateROWHTML(row([legacy]))
  assert.match(footer(html), /No lessons taught and recorded yet — 1 planned/)
  assert.match(html, /<span class="planned-tag">/)
})

test('ROW-C-007 empty record and empty Work Done never print a bare "Planned:"', () => {
  assert.equal(footer(generateROWHTML(row([]))), 'No lessons in this record yet')
  const html = generateROWHTML(row([entry(1, null, '   ')]))
  assert.doesNotMatch(html, /<span class="planned-tag">/)
  assert.deepEqual(describeWorkDone('', false, 'en'), { text: '', planned: false, prefix: '' })
})

test('ROW-C-008 planned text is HTML-escaped', () => {
  const html = generateROWHTML(row([entry(1, null, '<script>alert(1)</script>')]))
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;/)
})

test('ROW-C-009 Kiswahili record uses Kiswahili wording', () => {
  const html = generateROWHTML(row([entry(1, null), entry(2, '2026-02-03')], 'Kiswahili'))
  assert.match(footer(html), /Masomo 1 kati ya 2 yamefundishwa na kurekodiwa — mengine yamepangwa/)
  assert.match(html, /Imepangwa: /)
  assert.match(progressStatement('sw', 0, 5), /Hakuna somo lililorekodiwa bado — masomo 5 yamepangwa/)
})

test('ROW-C-010 export consistency: bulk-PDF cell follows the same rule as the single download', () => {
  const planned = { week: 1, lesson: 1, date_taught: null, strand: 's', substrand: 'Fire safety', activities_summary: ['Learners discuss hazards'], reflection: '', remarks: '', learning_outcomes: [] }
  const taught  = { ...planned, lesson: 2, date_taught: '2026-02-03' }
  assert.equal(rowWorkDoneCell(planned), `${plannedPrefix('en')}Learners discuss hazards`)
  assert.equal(rowWorkDoneCell(taught), 'Learners discuss hazards')
  // sub-strand fallback (entry seeded from scheme_lessons, no activities)
  assert.equal(rowWorkDoneCell({ ...planned, activities_summary: [] }), `${plannedPrefix('en')}Fire safety`)
  // and the single-download HTML agrees on the same two entries
  const html = generateROWHTML(row([
    entry(1, null, workDoneFor(planned)), entry(2, '2026-02-03', workDoneFor(taught)),
  ]))
  assert.match(html, /Planned: <\/span>Learners discuss hazards/)
  assert.match(html, /<td class="col-work">Learners discuss hazards<\/td>/)
})

test('ROW-C-011 footer counts never exceed the total', () => {
  for (let total = 0; total <= 4; total++) {
    for (let done = 0; done <= total; done++) {
      const s = progressStatement('en', done, total)
      assert.ok(s.length > 0)
      if (total > 0 && done === total) assert.match(s, new RegExp(`^${total} of ${total} lessons taught and recorded`))
    }
  }
})
