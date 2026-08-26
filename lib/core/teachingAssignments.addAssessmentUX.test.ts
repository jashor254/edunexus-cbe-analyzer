// lib/core/teachingAssignments.addAssessmentUX.test.ts
//
// Phase 3B — proves the exact mechanism `app/teacher/assessments/new/page.tsx`
// and `components/teacher/MyTeaching.tsx` depend on:
//
//  1. `resolveTeachingContext()` exposes `class_subjects.id` as
//     `assignmentId` per teaching assignment — the value MyTeaching's new
//     "Add Assessment" link carries in its URL and the new page locks its
//     canonical subject context to. No new plumbing was added for this; this
//     test only confirms the existing read model already provides it.
//  2. A Grade 9 (Junior) teaching assignment works through the exact same
//     mechanism as Grade 10 (Senior) — no Senior-only assumption anywhere
//     in the shared teacher UI's data source (Phase 3B Step 25).
//  3. Once a tenure ends, it silently disappears from the CURRENT teaching
//     context — this is what gives the new page's "this teaching assignment
//     is no longer active" state its fail-closed meaning for a stale tab
//     (Phase 3B Step 21), and `createBridgedAssessment` independently
//     refuses it too (already exhaustively proven in
//     lib/core/academicBridge.canonicalSubject.test.ts — reasserted here
//     only as a single consistency check, not re-proven in depth).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/teachingAssignments.addAssessmentUX.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { resolveTeachingContext } from '@/lib/core/teachingAssignments'
import { createBridgedAssessment } from '@/lib/core/academicBridge'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_3B_UX_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p3b-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db.from('class_subjects').select('id').eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

after(async () => {
  for (const id of createdSchoolIds) {
    const { data: coreClasses } = await db.from('classes').select('id').eq('school_id', id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) {
      const { data: legacyClasses } = await db.from('teacher_classes').select('id').in('external_id', classExternalIds)
      const legacyClassIds = (legacyClasses ?? []).map(c => c.id)
      if (legacyClassIds.length) await db.from('class_assessments').delete().in('class_id', legacyClassIds)
      await db.from('teacher_classes').delete().in('external_id', classExternalIds)
    }
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', id)
    const teacherIds = (teacherRows ?? []).map(t => t.id)
    if (teacherIds.length) {
      await db.from('ingestion_runs').delete().in('teacher_id', teacherIds)
      await db.from('assessment_types').delete().in('teacher_id', teacherIds)
    }
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

let schoolId: string
let adminId: string
let gradeNineId: string
let gradeTenId: string
let juniorMathId: string
let coreMathId: string
let peter: { userId: string; email: string; membershipId: string }

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')

  // Both a Junior (G9) and a Senior (G10) grade in one school activation —
  // the same shape a real school has.
  const act = await activateSchool(schoolId, { gradeCodes: ['G9', 'G10'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id, grades(code)').eq('school_id', schoolId)
  const g9Class = classes!.find(c => (c.grades as unknown as { code: string } | null)?.code === 'G9')!
  const g10Class = classes!.find(c => (c.grades as unknown as { code: string } | null)?.code === 'G10')!
  gradeNineId = g9Class.id
  gradeTenId = g10Class.id

  const juniorSubjects = await listSubjects('junior_secondary')
  juniorMathId = juniorSubjects.find(s => s.name === 'Mathematics')!.id
  const seniorSubjects = await listSubjects('senior_secondary')
  coreMathId = seniorSubjects.find(s => s.name === 'Core Mathematics')!.id

  const user = await mkUser('peter')
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Peter` })
  peter = { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }

  await assignSubjectTeacher(schoolId, gradeNineId, juniorMathId, peter.membershipId)
  await assignSubjectTeacher(schoolId, gradeTenId, coreMathId, peter.membershipId)
})

test('teaching context exposes class_subjects.id as assignmentId for both Junior and Senior assignments — the exact value My Teaching links carry', async () => {
  const g9CsId = await currentClassSubjectId(gradeNineId, juniorMathId)
  const g10CsId = await currentClassSubjectId(gradeTenId, coreMathId)

  const context = await resolveTeachingContext(peter.userId)
  if (context.kind !== 'school') throw new Error(`expected kind 'school', got ${context.kind}`)

  const g9Assignment = context.assignments.find(a => a.assignmentId === g9CsId)
  const g10Assignment = context.assignments.find(a => a.assignmentId === g10CsId)
  assert.ok(g9Assignment, 'Grade 9 Mathematics assignment must be discoverable by its class_subjects.id')
  assert.equal(g9Assignment!.subjectName, 'Mathematics')
  assert.ok(g10Assignment, 'Grade 10 Core Mathematics assignment must be discoverable by its class_subjects.id')
  assert.equal(g10Assignment!.subjectName, 'Core Mathematics')

  // Two genuinely distinct subjects -> two distinct groups, not merged.
  assert.equal(context.groups.some(g => g.subjectName === 'Mathematics'), true)
  assert.equal(context.groups.some(g => g.subjectName === 'Core Mathematics'), true)
})

test('Grade 9: the Add Assessment path works from the same class_subjects mechanism, no Senior programme dependency', async () => {
  const g9CsId = await currentClassSubjectId(gradeNineId, juniorMathId)

  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeNineId, peter.userId,
    { title: 'Grade 9 CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    g9CsId,
  )
  const { data: row } = await db.from('class_assessments').select('class_subject_id, subject_id, subjects').eq('id', assessmentId).single()
  assert.equal(row!.class_subject_id, g9CsId)
  assert.equal(row!.subject_id, juniorMathId)
  assert.deepEqual(row!.subjects, ['Mathematics'])
})

test('stale tab: once a tenure ends, it disappears from the CURRENT teaching context, and the assessment API independently refuses it', async () => {
  const g10CsId = await currentClassSubjectId(gradeTenId, coreMathId)

  // Replace Peter on Grade 10 Core Mathematics -> closes his tenure.
  const mary = await mkUser('mary')
  await inviteTeacher(schoolId, mary.email, adminId)
  const maryAccepted = await acceptTeacherInvitation(mary.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Mary` })
  await assignSubjectTeacher(schoolId, gradeTenId, coreMathId, maryAccepted.schoolUser.id)

  const context = await resolveTeachingContext(peter.userId)
  if (context.kind !== 'school') throw new Error(`expected kind 'school', got ${context.kind}`)
  assert.equal(
    context.assignments.some(a => a.assignmentId === g10CsId),
    false,
    'a closed tenure must not appear in the current teaching context — this is what makes a stale Add Assessment tab fail closed in the UI',
  )

  await assert.rejects(
    () => createBridgedAssessment(
      schoolId, gradeTenId, peter.userId,
      { title: 'Stale Tab Attempt', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
      g10CsId,
    ),
    ResourceOwnershipError,
  )
})
