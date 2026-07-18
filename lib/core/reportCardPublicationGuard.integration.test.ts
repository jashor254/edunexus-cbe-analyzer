// lib/core/reportCardPublicationGuard.integration.test.ts
//
// Sprint 5B (docs/engineering/sprint-5a-report-card-lifecycle-audit.md,
// docs/engineering/implementation-log.md): validates the integrity guard
// added to generateReportCards — refuses to regenerate when any report
// card for the requested class/term is already published, all-or-nothing,
// no partial writes — against real, throwaway Supabase data.
//
// ⚠️ Creates real (throwaway) auth user, school, academic year, grade
// lookup, and per-scenario terms/classes/learners/report-card rows — all
// deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/core/reportCardPublicationGuard.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { generateReportCards } from '@/lib/core/report-cards'

const SYNTHETIC_MARKER = 'SYNTHETIC_5B_REPORT_CARD_GUARD_TEST'
const db = createServiceClient()

let authUserId: string
let schoolId: string
let gradeId: string

async function makeTermAndClass(label: string) {
  // terms_school_id_academic_year_id_term_number_key is UNIQUE per
  // (school_id, academic_year_id, term_number) — give each scenario its
  // own academic year so every one can use term_number 1 without colliding.
  const year = await repos.schools.insertAcademicYear(schoolId, {
    name: `${SYNTHETIC_MARKER}-${label}`,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id,
    term_number: 1,
    name: `${SYNTHETIC_MARKER}-${label}`,
    start_date: '2026-01-01',
    end_date: '2026-04-01',
  })
  const cls = await repos.teachers.insertClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: year.id,
    display_name: `${SYNTHETIC_MARKER}-${label}`,
  })
  return { termId: term.id, classId: cls.id }
}

async function makeLearner(label: string) {
  const learner = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-${label}-${Math.random().toString(36).slice(2, 8)}`,
    first_name: SYNTHETIC_MARKER,
    last_name: label,
    guardian: {
      full_name: SYNTHETIC_MARKER,
      phone: '0700000000',
      relationship: 'guardian',
    },
  })
  return learner.id
}

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `sprint5b-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const school = await repos.schools.create({ school_name: SYNTHETIC_MARKER }, authUserId)
  schoolId = school.id
  // Sprint 12B: generateReportCards now calls the Attendance service, which
  // requires an authorized actor — matching what the real /api/core/reports
  // route already requires (requireSchoolAdmin) before calling it.
  await repos.schools.addSchoolUser(schoolId, authUserId, 'school_admin')

  const grades = await repos.teachers.findGrades()
  if (!grades.length) throw new Error('no grades reference data found — cannot run this test')
  gradeId = grades[0].id
})

after(async () => {
  // classes/terms/learners/school_report_cards all cascade or are cleaned
  // via the school delete below, except classes/terms which reference
  // schools with no ON DELETE CASCADE in every migration variant — delete
  // explicitly to be safe.
  await db.from('school_report_cards').delete().eq('school_id', schoolId)
  await db.from('classes').delete().eq('school_id', schoolId)
  await db.from('terms').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('academic_years').delete().eq('school_id', schoolId)
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('ALLOWED: first generation (no existing report cards for this class/term)', async () => {
  const { termId, classId } = await makeTermAndClass('first-gen')
  // No school_report_cards rows exist yet for this class/term — the guard
  // must not refuse. (No enrollments/assessments exist either, so this
  // exercises the guard's own decision, independent of whether any rows
  // actually get generated downstream.)
  await assert.doesNotReject(generateReportCards(authUserId, schoolId, classId, termId, {}))
})

test('ALLOWED: regenerating a class where every existing report card is still draft', async () => {
  const { termId, classId } = await makeTermAndClass('draft-regen')
  const learnerId = await makeLearner('Draft')
  await repos.schools.upsertReportCards([{
    school_id: schoolId,
    learner_id: learnerId,
    term_id: termId,
    class_id: classId,
    overall_score: 55,
    overall_cbc_level: 'ME',
    position_in_class: 1,
    total_learners: 1,
    is_published: false,
    generated_at: new Date().toISOString(),
  }])

  await assert.doesNotReject(generateReportCards(authUserId, schoolId, classId, termId, {}))
})

test('REFUSED: regenerating a class with an already-published report card', async () => {
  const { termId, classId } = await makeTermAndClass('published-regen')
  const learnerId = await makeLearner('Published')
  await repos.schools.upsertReportCards([{
    school_id: schoolId,
    learner_id: learnerId,
    term_id: termId,
    class_id: classId,
    overall_score: 90,
    overall_cbc_level: 'EE',
    position_in_class: 1,
    total_learners: 1,
    is_published: true,
    generated_at: new Date().toISOString(),
  }])

  await assert.rejects(
    generateReportCards(authUserId, schoolId, classId, termId, {}),
    /already published/i
  )
})

test('REFUSED, ALL-OR-NOTHING: a mixed class (one published, one draft) is refused in full, not partially regenerated', async () => {
  const { termId, classId } = await makeTermAndClass('mixed')
  const publishedLearnerId = await makeLearner('MixedPublished')
  const draftLearnerId = await makeLearner('MixedDraft')
  await repos.schools.upsertReportCards([
    {
      school_id: schoolId,
      learner_id: publishedLearnerId,
      term_id: termId,
      class_id: classId,
      overall_score: 88,
      overall_cbc_level: 'EE',
      position_in_class: 1,
      total_learners: 2,
      is_published: true,
      generated_at: new Date().toISOString(),
    },
    {
      school_id: schoolId,
      learner_id: draftLearnerId,
      term_id: termId,
      class_id: classId,
      overall_score: 40,
      overall_cbc_level: 'AE',
      position_in_class: 2,
      total_learners: 2,
      is_published: false,
      generated_at: new Date().toISOString(),
    },
  ])

  await assert.rejects(generateReportCards(authUserId, schoolId, classId, termId, {}), /already published/i)

  // No partial write: BOTH rows — including the draft one — must be
  // byte-for-byte unchanged, not just the published one.
  const rows = await repos.schools.listClassReportCards(classId, termId)
  const published = rows.find((r) => r.learner_id === publishedLearnerId)
  const draft = rows.find((r) => r.learner_id === draftLearnerId)
  assert.equal(published?.overall_score, 88)
  assert.equal(published?.overall_cbc_level, 'EE')
  assert.equal(published?.is_published, true)
  assert.equal(draft?.overall_score, 40)
  assert.equal(draft?.overall_cbc_level, 'AE')
  assert.equal(draft?.is_published, false)
})

test('PUBLICATION STATE PRESERVED: a refused regeneration never resets is_published back to false', async () => {
  const { termId, classId } = await makeTermAndClass('state-preserved')
  const learnerId = await makeLearner('StatePreserved')
  const publishedAt = new Date().toISOString()
  await repos.schools.upsertReportCards([{
    school_id: schoolId,
    learner_id: learnerId,
    term_id: termId,
    class_id: classId,
    overall_score: 72,
    overall_cbc_level: 'ME',
    position_in_class: 1,
    total_learners: 1,
    is_published: true,
    generated_at: publishedAt,
  }])

  await assert.rejects(generateReportCards(authUserId, schoolId, classId, termId, {}))

  const rows = await repos.schools.listClassReportCards(classId, termId)
  const row = rows.find((r) => r.learner_id === learnerId)
  assert.equal(row?.is_published, true)
  assert.equal(row?.overall_score, 72)
  assert.equal(row?.overall_cbc_level, 'ME')
})
