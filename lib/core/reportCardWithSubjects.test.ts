// lib/core/reportCardWithSubjects.test.ts
//
// TD-014 (docs/engineering/implementation-log.md): regression coverage for
// SchoolRepository::findReportCardWithSubjects. Prior to this fix, the
// method's single `.select()` tried to embed `term_subject_summaries`
// inside `school_report_cards` — tables with no FK relationship between
// them — which Postgres/PostgREST rejects with PGRST200 on every call.
// The missing `error` check swallowed that failure, so the endpoint always
// returned null, indistinguishable from "no report card exists". Covered
// here against real, throwaway Supabase data.
//
// Run: npx tsx --env-file=.env.local --test lib/core/reportCardWithSubjects.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { getReportCard } from '@/lib/core/report-cards'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_TD014_REPORT_CARD_TEST'
const db = createServiceClient()

let schoolId: string
let authUserId: string
let termId: string
let classId: string
let subjectAId: string
let subjectBId: string
let publishedLearnerId: string
let draftLearnerId: string
let noSummariesLearnerId: string
let partialSummariesLearnerId: string

before(async () => {
  const grades = await repos.teachers.findGrades()
  if (!grades.length) throw new Error('no grades reference data found — cannot run this test')
  const gradeId = grades[0].id

  const subjects = await repos.teachers.listSubjects()
  if (subjects.length < 2) throw new Error('need at least 2 subjects reference data to run this test')
  subjectAId = subjects[0].id
  subjectBId = subjects[1].id

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `td014-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}` }, authUserId)
  schoolId = school.id

  const year = await repos.schools.insertAcademicYear(schoolId, {
    name: SYNTHETIC_MARKER,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id,
    term_number: 1,
    name: SYNTHETIC_MARKER,
    start_date: '2026-01-01',
    end_date: '2026-04-01',
  })
  termId = term.id

  const cls = await repos.teachers.insertClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: year.id,
    display_name: SYNTHETIC_MARKER,
  })
  classId = cls.id

  async function makeLearner(label: string): Promise<string> {
    const learner = await repos.learners.insert(schoolId, {
      admission_number: `${SYNTHETIC_MARKER}-${label}-${Math.random().toString(36).slice(2, 8)}`,
      first_name: SYNTHETIC_MARKER,
      last_name: label,
      guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000000', relationship: 'guardian' },
    })
    return learner.id
  }

  publishedLearnerId = await makeLearner('Published')
  draftLearnerId = await makeLearner('Draft')
  noSummariesLearnerId = await makeLearner('NoSummaries')
  partialSummariesLearnerId = await makeLearner('PartialSummaries')

  await repos.schools.upsertReportCards([
    {
      school_id: schoolId, learner_id: publishedLearnerId, term_id: termId, class_id: classId,
      overall_score: 85, overall_cbc_level: 'EE', position_in_class: 1, total_learners: 4,
      is_published: true, generated_at: new Date().toISOString(),
    },
    {
      school_id: schoolId, learner_id: draftLearnerId, term_id: termId, class_id: classId,
      overall_score: 45, overall_cbc_level: 'AE', position_in_class: 2, total_learners: 4,
      is_published: false, generated_at: new Date().toISOString(),
    },
    {
      school_id: schoolId, learner_id: noSummariesLearnerId, term_id: termId, class_id: classId,
      overall_score: 60, overall_cbc_level: 'ME', position_in_class: 3, total_learners: 4,
      is_published: true, generated_at: new Date().toISOString(),
    },
    {
      school_id: schoolId, learner_id: partialSummariesLearnerId, term_id: termId, class_id: classId,
      overall_score: 70, overall_cbc_level: 'ME', position_in_class: 4, total_learners: 4,
      is_published: true, generated_at: new Date().toISOString(),
    },
  ])

  const { error: summariesErr } = await db.from('term_subject_summaries').insert([
    {
      school_id: schoolId, learner_id: publishedLearnerId, term_id: termId, class_id: classId,
      subject_id: subjectAId, weighted_score: 88, cbc_level: 'EE', position_in_class: 1,
    },
    {
      school_id: schoolId, learner_id: publishedLearnerId, term_id: termId, class_id: classId,
      subject_id: subjectBId, weighted_score: 82, cbc_level: 'EE', position_in_class: 2,
    },
    // partialSummariesLearnerId gets only one of the two subjects
    {
      school_id: schoolId, learner_id: partialSummariesLearnerId, term_id: termId, class_id: classId,
      subject_id: subjectAId, weighted_score: 70, cbc_level: 'ME', position_in_class: 3,
    },
  ])
  if (summariesErr) throw summariesErr
})

after(async () => {
  await db.from('term_subject_summaries').delete().eq('school_id', schoolId)
  await db.from('school_report_cards').delete().eq('school_id', schoolId)
  await db.from('classes').delete().eq('school_id', schoolId)
  await db.from('terms').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('academic_years').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  await deleteAuthUserOrThrow(db, authUserId)
})

test('single learner, multi-subject: returns the report with both subject summaries attached', async () => {
  const report = await getReportCard(publishedLearnerId, termId, schoolId)
  assert.ok(report, 'expected a report card, got null')
  assert.equal(report!.learner_id, publishedLearnerId)
  assert.equal(report!.term_subject_summaries.length, 2)
  const subjectIds = report!.term_subject_summaries.map(s => s.subject_id).sort()
  assert.deepEqual(subjectIds, [subjectAId, subjectBId].sort())
  assert.ok(report!.term_subject_summaries.every(s => s.subjects?.id))
})

test('published report: is_published true is preserved', async () => {
  const report = await getReportCard(publishedLearnerId, termId, schoolId)
  assert.equal(report!.is_published, true)
})

test('unpublished (draft) report: is still retrievable, unchanged from prior behaviour', async () => {
  const report = await getReportCard(draftLearnerId, termId, schoolId)
  assert.ok(report, 'expected a draft report card, got null')
  assert.equal(report!.is_published, false)
})

test('missing summaries: report card exists but has zero term_subject_summaries — returns empty array, not null', async () => {
  const report = await getReportCard(noSummariesLearnerId, termId, schoolId)
  assert.ok(report, 'expected a report card even with no subject summaries')
  assert.deepEqual(report!.term_subject_summaries, [])
})

test('partial summaries: only some subjects have a summary row — returns exactly those', async () => {
  const report = await getReportCard(partialSummariesLearnerId, termId, schoolId)
  assert.ok(report)
  assert.equal(report!.term_subject_summaries.length, 1)
  assert.equal(report!.term_subject_summaries[0].subject_id, subjectAId)
})

test('missing report: learner has no report_card row for this term — returns null, not an error', async () => {
  const orphanLearnerId = await (async () => {
    const learner = await repos.learners.insert(schoolId, {
      admission_number: `${SYNTHETIC_MARKER}-orphan-${Math.random().toString(36).slice(2, 8)}`,
      first_name: SYNTHETIC_MARKER,
      last_name: 'NoReport',
      guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000000', relationship: 'guardian' },
    })
    return learner.id
  })()
  const report = await getReportCard(orphanLearnerId, termId, schoolId)
  assert.equal(report, null)
  await db.from('learners').delete().eq('id', orphanLearnerId)
})

test('missing learner: a nonexistent learnerId rejects via the SH-001 ownership check, not a raw DB error', async () => {
  await assert.rejects(getReportCard('00000000-0000-0000-0000-000000000000', termId, schoolId))
})
