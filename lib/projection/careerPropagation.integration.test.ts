// lib/projection/careerPropagation.integration.test.ts
//
// Career Intelligence Canonicalization Phase 3 — proves the two propagation
// gaps Sprint 31 flagged (students.capability_profile and
// learner_profiles.career_signals going stale after an evidence correction)
// are closed by the existing evidence_projection_events outbox + consumer
// path (lib/intelligence/evidenceLifecycle.ts -> insertProjectionEvents ->
// lib/projection/eventConsumer.ts's processProjectionEvents, which the
// 5-minute GitHub Actions cron already drains in production — see
// app/api/cron/projection-events/process/route.ts). This test calls
// processProjectionEvents() directly instead of waiting for the cron.
//
// capability_profile is genuinely Evidence-derived here (blended with the
// legacy `assessments` table per careerEngine.ts's recomputeAndSaveCapabilityProfile
// doc comment) — retracting evidence measurably changes it. career_signals
// is sourced from the separate legacy `strand_assessments` table
// (lib/repositories/learner-model.repository.ts findLatestStrandAssessment),
// which this fixture never writes to — so this test can only prove
// refreshCareerSignals() actually ran (last_updated advances, no throw),
// not a content diff. That split is real, not a test gap.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/projection/careerPropagation.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { runCsvIngestion } from '@/lib/intelligence/runCsvIngestion'
import { retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { processProjectionEvents } from './eventConsumer'
import { repos } from '@/lib/repositories'

const SYNTHETIC_MARKER = 'SYNTHETIC_CAREER_PROPAGATION_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `career-propagation-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: student, error } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Career Propagation Test Learner', grade: 9, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (error) throw error
  studentId = student.id
})

after(async () => {
  await db.from('learner_projections').delete().eq('learner_id', studentId)

  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId)
  const runIds = (runs ?? []).map(r => r.id)
  if (runIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', runIds)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('ingestion_runs').delete().in('id', runIds)
  }
  await db.from('capability_history').delete().eq('student_id', studentId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(authUserId)
  console.log('[cleanup] synthetic career-propagation fixtures removed')
})

test('an evidence correction propagates through the outbox consumer to students.capability_profile and learner_profiles.career_signals', async () => {
  // Round 1: mathematics + english, term 1.
  const round1 = await runCsvIngestion({
    fileContents: ['name,mathematics,english', 'Career Propagation Test Learner,60,65'].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 1, assessmentType: 'cat',
  })
  await processProjectionEvents(500)

  // Round 2: a second, higher-scoring mathematics+english snapshot, term 2
  // — this is the evidence we'll correct below.
  const round2 = await runCsvIngestion({
    fileContents: ['name,mathematics,english', 'Career Propagation Test Learner,90,88'].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 2, assessmentType: 'cat',
  })
  // One evidence row per subject — retract all of round 2's so its whole
  // term-2 snapshot disappears (retracting only one subject would leave the
  // other subject's evidence still contributing a term-2 snapshot, masking
  // the assessment_count assertion below).
  const round2EvidenceIds = round2.inserted.map(r => r.id)
  await processProjectionEvents(500)

  const baselineProfile = await repos.careers.findStudentCapabilityProfile(studentId)
  assert.ok(baselineProfile, 'expected students.capability_profile to be populated after two rounds of confirmed evidence')
  const baselineAssessmentCount = baselineProfile!.assessment_count

  const baselineLearnerProfile = await repos.learnerModel.getOrCreateLearnerProfile(studentId)
  const baselineSignals = baselineLearnerProfile.career_signals as { last_updated?: string | null }
  assert.ok(baselineSignals?.last_updated, 'expected learner_profiles.career_signals.last_updated to be set after the baseline recompute')

  // The correction: retract all of round 2's evidence (e.g. reported
  // incorrect by the school). This is exactly the kind of correction
  // Sprint 31 found could leave capability_profile / career_signals
  // silently stale.
  for (const evidenceId of round2EvidenceIds) {
    await retractEvidence(evidenceId, authUserId, 'Reported incorrect by school — propagation test')
  }

  const { data: unprocessed } = await db
    .from('evidence_projection_events')
    .select('id')
    .in('evidence_id', round2EvidenceIds)
    .is('processed_at', null)
  assert.ok(unprocessed!.length > 0, 'retracting evidence should enqueue an unprocessed projection event')

  // Drain the outbox directly instead of waiting for the 5-minute cron.
  const consumeResult = await processProjectionEvents(500)
  assert.ok(consumeResult.eventsProcessed > 0)
  assert.ok(consumeResult.learnersRecomputed >= 1)

  const correctedProfile = await repos.careers.findStudentCapabilityProfile(studentId)
  assert.ok(correctedProfile, 'students.capability_profile must still be populated after retraction (round 1 evidence remains)')
  assert.notEqual(
    correctedProfile!.computed_at, baselineProfile!.computed_at,
    'students.capability_profile.computed_at must advance after the correction propagates',
  )
  assert.ok(
    correctedProfile!.assessment_count < baselineAssessmentCount,
    `retracting one of two evidence snapshots should reduce assessment_count (was ${baselineAssessmentCount}, now ${correctedProfile!.assessment_count})`,
  )

  const correctedLearnerProfile = await repos.learnerModel.getOrCreateLearnerProfile(studentId)
  const correctedSignals = correctedLearnerProfile.career_signals as { last_updated?: string | null }
  assert.ok(correctedSignals?.last_updated, 'learner_profiles.career_signals must still be populated after the correction propagates')
  assert.notEqual(
    correctedSignals.last_updated, baselineSignals.last_updated,
    'learner_profiles.career_signals.last_updated must advance after the correction propagates — proves refreshCareerSignals() ran, not just capability_profile',
  )
})
