// lib/core/schoolActivation.test.ts
//
// Sprint 9B — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established in lib/holiday/notify.test.ts and
// lib/core/permissions.test.ts. Every table this pipeline touches
// (academic_years, terms, streams, classes, school_settings) cascades on
// `schools` delete (ON DELETE CASCADE, confirmed live), so after() only
// needs to delete the synthetic school + its creator auth user.
//
// Run: npx tsx --env-file=.env.local --test lib/core/schoolActivation.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import {
  activateSchool,
  ensureAcademicYear,
  ensureDefaultTerms,
  ensureDefaultGrades,
  ensureStreams,
  ensureClasses,
  ensureSchoolSettings,
  resolveDefaultGrades,
  resolveDefaultTermDates,
  getSchoolActivationStatus,
} from '@/lib/core/schoolActivation'

const SYNTHETIC_MARKER = 'SYNTHETIC_9B_ACTIVATION_TEST'
const db = createServiceClient()

let creatorUserId: string
let schoolId: string

before(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: `sprint9b-activation-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  creatorUserId = data.user.id
})

after(async () => {
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (creatorUserId) await db.auth.admin.deleteUser(creatorUserId)
})

async function freshSchool(schoolType: string = 'secondary'): Promise<string> {
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}`, school_type: schoolType as never }, creatorUserId)
  return school.id
}

// ── Pure functions — no database required ───────────────────────────────────

test('resolveDefaultGrades: filters the global catalogue by school_type default (secondary → senior only; junior belongs to primary)', () => {
  // A Kenyan "Primary School" and its Junior School (Grades 7-9) are almost
  // always one institution — 'primary' below includes junior_secondary,
  // 'secondary' means a standalone Senior School (Grade 10-12).
  const grades = [
    { id: '1', name: 'Grade 6',  code: 'G6',  level_order: 8,  category: 'upper_primary' as const,     created_at: '', updated_at: '' },
    { id: '2', name: 'Grade 7',  code: 'G7',  level_order: 9,  category: 'junior_secondary' as const,  created_at: '', updated_at: '' },
    { id: '3', name: 'Grade 10', code: 'G10', level_order: 12, category: 'senior_secondary' as const,  created_at: '', updated_at: '' },
  ]
  const resolved = resolveDefaultGrades(grades, 'secondary')
  assert.deepEqual(resolved.map(g => g.code), ['G10'])

  const primaryResolved = resolveDefaultGrades(grades, 'primary')
  assert.deepEqual(primaryResolved.map(g => g.code), ['G6', 'G7'])
})

test('resolveDefaultGrades: an explicit gradeCodes override wins over the school_type default', () => {
  const grades = [
    { id: '1', name: 'Grade 6', code: 'G6', level_order: 8, category: 'upper_primary' as const, created_at: '', updated_at: '' },
    { id: '2', name: 'Grade 7', code: 'G7', level_order: 9, category: 'junior_secondary' as const, created_at: '', updated_at: '' },
  ]
  const resolved = resolveDefaultGrades(grades, 'secondary', ['G6'])
  assert.deepEqual(resolved.map(g => g.code), ['G6'])
})

test('resolveDefaultGrades: throws for an unrecognized school_type with no override, instead of guessing', () => {
  assert.throws(() => resolveDefaultGrades([], 'special'), /no default grade range known/)
  assert.throws(() => resolveDefaultGrades([], null), /no default grade range known/)
})

test('resolveDefaultGrades: throws on an unknown grade code in the override rather than silently skipping it', () => {
  assert.throws(() => resolveDefaultGrades([], 'secondary', ['NOT_A_GRADE']), /unknown grade code/)
})

test('resolveDefaultTermDates: splits an academic year into 3 non-overlapping terms covering the full range', () => {
  const terms = resolveDefaultTermDates('2026-01-01', '2026-12-31')
  assert.equal(terms.length, 3)
  assert.equal(terms[0].start_date, '2026-01-01')
  assert.equal(terms[2].end_date, '2026-12-31')
  assert.equal(terms.map(t => t.term_number).join(','), '1,2,3')
  // non-overlapping: each term starts the day after the previous ends
  assert.ok(new Date(terms[1].start_date) > new Date(terms[0].end_date))
  assert.ok(new Date(terms[2].start_date) > new Date(terms[1].end_date))
})

// ── Fresh school: each step, in isolation ────────────────────────────────────

test('ensureAcademicYear: creates a year on a fresh school, then reports already_exists on a second call', async () => {
  schoolId = await freshSchool()

  const first = await ensureAcademicYear(schoolId)
  assert.equal(first.result.status, 'created')
  assert.equal(first.academicYear.name, String(new Date().getFullYear()))

  const second = await ensureAcademicYear(schoolId)
  assert.equal(second.result.status, 'already_exists')
  assert.equal(second.academicYear.id, first.academicYear.id)
})

test('ensureDefaultTerms: creates 3 terms, idempotent on rerun', async () => {
  const { academicYear } = await ensureAcademicYear(schoolId)

  const first = await ensureDefaultTerms(schoolId, academicYear)
  assert.equal(first.result.status, 'created')
  assert.equal(first.terms.length, 3)

  const second = await ensureDefaultTerms(schoolId, academicYear)
  assert.equal(second.result.status, 'already_exists')
  assert.equal(second.terms.length, 3)
  assert.deepEqual(second.terms.map(t => t.id).sort(), first.terms.map(t => t.id).sort())
})

test('ensureDefaultGrades: resolves grades without writing any row', async () => {
  const { result, grades } = await ensureDefaultGrades('secondary')
  assert.equal(result.status, 'skipped')
  assert.ok(grades.length > 0)
  // 'secondary' = standalone Senior School only — junior_secondary now
  // belongs to 'primary' (see resolveDefaultGrades test above).
  assert.ok(grades.every(g => g.category === 'senior_secondary'))
})

test('ensureStreams: skips cleanly when none requested; creates + is idempotent when requested', async () => {
  const none = await ensureStreams(schoolId, undefined)
  assert.equal(none.result.status, 'skipped')
  assert.equal(none.streams.length, 0)

  const first = await ensureStreams(schoolId, ['East', 'West'])
  assert.equal(first.result.status, 'created')
  assert.equal(first.streams.length, 2)

  const second = await ensureStreams(schoolId, ['East', 'West'])
  assert.equal(second.result.status, 'already_exists')
  assert.deepEqual(second.streams.map(s => s.id).sort(), first.streams.map(s => s.id).sort())
})

test('ensureClasses: one class per grade×stream, idempotent, never duplicates', async () => {
  const { academicYear } = await ensureAcademicYear(schoolId)
  const { grades } = await ensureDefaultGrades('secondary', ['G10'])
  const { streams } = await ensureStreams(schoolId, ['East', 'West'])

  const first = await ensureClasses(schoolId, academicYear, grades, streams)
  assert.equal(first.result.status, 'created')
  assert.equal(first.classes.length, 2) // 1 grade x 2 streams

  const second = await ensureClasses(schoolId, academicYear, grades, streams)
  assert.equal(second.result.status, 'already_exists')
  assert.equal(second.classes.length, 2)
  assert.deepEqual(second.classes.map(c => c.id).sort(), first.classes.map(c => c.id).sort())
})

test('ensureClasses: one class per grade when no streams exist', async () => {
  const freshId = await freshSchool()
  try {
    const { academicYear } = await ensureAcademicYear(freshId)
    const { grades } = await ensureDefaultGrades('secondary', ['G10', 'G11'])
    const { result, classes } = await ensureClasses(freshId, academicYear, grades, [])
    assert.equal(result.status, 'created')
    assert.equal(classes.length, 2)
    assert.ok(classes.every(c => c.stream_id === null))
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('ensureSchoolSettings: creates once with schema defaults, never overwrites on rerun', async () => {
  const first = await ensureSchoolSettings(schoolId)
  assert.equal(first.result.status, 'created')

  // A caller-driven change to prove the second activateSchool()/ensure call
  // does not clobber it (Stage 4: "never overwrite settings").
  const { upsertSchoolSettings } = await import('@/lib/core/school')
  await upsertSchoolSettings(schoolId, { report_footer: 'Custom footer set by admin' })

  const second = await ensureSchoolSettings(schoolId)
  assert.equal(second.result.status, 'already_exists')

  const { getSchoolSettings } = await import('@/lib/core/school')
  const settings = await getSchoolSettings(schoolId)
  assert.equal(settings.report_footer, 'Custom footer set by admin')
})

// ── Full pipeline: fresh, partial, already-activated, repeated ──────────────

test('activateSchool: runs the full pipeline end-to-end on a fresh school', async () => {
  const freshId = await freshSchool('secondary')
  try {
    const result = await activateSchool(freshId, { gradeCodes: ['G7'] })
    assert.equal(result.status, 'complete')
    // Sprint 12 Wave 1 (High 1): a new 'current_term' step, between 'terms'
    // and 'grades', closes the Release Candidate audit's "no school ever
    // ends activation with a current term set" finding.
    // Phase 12 (DR-08): a new 'grade_subjects' step at the end closes the
    // Phase 10 rehearsal's "fresh school has zero subjects until an admin
    // finds a separate button" finding.
    assert.equal(result.steps.length, 8)
    assert.deepEqual(result.steps.map(s => s.step), ['academic_year', 'terms', 'current_term', 'grades', 'streams', 'classes', 'school_settings', 'grade_subjects'])
    assert.ok(result.steps.every(s => s.status !== 'failed'))

    const gradeSubjectsStep = result.steps.find(s => s.step === 'grade_subjects')
    assert.equal(gradeSubjectsStep?.status, 'created')

    const status = await getSchoolActivationStatus(freshId)
    assert.equal(status, 'ACTIVE')

    // The actual fix, verified directly: a fresh school has a real current
    // academic year and current term, not none.
    const { getCurrentTerm } = await import('@/lib/core/school')
    const currentTerm = await getCurrentTerm(freshId)
    assert.ok(currentTerm, 'a freshly-activated school must have a current term set')
    assert.equal(currentTerm!.term_number, 1)
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('activateSchool: a second run against an already-activated school reports already_exists everywhere and creates zero duplicates', async () => {
  const freshId = await freshSchool('secondary')
  try {
    const firstRun = await activateSchool(freshId, { gradeCodes: ['G7'] })
    assert.equal(firstRun.status, 'complete')

    const secondRun = await activateSchool(freshId, { gradeCodes: ['G7'] })
    assert.equal(secondRun.status, 'complete')
    for (const step of secondRun.steps) {
      assert.ok(
        step.status === 'already_exists' || step.status === 'skipped',
        `expected already_exists/skipped for ${step.step}, got ${step.status}`
      )
    }

    const { data: classRows } = await db.from('classes').select('id').eq('school_id', freshId)
    assert.equal(classRows?.length, 1) // still exactly one G7 class, not two
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('activateSchool: a partially-initialized school (year + terms already exist) only creates what is missing', async () => {
  const freshId = await freshSchool('secondary')
  try {
    const { academicYear } = await ensureAcademicYear(freshId)
    await ensureDefaultTerms(freshId, academicYear)

    const result = await activateSchool(freshId, { gradeCodes: ['G7'] })
    assert.equal(result.status, 'complete')

    const yearStep = result.steps.find(s => s.step === 'academic_year')
    const termsStep = result.steps.find(s => s.step === 'terms')
    const classesStep = result.steps.find(s => s.step === 'classes')
    assert.equal(yearStep?.status, 'already_exists')
    assert.equal(termsStep?.status, 'already_exists')
    assert.equal(classesStep?.status, 'created')
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('activateSchool: repeated calls are safe to run concurrently-in-sequence without producing duplicates', async () => {
  const freshId = await freshSchool('secondary')
  try {
    await activateSchool(freshId, { gradeCodes: ['G7'] })
    await activateSchool(freshId, { gradeCodes: ['G7'] })
    await activateSchool(freshId, { gradeCodes: ['G7'] })

    const { data: years } = await db.from('academic_years').select('id').eq('school_id', freshId)
    const { data: terms } = await db.from('terms').select('id').eq('school_id', freshId)
    const { data: classRows } = await db.from('classes').select('id').eq('school_id', freshId)
    const { data: settings } = await db.from('school_settings').select('id').eq('school_id', freshId)

    assert.equal(years?.length, 1)
    assert.equal(terms?.length, 3)
    assert.equal(classRows?.length, 1)
    assert.equal(settings?.length, 1)
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('activateSchool: fails at the grades step (unresolvable school_type) and never runs streams/classes/settings', async () => {
  const freshId = await freshSchool('special')
  try {
    const result = await activateSchool(freshId)
    assert.equal(result.status, 'failed')
    assert.equal(result.failedStep, 'grades')
    // academic_year and terms should have completed before the failure
    assert.ok(result.steps.some(s => s.step === 'academic_year' && s.status !== 'failed'))
    assert.ok(result.steps.some(s => s.step === 'terms' && s.status !== 'failed'))
    // streams/classes/school_settings should never have been attempted
    assert.ok(!result.steps.some(s => s.step === 'streams'))
    assert.ok(!result.steps.some(s => s.step === 'classes'))
    assert.ok(!result.steps.some(s => s.step === 'school_settings'))

    // Retry with the missing dependency supplied — proves recovery is
    // "call again," not a rollback, and resumes exactly where it left off.
    const retry = await activateSchool(freshId, { gradeCodes: ['G7'] })
    assert.equal(retry.status, 'complete')
    const yearStep = retry.steps.find(s => s.step === 'academic_year')
    assert.equal(yearStep?.status, 'already_exists') // proves the first (failed) run's year wasn't lost or duplicated
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})

test('activateSchool: fails cleanly for a school_id that does not exist, with zero steps attempted', async () => {
  const result = await activateSchool('00000000-0000-0000-0000-000000000000')
  assert.equal(result.status, 'failed')
  assert.equal(result.steps.length, 0)
  assert.ok(result.error?.includes('not found'))
})

test('getSchoolActivationStatus: CREATED → INITIALIZED → ACTIVE as objects are added', async () => {
  const freshId = await freshSchool('secondary')
  try {
    assert.equal(await getSchoolActivationStatus(freshId), 'CREATED')

    const { academicYear } = await ensureAcademicYear(freshId)
    await ensureDefaultTerms(freshId, academicYear)
    assert.equal(await getSchoolActivationStatus(freshId), 'INITIALIZED')

    const { grades } = await ensureDefaultGrades('secondary', ['G7'])
    await ensureClasses(freshId, academicYear, grades, [])
    assert.equal(await getSchoolActivationStatus(freshId), 'ACTIVE')
  } finally {
    await db.from('schools').delete().eq('id', freshId)
  }
})
