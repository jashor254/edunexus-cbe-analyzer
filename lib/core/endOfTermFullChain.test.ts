// lib/core/endOfTermFullChain.test.ts
//
// Sprint 10A Commit 2 — "Final Validation": proves the complete, real,
// operational journey the sprint mission asks for —
//   Assessment -> Evidence -> Projection -> Summaries -> Ranking ->
//   Report Cards -> Publication -> Parent view -> Term closed
// — by driving runEndOfTerm() (lib/core/endOfTerm.ts) against real bridged
// fixture data, the same way a school actually would. No new orchestration
// or business logic is exercised here beyond what Commit 1 already fixed —
// this is verification, not a new pipeline.
//
// Also covers Step 4 (failure recovery): re-running End-of-Term after
// publication must fail safely (the existing Sprint 5B all-or-nothing
// publish guard) without corrupting the already-published cards.
//
// Run: npx tsx --env-file=.env.local --test lib/core/endOfTermFullChain.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordBridgedMarks, ensureBridgedClass } from '@/lib/core/academicBridge'
import { publishAssessment, listAssessments } from '@/lib/core/assessments'
import { getReportCard } from '@/lib/core/report-cards'
import { runEndOfTerm } from '@/lib/core/endOfTerm'
import { getCurrentTerm } from '@/lib/core/school'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_10A_EOT_CHAIN_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint10a-eot-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) {
          await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
          await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
        }
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('learner_marks').delete().in('student_id', studentIds)
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    await db.from('school_report_cards').delete().in('school_id', createdSchoolIds)
    await db.from('term_subject_summaries').delete().in('school_id', createdSchoolIds)
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) await db.from('teacher_classes').delete().in('external_id', classExternalIds)
  }
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id)
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

test('Final Validation: the complete End-of-Term journey — assessment through published report, then a safe, non-corrupting re-run', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  assert.equal(activation.status, 'complete')

  const teacher = await mkAuthUser('teacher')
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  assert.equal(invite.status, 'invited')
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: 'EOT Teacher' })
  assert.equal(accept.status, 'accepted')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id, term_number').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  // Two learners, different scores — proves Ranking actually orders them,
  // not just that a report card exists.
  const enrollHigh = await onboardLearner(school.id, {
    admission_number: `eot-high-${Date.now()}`,
    first_name: 'High', last_name: 'Scorer',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'High Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(enrollHigh.status, 'complete')
  const enrollLow = await onboardLearner(school.id, {
    admission_number: `eot-low-${Date.now()}`,
    first_name: 'Low', last_name: 'Scorer',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Low Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(enrollLow.status, 'complete')
  const highLearnerId = enrollHigh.learnerId!
  const lowLearnerId = enrollLow.learnerId!

  // ── Assessment ──────────────────────────────────────────────────────────
  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacher.id, {
    title: 'EOT End Term Exam',
    assessment_type: 'exam',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['SS-MATH'],
    curriculum_type: 'cbc',
  })
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacher.id)

  // Lock check (Step 1's own guard): unpublished assessment must block End-of-Term.
  const preLockResult = await runEndOfTerm({
    actorUserId: admin.id, schoolId: school.id, classId, termId, term: '1', year: 2026,
    nextTerm: { academic_year_id: academicYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01' },
  })
  assert.equal(preLockResult.ok, false)
  if (preLockResult.ok === false) {
    assert.equal(preLockResult.reason, 'unpublished_assessments')
    assert.equal(preLockResult.unpublished.length, 1)
  }

  // ── Evidence + Projection (recordBridgedMarks calls both, unmodified) ────
  await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacher.id, [
    { coreLearnerId: asLearnerId(highLearnerId), admission_number: 'eot-high', student_name: 'High Scorer', subject_scores: { 'SS-MATH': 90 }, total_marks: 90, mean_score: 90 },
    { coreLearnerId: asLearnerId(lowLearnerId), admission_number: 'eot-low', student_name: 'Low Scorer', subject_scores: { 'SS-MATH': 60 }, total_marks: 60, mean_score: 60 },
  ])
  await publishAssessment(assessmentId)

  // Confirms Commit 1's listAssessments fix: the lock check must actually
  // see the (now-published) assessment via the Core classId, not silently
  // see nothing.
  const visibleAssessments = await listAssessments(classId, { term: '1', year: 2026 })
  assert.equal(visibleAssessments.length, 1)
  assert.equal(visibleAssessments[0].is_published, true)

  // ── Summaries -> Ranking -> Report Cards -> Publication, in one call ─────
  const result = await runEndOfTerm({
    actorUserId: admin.id, schoolId: school.id, classId, termId, term: '1', year: 2026,
    nextTerm: { academic_year_id: academicYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01' },
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.reportCardsGenerated, 2)
    assert.equal(result.reportCardsPublished, 2)

    // ── Ranking correctness ──
    const { data: cards } = await db
      .from('school_report_cards')
      .select('learner_id, overall_score, overall_cbc_level, position_in_class, total_learners, is_published')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .order('position_in_class')
    assert.equal(cards?.length, 2)
    assert.equal(cards![0].learner_id, highLearnerId)
    assert.equal(cards![0].position_in_class, 1)
    assert.equal(cards![0].overall_score, 90)
    assert.equal(cards![0].overall_cbc_level, 'EE')
    assert.equal(cards![1].learner_id, lowLearnerId)
    assert.equal(cards![1].position_in_class, 2)
    assert.equal(cards![1].overall_score, 60)
    assert.equal(cards![1].overall_cbc_level, 'ME')
    assert.equal(cards![0].is_published, true)
    assert.equal(cards![1].is_published, true)

    // ── Publication: parent can now see it ──
    const parentView = await getReportCard(highLearnerId, termId, school.id)
    assert.ok(parentView)
    assert.equal(parentView!.is_published, true)
    assert.equal(parentView!.overall_score, 90)

    // ── School closes term: next term created and made current ──
    const currentTerm = await getCurrentTerm(school.id)
    assert.ok(currentTerm)
    assert.equal(currentTerm!.id, result.nextTermId)
    assert.equal(currentTerm!.term_number, 2)

    const { data: oldTerm } = await db.from('terms').select('is_current').eq('id', termId).single()
    assert.equal(oldTerm?.is_current, false) // setCurrentTerm's clear-first step archived it

    // ── Step 4: re-running End-of-Term must fail safely, not corrupt data ──
    await assert.rejects(
      () => runEndOfTerm({
        actorUserId: admin.id, schoolId: school.id, classId, termId, term: '1', year: 2026,
        nextTerm: { academic_year_id: academicYearId, term_number: 2, name: 'Term 2', start_date: '2026-05-01', end_date: '2026-08-01' },
      }),
      /already published/
    )
    const { data: cardsAfterRerun } = await db
      .from('school_report_cards')
      .select('overall_score, is_published')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .order('overall_score', { ascending: false })
    assert.equal(cardsAfterRerun?.length, 2)
    assert.equal(cardsAfterRerun![0].overall_score, 90) // unchanged, not corrupted
    assert.equal(cardsAfterRerun![0].is_published, true)
    assert.equal(cardsAfterRerun![1].overall_score, 60)
  }
})
