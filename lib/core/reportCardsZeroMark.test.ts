// lib/core/reportCardsZeroMark.test.ts
//
// Sprint 12 Wave 1 (High 3, Release Blocker Remediation) — verifies the
// fix to generateReportCards() (lib/core/report-cards.ts): a learner with
// zero term_subject_summaries must get overall_score/overall_cbc_level
// null ("no data"), never a fabricated 0/BE. Follows the fixture
// convention established in lib/core/reportCardPublicationGuard.integration.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/reportCardsZeroMark.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { generateReportCards } from '@/lib/core/report-cards'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_S12_ZEROMARK_TEST'
const db = createServiceClient()

let authUserId: string
let schoolId: string
let gradeId: string
let termId: string
let classId: string
let scoredLearnerId: string
let zeroMarkLearnerId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `s12-zeromark-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const school = await repos.schools.create({ school_name: SYNTHETIC_MARKER }, authUserId)
  schoolId = school.id
  await repos.schools.addSchoolUser(schoolId, authUserId, 'school_admin')

  const grades = await repos.teachers.findGrades()
  if (!grades.length) throw new Error('no grades reference data found — cannot run this test')
  gradeId = grades[0].id

  const year = await repos.schools.insertAcademicYear(schoolId, {
    name: SYNTHETIC_MARKER, start_date: '2026-01-01', end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id, term_number: 1, name: SYNTHETIC_MARKER, start_date: '2026-01-01', end_date: '2026-04-01',
  })
  termId = term.id
  const cls = await repos.teachers.insertClass(schoolId, {
    grade_id: gradeId, academic_year_id: year.id, display_name: SYNTHETIC_MARKER,
  })
  classId = cls.id

  const scored = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-SCORED`, first_name: SYNTHETIC_MARKER, last_name: 'Scored',
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000001', relationship: 'guardian' },
  })
  scoredLearnerId = scored.id
  const zero = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-ZERO`, first_name: SYNTHETIC_MARKER, last_name: 'ZeroMark',
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000002', relationship: 'guardian' },
  })
  zeroMarkLearnerId = zero.id

  await repos.learners.upsertEnrollment({
    school_id: schoolId, learner_id: scoredLearnerId, class_id: classId, term_id: termId, academic_year_id: year.id,
  })
  await repos.learners.upsertEnrollment({
    school_id: schoolId, learner_id: zeroMarkLearnerId, class_id: classId, term_id: termId, academic_year_id: year.id,
  })

  // Real summaries for the "scored" learner only — the "zero-mark" learner
  // gets none at all, the exact condition the fix guards against.
  const subject = (await repos.teachers.listSubjects()).at(0)
  if (!subject) throw new Error('no subject reference data found — cannot run this test')
  await db.from('term_subject_summaries').insert({
    school_id: schoolId, learner_id: scoredLearnerId, term_id: termId, class_id: classId, subject_id: subject.id,
    weighted_score: 82, cbc_level: 'EE',
  })
})

after(async () => {
  await db.from('term_subject_summaries').delete().eq('school_id', schoolId)
  await db.from('school_report_cards').delete().eq('school_id', schoolId)
  await db.from('learner_enrollments').delete().eq('school_id', schoolId)
  await db.from('classes').delete().eq('school_id', schoolId)
  await db.from('terms').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('academic_years').delete().eq('school_id', schoolId)
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (authUserId) await deleteAuthUserOrThrow(db, authUserId)
})

test('generateReportCards: a learner with zero term_subject_summaries gets null overall_score/overall_cbc_level, never a fabricated 0/BE', async () => {
  const result = await generateReportCards(authUserId, schoolId, classId, termId, {})
  assert.equal(result.generated, 2)

  const { data: zeroMarkCard } = await db
    .from('school_report_cards')
    .select('overall_score, overall_cbc_level, position_in_class')
    .eq('school_id', schoolId)
    .eq('learner_id', zeroMarkLearnerId)
    .single()
  assert.equal(zeroMarkCard!.overall_score, null, 'a no-data learner must never get a fabricated overall_score')
  assert.equal(zeroMarkCard!.overall_cbc_level, null, 'a no-data learner must never get a fabricated overall_cbc_level (e.g. BE)')
  assert.ok(zeroMarkCard!.position_in_class != null, 'ranking still assigns a position (tied-for-last, per the existing Sprint 3D behavior) — only the stored score/level are nulled, not ranking')
})

test('generateReportCards: a learner who genuinely scored is completely unaffected by the fix', async () => {
  const { data: scoredCard } = await db
    .from('school_report_cards')
    .select('overall_score, overall_cbc_level')
    .eq('school_id', schoolId)
    .eq('learner_id', scoredLearnerId)
    .single()
  assert.equal(scoredCard!.overall_score, 82)
  assert.equal(scoredCard!.overall_cbc_level, 'EE')
})
