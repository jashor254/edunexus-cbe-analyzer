// lib/holiday/holidayReturn.integration.test.ts
//
// Wave 5 validation (Adaptive Learning v2 Implementation Plan) — the
// architecture's own highest-risk wave (no live precedent). Proves the
// Evidence Loop actually closes: a Holiday Return produces real Evidence,
// correctly trust-tiered and claim-typed, that evidence is invisible to
// Projection while pending_review ("silence is not consent" — Evidence
// Domain Model §2), and once a teacher confirms it, Projection visibly
// reflects it. Also proves the mastery/engagement split holds: mastery
// never auto-confirms, only a real reviewer transition promotes it.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teacher/student rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/holiday/holidayReturn.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { recordHolidayReturn } from './return'
import { confirmReview } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD, HOLIDAY_MASTERY_EXTRACTION_METHOD } from './evidenceClaimTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_HOLIDAY_RETURN_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let ingestionRunId: string
let evidenceIds: string[] = []

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `holiday-return-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Return Test Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (studentErr) throw studentErr
  studentId = student.id
})

after(async () => {
  await db.from('holiday_returns').delete().eq('student_id', studentId)
  await db.from('learner_projections').delete().eq('learner_id', studentId)

  if (ingestionRunId) {
    const { data: ev } = await db.from('learner_evidence').select('id').eq('ingestion_run_id', ingestionRunId)
    const ids = (ev ?? []).map(e => e.id)
    if (ids.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', ids)
      await db.from('evidence_audit_log').delete().in('evidence_id', ids)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids)
      await db.from('learner_evidence').delete().in('id', ids)
    }
    await db.from('ingestion_runs').delete().eq('id', ingestionRunId)
  }
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic holiday-return fixtures removed')
})

test('recordHolidayReturn produces correctly tiered, claim-typed evidence, all pending_review', async () => {
  const result = await recordHolidayReturn({
    studentId, studentName: 'Return Test Learner', teacherId, initiatedBy: authUserId,
    academicYear: 2026, term: 2, weeksAssigned: 4, weeksCompleted: 3,
    teacherComment: 'Good effort this holiday.',
    masteryClaims: [
      { subject: 'mathematics', cbcLevel: 2 },
      { subject: 'english', cbcLevel: 4 },
    ],
  })

  ingestionRunId = result.ingestionRunId
  assert.ok(result.holidayReturnId)
  // Not configured in this dev environment (COMPASS_AUTO_CONFIRM_USER_ID
  // unset) — the honest, safe default: nothing auto-confirms yet.
  assert.equal(result.confirmedCount, 0)
  assert.equal(result.pendingReviewCount, 3) // 1 engagement + 2 mastery

  const { data: rows } = await db
    .from('learner_evidence')
    .select('id, subject, cbc_level, evidence_source, extraction_method, trust_tier, lifecycle_state')
    .eq('ingestion_run_id', ingestionRunId)
    .order('extraction_method')
  evidenceIds = (rows ?? []).map(r => r.id as string)

  assert.equal(rows!.length, 3)
  for (const row of rows!) {
    assert.equal(row.evidence_source, 'holiday_return')
    assert.equal(row.trust_tier, 2)
    assert.equal(row.lifecycle_state, 'pending_review')
  }

  const engagement = rows!.find(r => r.extraction_method === HOLIDAY_ENGAGEMENT_EXTRACTION_METHOD)
  assert.ok(engagement)
  assert.equal(engagement!.cbc_level, null, 'engagement is a completion fact, never an academic claim')

  const mastery = rows!.filter(r => r.extraction_method === HOLIDAY_MASTERY_EXTRACTION_METHOD)
  assert.equal(mastery.length, 2)
  assert.ok(mastery.every(m => m.cbc_level !== null))
})

test('the holiday_returns tracking row persists weeks completed and the teacher comment', async () => {
  const { data } = await db.from('holiday_returns').select('*').eq('student_id', studentId).single()
  assert.equal(data!.weeks_assigned, 4)
  assert.equal(data!.weeks_completed, 3)
  assert.equal(data!.teacher_comment, 'Good effort this holiday.')
})

test('pending_review evidence is invisible to Projection — silence is not consent', async () => {
  const projection = await recomputeLearnerProjection(studentId)
  assert.equal(projection.academic, null, 'no confirmed evidence yet — academic projection must not exist')
})

test('once a teacher confirms the mastery evidence, Projection reflects it', async () => {
  const { data: mastery } = await db
    .from('learner_evidence')
    .select('id, subject')
    .eq('ingestion_run_id', ingestionRunId)
    .eq('extraction_method', HOLIDAY_MASTERY_EXTRACTION_METHOD)

  for (const row of mastery!) {
    await confirmReview(row.id as string, authUserId, 'Teacher reviewed returned holiday pack.')
  }

  const projection = await recomputeLearnerProjection(studentId)
  assert.ok(projection.academic)
  assert.equal(projection.academic!.value.bySubject.mathematics.latestLevel, 2)
  assert.equal(projection.academic!.value.bySubject.english.latestLevel, 4)
  assert.ok(projection.academic!.supportingEvidenceIds.some(id => mastery!.some(m => m.id === id)))
})
