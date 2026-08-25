// lib/core/reportCardSubjectSnapshot.integration.test.ts
//
// Parent Portal Phase P5.5 (docs/architecture/
// parent-portal-p5-5-report-card-snapshot-integrity.md, building on P5's
// own finding, docs/architecture/parent-portal-p5-academic-result-authority.md
// §4/§14A): Report Card's overall fields (`overall_score`/`overall_cbc_level`/
// `position_in_class`) are computed once at generation and never
// recomputed on view — a real, enforced immutable snapshot. But its
// per-subject breakdown was read live from `term_subject_summaries`, a
// single shared row per (learner_id, term_id, subject_id) with no history
// — a later teacher assessment publish for the same term silently changed
// what a parent saw under an already-"Published" report card, with the
// overall headline staying frozen. This proves the fix: `publishReportCards`
// now freezes each learner's then-current subject state into a new
// `school_report_cards.subject_snapshot` column, and
// `findReportCardWithSubjects`/`getReportCard` read that frozen snapshot
// for any published card that has one, instead of the live join.
//
// Directly upserts `term_subject_summaries` to simulate "a later teacher
// assessment publish" rather than building the full legacy
// class_assessments/learner_marks/computeTermSummaries bridge pipeline —
// this is honest, not a shortcut: computeTermSummaries's own net effect on
// this table (lib/core/assessments.ts:282, `upsertTermSubjectSummaries`) IS
// exactly an upsert of weighted_score/cbc_level for a (learner_id, term_id,
// subject_id) key. Performing that same upsert directly exercises the real
// boundary this fix guards (term_subject_summaries mutating out from under
// an already-published report card) without needing an unrelated legacy
// bridge fixture.
//
// Run: npx tsx --env-file=.env.local --test lib/core/reportCardSubjectSnapshot.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { generateReportCards, publishReportCards, getReportCard } from '@/lib/core/report-cards'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_P55_REPORT_CARD_SNAPSHOT_TEST'
const db = createServiceClient()

let authUserId: string
let schoolId: string
let gradeId: string
let mathSubjectId: string
let englishSubjectId: string
let term1Id: string
let term2Id: string
let classId: string
let learnerId: string
let academicYearId: string

before(async () => {
  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `p55-report-card-snapshot-${Date.now()}@example.com`,
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

  const subjects = await repos.teachers.listSubjects()
  if (subjects.length < 2) throw new Error('need at least 2 subjects reference data to run this test')
  mathSubjectId = subjects[0].id
  englishSubjectId = subjects[1].id

  const year = await repos.schools.insertAcademicYear(schoolId, {
    name: SYNTHETIC_MARKER, start_date: '2026-01-01', end_date: '2026-12-31',
  })
  academicYearId = year.id
  const term1 = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id, term_number: 1, name: `${SYNTHETIC_MARKER}-T1`, start_date: '2026-01-01', end_date: '2026-04-01',
  })
  term1Id = term1.id
  const term2 = await repos.schools.insertTerm(schoolId, {
    academic_year_id: year.id, term_number: 2, name: `${SYNTHETIC_MARKER}-T2`, start_date: '2026-05-01', end_date: '2026-08-01',
  })
  term2Id = term2.id

  const cls = await repos.teachers.insertClass(schoolId, {
    grade_id: gradeId, academic_year_id: year.id, display_name: SYNTHETIC_MARKER,
  })
  classId = cls.id

  const learner = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-LEARNER`, first_name: SYNTHETIC_MARKER, last_name: 'Learner',
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000001', relationship: 'guardian' },
  })
  learnerId = learner.id

  await repos.learners.upsertEnrollment({
    school_id: schoolId, learner_id: learnerId, class_id: classId, term_id: term1Id, academic_year_id: academicYearId,
  })

  // "Before" state — the values Report Card should freeze at publish time.
  const { error: summariesErr } = await db.from('term_subject_summaries').insert([
    { school_id: schoolId, learner_id: learnerId, term_id: term1Id, class_id: classId, subject_id: mathSubjectId, weighted_score: 60, cbc_level: 'ME' },
    { school_id: schoolId, learner_id: learnerId, term_id: term1Id, class_id: classId, subject_id: englishSubjectId, weighted_score: 85, cbc_level: 'EE' },
  ])
  if (summariesErr) throw summariesErr
})

after(async () => {
  // blueprint_snapshots cascades via learner_id/school_id ON DELETE CASCADE
  // (same as lib/learnerBlueprint/snapshot.test.ts's own teardown comment) —
  // deleted implicitly by the schools/learners deletes below, not explicitly
  // here. publishReportCards (via publishEvent) also writes platform_events
  // keyed on actor_id=authUserId — cleaned up explicitly, same precedent
  // lib/learnerBlueprint/snapshot.test.ts's after() already established, so
  // this file doesn't reintroduce a residual this repo already knows how to
  // avoid.
  await db.from('term_subject_summaries').delete().eq('school_id', schoolId)
  await db.from('school_report_cards').delete().eq('school_id', schoolId)
  await db.from('learner_enrollments').delete().eq('school_id', schoolId)
  await db.from('classes').delete().eq('school_id', schoolId)
  await db.from('terms').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('academic_years').delete().eq('school_id', schoolId)
  if (schoolId) await db.from('schools').delete().eq('id', schoolId)
  if (authUserId) {
    await db.from('platform_events').delete().eq('actor_id', authUserId)
    await db.from('notification_log').delete().eq('user_id', authUserId)
    await db.from('ingestion_runs').delete().eq('initiated_by', authUserId)
    await db.from('profiles').delete().eq('id', authUserId)
    await deleteAuthUserOrThrow(db, authUserId)
  }
})

test('DRAFT: an unpublished report card still reads term_subject_summaries live (unchanged existing behaviour)', async () => {
  await generateReportCards(authUserId, schoolId, classId, term1Id, {})
  const report = await getReportCard(learnerId, term1Id, schoolId)
  assert.ok(report, 'expected a draft report card')
  assert.equal(report!.is_published, false)
  assert.equal(report!.subject_snapshot, null, 'a draft card must not carry a subject_snapshot yet')
  const bySubject = new Map(report!.term_subject_summaries.map(s => [s.subject_id, s]))
  assert.equal(bySubject.get(mathSubjectId)?.cbc_level, 'ME')
  assert.equal(bySubject.get(englishSubjectId)?.cbc_level, 'EE')
})

test('PUBLISH: freezes the current subject state into subject_snapshot on the same row as is_published', async () => {
  const { published } = await publishReportCards(authUserId, schoolId, term1Id, classId)
  assert.equal(published, 1)

  const { data: row, error } = await db
    .from('school_report_cards')
    .select('is_published, published_at, subject_snapshot')
    .eq('school_id', schoolId).eq('learner_id', learnerId).eq('term_id', term1Id)
    .single()
  if (error) throw error
  assert.equal(row!.is_published, true)
  assert.ok(row!.published_at, 'published_at must be set in the same write as subject_snapshot')
  assert.ok(Array.isArray(row!.subject_snapshot), 'subject_snapshot must be populated by the same publish that flips is_published')
  assert.equal(row!.subject_snapshot.length, 2)
})

test('CORE ACCEPTANCE FIXTURE: a later assessment mutating term_subject_summaries does NOT change the already-published report card', async () => {
  const before = await getReportCard(learnerId, term1Id, schoolId)
  const beforeBySubject = new Map(before!.term_subject_summaries.map(s => [s.subject_id, s]))
  assert.equal(beforeBySubject.get(mathSubjectId)?.cbc_level, 'ME')
  assert.equal(beforeBySubject.get(englishSubjectId)?.cbc_level, 'EE')

  // Simulate a later teacher assessment publish for the SAME term — exactly
  // what computeTermSummaries's own upsertTermSubjectSummaries does
  // (lib/core/assessments.ts:282), a real decline this time (mirrors the
  // mission's own fixture: Math and English both drop after the original
  // publish).
  const { error: mutateErr } = await db.from('term_subject_summaries')
    .update({ weighted_score: 20, cbc_level: 'BE', computed_at: new Date().toISOString() })
    .eq('school_id', schoolId).eq('learner_id', learnerId).eq('term_id', term1Id).eq('subject_id', mathSubjectId)
  if (mutateErr) throw mutateErr
  const { error: mutateErr2 } = await db.from('term_subject_summaries')
    .update({ weighted_score: 40, cbc_level: 'AE', computed_at: new Date().toISOString() })
    .eq('school_id', schoolId).eq('learner_id', learnerId).eq('term_id', term1Id).eq('subject_id', englishSubjectId)
  if (mutateErr2) throw mutateErr2

  // Sanity: the raw table itself DID change (this is the live, mutable
  // substrate every OTHER consumer — Gradebook's own item-level view,
  // getClassPerformanceSummary — legitimately still reads).
  const { data: rawAfter } = await db.from('term_subject_summaries')
    .select('subject_id, cbc_level, weighted_score')
    .eq('school_id', schoolId).eq('learner_id', learnerId).eq('term_id', term1Id)
  const rawBySubject = new Map((rawAfter ?? []).map(r => [r.subject_id, r]))
  assert.equal(rawBySubject.get(mathSubjectId)?.cbc_level, 'BE')
  assert.equal(rawBySubject.get(englishSubjectId)?.cbc_level, 'AE')

  // THE PROOF: re-reading the SAME already-published report card must be
  // byte-for-byte unchanged from before the mutation — old headline AND old
  // subject breakdown, both frozen at publication time.
  const after = await getReportCard(learnerId, term1Id, schoolId)
  assert.ok(after)
  assert.equal(after!.is_published, true)
  assert.equal(after!.overall_score, before!.overall_score, 'overall score was already frozen pre-P5.5 — must remain so')
  assert.equal(after!.overall_cbc_level, before!.overall_cbc_level)
  const afterBySubject = new Map(after!.term_subject_summaries.map(s => [s.subject_id, s]))
  assert.equal(afterBySubject.get(mathSubjectId)?.cbc_level, 'ME', 'Math must still read the frozen ME, not the newly-drifted BE')
  assert.equal(afterBySubject.get(mathSubjectId)?.weighted_score, 60)
  assert.equal(afterBySubject.get(englishSubjectId)?.cbc_level, 'EE', 'English must still read the frozen EE, not the newly-drifted AE')
  assert.equal(afterBySubject.get(englishSubjectId)?.weighted_score, 85)
})

test('NEW-REPORT-AFTER FIXTURE: a later term\'s report card correctly reflects the newer subject results, independent of the old frozen card', async () => {
  // No lifecycle exists in this codebase to "republish" the SAME
  // (learner_id, term_id) report card (school_report_cards has a UNIQUE
  // (learner_id, term_id) constraint, and generateReportCards refuses to
  // regenerate once published — see reportCardPublicationGuard.integration.test.ts).
  // The real, existing mechanism for "a new later report" is the next
  // term's own report card — proven here.
  await repos.learners.upsertEnrollment({
    school_id: schoolId, learner_id: learnerId, class_id: classId, term_id: term2Id, academic_year_id: academicYearId,
  })
  const { error: t2Err } = await db.from('term_subject_summaries').insert([
    { school_id: schoolId, learner_id: learnerId, term_id: term2Id, class_id: classId, subject_id: mathSubjectId, weighted_score: 20, cbc_level: 'BE' },
    { school_id: schoolId, learner_id: learnerId, term_id: term2Id, class_id: classId, subject_id: englishSubjectId, weighted_score: 40, cbc_level: 'AE' },
  ])
  if (t2Err) throw t2Err

  await generateReportCards(authUserId, schoolId, classId, term2Id, {})
  await publishReportCards(authUserId, schoolId, term2Id, classId)

  const term2Report = await getReportCard(learnerId, term2Id, schoolId)
  assert.ok(term2Report)
  const t2BySubject = new Map(term2Report!.term_subject_summaries.map(s => [s.subject_id, s]))
  assert.equal(t2BySubject.get(mathSubjectId)?.cbc_level, 'BE')
  assert.equal(t2BySubject.get(englishSubjectId)?.cbc_level, 'AE')

  // The OLD term's card is completely unaffected by the new term's publish —
  // independently stable from each other (Architecture Guard F).
  const term1Report = await getReportCard(learnerId, term1Id, schoolId)
  const t1BySubject = new Map(term1Report!.term_subject_summaries.map(s => [s.subject_id, s]))
  assert.equal(t1BySubject.get(mathSubjectId)?.cbc_level, 'ME')
  assert.equal(t1BySubject.get(englishSubjectId)?.cbc_level, 'EE')
})

test('LEGACY FALLBACK: a published card with no subject_snapshot (pre-P5.5 row) still falls back to the live join, not an error', async () => {
  // Simulates a report card that was published before this migration
  // shipped — school_report_cards rows written that way genuinely exist and
  // cannot be retroactively repaired (no prior snapshot was ever captured).
  const legacyLearner = await repos.learners.insert(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-LEGACY`, first_name: SYNTHETIC_MARKER, last_name: 'LegacyPublished',
    guardian: { full_name: SYNTHETIC_MARKER, phone: '0700000002', relationship: 'guardian' },
  })
  await repos.schools.upsertReportCards([{
    school_id: schoolId, learner_id: legacyLearner.id, term_id: term1Id, class_id: classId,
    overall_score: 50, overall_cbc_level: 'AE', position_in_class: 2, total_learners: 2,
    is_published: true, generated_at: new Date().toISOString(),
  }])
  await db.from('term_subject_summaries').insert({
    school_id: schoolId, learner_id: legacyLearner.id, term_id: term1Id, class_id: classId,
    subject_id: mathSubjectId, weighted_score: 55, cbc_level: 'AE',
  })

  const report = await getReportCard(legacyLearner.id, term1Id, schoolId)
  assert.ok(report)
  assert.equal(report!.is_published, true)
  assert.equal(report!.subject_snapshot, null)
  assert.equal(report!.term_subject_summaries.length, 1)
  assert.equal(report!.term_subject_summaries[0].cbc_level, 'AE')

  await db.from('term_subject_summaries').delete().eq('learner_id', legacyLearner.id)
  await db.from('school_report_cards').delete().eq('learner_id', legacyLearner.id)
  await db.from('learners').delete().eq('id', legacyLearner.id)
})
