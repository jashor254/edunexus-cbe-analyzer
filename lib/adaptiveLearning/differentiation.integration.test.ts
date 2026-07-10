// lib/adaptiveLearning/differentiation.integration.test.ts
//
// Wave 4 validation (Adaptive Learning v2 Implementation Plan): a real
// class of learners spanning the group taxonomy, generated as a draft,
// then approved — proving the teacher-approval gate blocks nothing from
// being visible until approved, that adjustments survive approval instead
// of being silently reverted, and that neutral labels never leak the
// internal group taxonomy. Follows the same synthetic-marker/before-after
// pattern as the other Adaptive Learning v2 integration tests.
//
// ⚠️ Creates one real (throwaway) auth.users account, a teacher, a class,
// and enrolled students — all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/adaptiveLearning/differentiation.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { runCsvIngestion } from '@/lib/intelligence/runCsvIngestion'
import { generateClassDifferentiation, getClassDifferentiation, approveClassDifferentiation, renderNeutralGroups } from './differentiation'
import type { ClassGroups } from './recommend'

const SYNTHETIC_MARKER = 'SYNTHETIC_DIFFERENTIATION_TEST'
const db = createServiceClient()
const SUBJECT = 'mathematics'
const TERM = 2
const YEAR = 2026

let authUserId: string
let teacherId: string
let classId: string
let studentIds: string[] = []

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `differentiation-test-${Date.now()}@example.com`,
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

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, class_code: `SYN-${Date.now()}`, grade: 8, subject: SUBJECT })
    .select('id').single()
  if (clsErr) throw clsErr
  classId = cls.id

  const names = ['Critical Learner', 'Gap Learner', 'On Track Learner']
  const scores = [15, 40, 95] // → cbc_level 1 (critical, with a declining flag below), 2, 4

  for (const name of names) {
    const { data: s, error } = await db
      .from('students')
      .insert({ teacher_id: teacherId, name, grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
      .select('id').single()
    if (error) throw error
    studentIds.push(s.id)
  }

  await db.from('class_students').insert(studentIds.map(student_id => ({ class_id: classId, student_id })))

  // Term 1: establish a declining trend for the "critical" learner so their
  // risk flag reaches 'critical' severity (level 1 + declining), matching
  // classifyGroup's rule in recommend.ts.
  await runCsvIngestion({
    fileContents: ['name,Mathematics', `${names[0]},35`].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: YEAR, term: 1, assessmentType: 'cat',
  })

  for (let i = 0; i < names.length; i++) {
    await runCsvIngestion({
      fileContents: ['name,Mathematics', `${names[i]},${scores[i]}`].join('\n'),
      teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
      academicYear: YEAR, term: TERM, assessmentType: 'cat',
    })
  }
})

after(async () => {
  await db.from('class_differentiation_plans').delete().eq('class_id', classId)
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
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().in('id', studentIds)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(authUserId)
  console.log('[cleanup] synthetic differentiation fixtures removed')
})

test('generateClassDifferentiation persists a draft, unpublished, correctly grouped', async () => {
  const plan = await generateClassDifferentiation({ classId, teacherId, subject: SUBJECT, term: TERM, year: YEAR })

  assert.equal(plan.isPublished, false)
  assert.ok(plan.id)
  assert.equal(plan.groups.critical_gap.length, 1, JSON.stringify(plan.groups.critical_gap))
  assert.equal(plan.groups.prerequisite_gap.length, 1)
  assert.equal(plan.groups.on_track.length, 1)
  assert.equal(plan.groups.concept_confusion.length, 0)
})

test('an unapproved draft is queryable but marked unpublished', async () => {
  const plan = await getClassDifferentiation({ classId, subject: SUBJECT, term: TERM, year: YEAR })
  assert.ok(plan)
  assert.equal(plan!.isPublished, false)
})

test('approveClassDifferentiation persists a teacher adjustment, not the original AI proposal', async () => {
  const before1 = await getClassDifferentiation({ classId, subject: SUBJECT, term: TERM, year: YEAR })
  assert.ok(before1)

  const adjusted: ClassGroups = {
    ...before1!.groups,
    on_track: [
      { ...before1!.groups.on_track[0], action: 'TEACHER-ADJUSTED ACTION TEXT' },
    ],
  }

  const published = await approveClassDifferentiation({
    classId, teacherId, subject: SUBJECT, term: TERM, year: YEAR, adjustedGroups: adjusted,
  })
  assert.equal(published, 1)

  const after1 = await getClassDifferentiation({ classId, subject: SUBJECT, term: TERM, year: YEAR })
  assert.equal(after1!.isPublished, true)
  assert.ok(after1!.publishedAt)
  assert.equal(after1!.groups.on_track[0].action, 'TEACHER-ADJUSTED ACTION TEXT')
})

test('a teacher cannot approve another teacher\'s class differentiation plan', async () => {
  const published = await approveClassDifferentiation({
    classId, teacherId: '00000000-0000-0000-0000-000000000000', subject: SUBJECT, term: TERM, year: YEAR,
  })
  assert.equal(published, 0)
})

test('renderNeutralGroups never leaks the internal group taxonomy', async () => {
  const plan = await getClassDifferentiation({ classId, subject: SUBJECT, term: TERM, year: YEAR })
  const rendered = renderNeutralGroups(plan!.groups)
  const internalNames = ['critical_gap', 'prerequisite_gap', 'concept_confusion', 'on_track', 'insufficient_data']
  for (const r of rendered) {
    for (const name of internalNames) {
      assert.ok(!r.label.includes(name), `rendered label "${r.label}" leaked internal name "${name}"`)
    }
  }
  assert.ok(rendered.length > 0)
})
