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
  assert.match(f, /^No lessons recorded as taught yet\. 3 lessons planned\.$/)
})

test('ROW-C-002 no lesson taught: every Work Done cell is labelled Planned', () => {
  const html = generateROWHTML(row([entry(1, null), entry(2, undefined)]))
  const planned = html.match(/<span class="planned-tag">Planned: <\/span>/g) ?? []
  assert.equal(planned.length, 2)
  assert.match(html, /Plan step for lesson 1/, 'planned text is kept, not deleted')
})

test('ROW-C-003 partly taught: only teacher-dated lessons count and read as done', () => {
  const html = generateROWHTML(row([entry(1, '2026-02-03'), entry(2, null), entry(3, null)]))
  assert.equal(footer(html), '1 of 3 lessons recorded as taught. 2 remaining lessons are planned.')
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
  assert.equal(footer(html), 'All 2 lessons recorded as taught.')
  assert.doesNotMatch(html, /<span class="planned-tag">/)
})

test('ROW-C-006 existing records: a legacy "completed" status without a date is still planned', () => {
  // row_entries.status is not part of the read model; a legacy row that the old
  // default marked 'completed' but that carries no teacher date must not read
  // as taught.
  const legacy = { ...entry(1, null), status: 'completed' } as Entry
  const html = generateROWHTML(row([legacy]))
  assert.match(footer(html), /^No lessons recorded as taught yet\. 1 lesson planned\.$/)
  assert.match(html, /<span class="planned-tag">/)
})

test('ROW-C-007 empty record and empty Work Done never print a bare "Planned:"', () => {
  assert.equal(footer(generateROWHTML(row([]))), 'No lessons in this record yet.')
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
  assert.equal(footer(html), 'Kipindi 1 kati ya 2 kimerekodiwa kuwa kimefundishwa. Kipindi 1 kilichobaki kimepangwa.')
  assert.match(html, /Imepangwa: /)
  assert.equal(progressStatement('sw', 0, 5), 'Hakuna kipindi kilichorekodiwa kuwa kimefundishwa bado. Vipindi 5 vimepangwa.')
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
      if (total > 0 && done === total) assert.match(s, total === 1 ? /^1 lesson recorded as taught\.$/ : new RegExp(`^All ${total} lessons recorded as taught[.]$`))
    }
  }
})

test('ROW-C-012 footer wording: zero, one, several, one remaining, all (EN + SW)', () => {
  const cases: Array<[number, number, string, string]> = [
    [0, 0, 'No lessons in this record yet.', 'Hakuna vipindi kwenye rekodi hii bado.'],
    [0, 24, 'No lessons recorded as taught yet. 24 lessons planned.', 'Hakuna kipindi kilichorekodiwa kuwa kimefundishwa bado. Vipindi 24 vimepangwa.'],
    [1, 24, '1 of 24 lessons recorded as taught. 23 remaining lessons are planned.', 'Kipindi 1 kati ya 24 kimerekodiwa kuwa kimefundishwa. Vipindi 23 vilivyobaki vimepangwa.'],
    [5, 24, '5 of 24 lessons recorded as taught. 19 remaining lessons are planned.', 'Vipindi 5 kati ya 24 vimerekodiwa kuwa vimefundishwa. Vipindi 19 vilivyobaki vimepangwa.'],
    [23, 24, '23 of 24 lessons recorded as taught. 1 remaining lesson is planned.', 'Vipindi 23 kati ya 24 vimerekodiwa kuwa vimefundishwa. Kipindi 1 kilichobaki kimepangwa.'],
    [24, 24, 'All 24 lessons recorded as taught.', 'Vipindi vyote 24 vimerekodiwa kuwa vimefundishwa.'],
  ]
  for (const [done, total, en, sw] of cases) {
    assert.equal(progressStatement('en', done, total), en)
    assert.equal(progressStatement('sw', done, total), sw)
  }
  // the first sentence matches the founder-approved strings exactly
  assert.ok(progressStatement('sw', 1, 24).startsWith('Kipindi 1 kati ya 24 kimerekodiwa kuwa kimefundishwa.'))
  assert.ok(progressStatement('sw', 5, 24).startsWith('Vipindi 5 kati ya 24 vimerekodiwa kuwa vimefundishwa.'))
})

test('ROW-C-013 no remaining-planned clause when nothing remains; no verification claims', () => {
  for (const lang of ['en', 'sw'] as const) {
    for (const total of [1, 2, 24]) {
      const s = progressStatement(lang, total, total)
      assert.doesNotMatch(s, /planned|remaining|zilizobaki|vilivyobaki|kilichobaki|vimepangwa|kimepangwa/i)
    }
    for (let done = 0; done <= 3; done++) {
      assert.doesNotMatch(progressStatement(lang, done, 3), /verified|imethibitishwa|vimethibitishwa/i)
    }
  }
})

test('ROW-C-014 date rule: date without reflection counts, reflection without date does not', () => {
  const dateOnly = { ...entry(1, '2026-02-03'), reflection: '' }
  const reflectionOnly = { ...entry(2, null), reflection: 'Went well' }
  assert.equal(countConfirmed([dateOnly, reflectionOnly]), 1)
  const html = generateROWHTML(row([dateOnly, reflectionOnly]))
  assert.equal(footer(html), '1 of 2 lessons recorded as taught. 1 remaining lesson is planned.')
})

test('ROW-C-015 editor print view and PDFs share one rule; unrelated labels unchanged', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync('app/teacher/record-of-work/?id?/page.tsx'.replace('?id?', '[id]'), 'utf8')
  assert.match(page, /countConfirmed\(entries\)/)
  assert.match(page, /progressStatement\('sw', recorded, total\)/)
  assert.match(page, /progressStatement\('en', recorded, total\)/)
  // the print status no longer derives from reflections
  assert.doesNotMatch(page, /status: `.*\$\{done\}/)
  // on-screen counts remain explicitly labelled as reflection counts
  assert.match(page, /lessons with reflections/)
  const booklet = readFileSync('app/teacher/booklet/[scheme_id]/BookletClient.tsx', 'utf8')
  assert.match(booklet, /progressStatement\('en', taughtLessons, totalLessons\)/)
  // title and column labels are untouched
  assert.match(page, /Rekodi ya Kazi Iliyofunzwa/)
  assert.match(page, /Wiki \/ Somo/)
  assert.match(generateROWHTML(row([entry(1, null)], 'Kiswahili')), /REKODI YA KAZI ILIYOFUNZWA/)
})
