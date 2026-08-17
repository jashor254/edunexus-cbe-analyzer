// lib/holiday/holidayPlanner.integration.test.ts
//
// Wave 2 validation (Adaptive Learning v2 Implementation Plan): proves
// generateHolidayPlan() is genuinely Projection-sourced after the re-point
// per docs/architecture/adaptive-learning-v2-architecture.md §4 — real
// confirmed Evidence in, a correct plan out, no `learner_profiles` read
// anywhere in the path. Follows the same synthetic-marker/before-after
// pattern as evidenceDomain.integration.test.ts and
// projectionPersistence.integration.test.ts.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/holiday/holidayPlanner.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { runCsvIngestion } from '@/lib/intelligence/runCsvIngestion'
import { generateHolidayPlan } from './planner'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_HOLIDAY_PLANNER_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let weakStudentId: string
let strongStudentId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `holiday-planner-test-${Date.now()}@example.com`,
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

  const { data: weak, error: weakErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Weak Subject Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (weakErr) throw weakErr
  weakStudentId = weak.id

  const { data: strong, error: strongErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Strong Subject Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (strongErr) throw strongErr
  strongStudentId = strong.id

  // Weak learner: Mathematics well Below Expectation (raw 20 → cbc_level 1).
  await runCsvIngestion({
    fileContents: ['name,Mathematics', 'Weak Subject Learner,20'].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 2, assessmentType: 'cat',
  })

  // Strong learner: Mathematics Exceeding Expectation (raw 95 → cbc_level 4).
  await runCsvIngestion({
    fileContents: ['name,Mathematics', 'Strong Subject Learner,95'].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 2, assessmentType: 'cat',
  })
})

after(async () => {
  const studentIds = [weakStudentId, strongStudentId]
  await db.from('holiday_plans').delete().in('student_id', studentIds)
  await db.from('learner_projections').delete().in('learner_id', studentIds)

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
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic holiday-planner fixtures removed')
})

test('generateHolidayPlan surfaces a weak subject as a priority gap, sourced from Projection', async () => {
  const plan = await generateHolidayPlan({
    studentId: weakStudentId, teacherId, term: 2, year: 2026,
    holidayPeriod: 'August Holiday 2026', holidayDays: 14,
  })

  assert.equal(plan.student_name, 'Weak Subject Learner')
  assert.ok(plan.priority_gaps.includes('mathematics'), `expected mathematics in priority_gaps, got: ${JSON.stringify(plan.priority_gaps)}`)
  assert.ok(plan.weeks.length > 0)
  assert.ok(plan.weeks.some(w => w.compass_topics.includes('mathematics')))
  assert.ok(plan.whatsapp_message.length > 0)
  assert.ok(plan.parent_summary.length > 0)
})

test('generateHolidayPlan does not surface a strong subject as a priority gap', async () => {
  const plan = await generateHolidayPlan({
    studentId: strongStudentId, teacherId, term: 2, year: 2026,
    holidayPeriod: 'August Holiday 2026', holidayDays: 14,
  })

  assert.equal(plan.student_name, 'Strong Subject Learner')
  assert.ok(!plan.priority_gaps.includes('mathematics'), `mathematics should not be a gap for a Level-4 learner, got: ${JSON.stringify(plan.priority_gaps)}`)
})

test('generateHolidayPlan degrades gracefully for a learner with zero evidence (no crash, no fabricated gap)', async () => {
  const { data: emptyStudent, error } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'No Evidence Learner', grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id').single()
  if (error) throw error

  try {
    const plan = await generateHolidayPlan({
      studentId: emptyStudent.id, teacherId, term: 2, year: 2026,
      holidayPeriod: 'August Holiday 2026', holidayDays: 14,
    })
    assert.deepEqual(plan.priority_gaps, [])
    assert.ok(plan.weeks.length > 0, 'a learner with no evidence still gets a plan (rest/explore weeks)')
  } finally {
    await db.from('holiday_plans').delete().eq('student_id', emptyStudent.id)
    await db.from('students').delete().eq('id', emptyStudent.id)
  }
})
