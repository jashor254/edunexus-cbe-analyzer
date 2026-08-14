// lib/core/academicBridge.test.ts
//
// Sprint 9F — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established throughout this series
// (lib/core/schoolActivation.test.ts, teacherOnboarding.test.ts,
// learnerOnboarding.test.ts, academicActivation.test.ts).
//
// This suite proves Step 10's full production path — Create School →
// Activate → Invite Teacher → Accept → Admit Learner → Enroll → Assessment
// → Evidence → Projection → Compass — end to end against the live
// Supabase project, plus the specific idempotency/security/regression
// checks Steps 4/7/8 ask for.
//
// Run: npx tsx --env-file=.env.local --test lib/core/academicBridge.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { getLearnerReadiness } from '@/lib/core/learnerOnboarding'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { resolveCompassStudentAccess } from '@/lib/compass/ownership'
import { MembershipRequiredError, PermissionDeniedError } from '@/lib/core/errors'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_9F_BRIDGE_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint9f-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  // Sweep bridged legacy rows by Core external_id rather than a manually-
  // threaded tracking array — robust against a mid-call failure orphaning
  // a bridge row before a happy-path push() would ever run (exactly what
  // happened once during this sprint's own development: a bug in
  // saveScores threw after ensureBridgedLearner had already created its
  // legacy `students` row, and a push-on-success-only array missed it).
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)

    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        // Full dependency chain first (all real FKs, confirmed live) — a
        // bare `students` delete silently fails on any of these and the
        // orphan survives, which is exactly what happened once during
        // this sprint's own development before this fix.
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) {
          await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
          await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
        }
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('learner_marks').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    if (classExternalIds.length) await db.from('teacher_classes').delete().in('external_id', classExternalIds)
  }
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades Core-side rows
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fullySetUpSchool(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacher = await mkAuthUser(`${labelPrefix}-teacher`)
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: `${labelPrefix} Teacher` })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed: ${accept.status}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  return {
    schoolId: school.id,
    adminUserId: admin.id,
    teacherUserId: teacher.id,
    classId: classes![0].id,
    academicYearId: classes![0].academic_year_id,
    termId: terms![0].id,
  }
}

async function admitAndEnroll(fixture: Awaited<ReturnType<typeof fullySetUpSchool>>, admissionNumber: string) {
  const result = await onboardLearner(fixture.schoolId, {
    admission_number: admissionNumber,
    first_name: 'Bridge',
    last_name: 'Test',
    class_id: fixture.classId,
    term_id: fixture.termId,
    academic_year_id: fixture.academicYearId,
    guardian: { full_name: 'Bridge Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (result.status !== 'complete') throw new Error(`fixture enrollment failed: ${result.error}`)
  return result.learnerId!
}

// ── Step 10: full production path, end to end ────────────────────────────────

test('end-to-end: Create School -> Activate -> Invite/Accept Teacher -> Admit -> Enroll -> Assessment -> Evidence -> Projection -> Compass', async () => {
  const fixture = await fullySetUpSchool('e2e')
  const learnerId = await admitAndEnroll(fixture, `E2E-${Date.now()}`)

  // eligibleForAssessment/eligibleForCompass both flip true post-enrollment.
  const readiness = await getLearnerReadiness(learnerId, fixture.schoolId, fixture.termId)
  assert.equal(readiness.eligibleForAssessment, true)
  assert.equal(readiness.eligibleForCompass, true)

  // Assessment, using the Core class id directly — the bridge resolves it.
  const { assessmentId, legacyClassId } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'End-to-End CAT',
    assessment_type: 'cat',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['mathematics'],
    curriculum_type: 'cbc',
  })
  assert.ok(assessmentId)

  const bridgedClass = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)
  assert.equal(bridgedClass.legacyClassId, legacyClassId) // reused, not re-created

  const { legacyStudentIds } = await recordBridgedMarks(fixture.schoolId, assessmentId, bridgedClass, fixture.teacherUserId, [
    { coreLearnerId: asLearnerId(learnerId), admission_number: 'E2E', student_name: 'Bridge Test', subject_scores: { mathematics: 78 }, total_marks: 78, mean_score: 78 },
  ])
  const legacyStudentId = legacyStudentIds[0]

  // Evidence: a confirmed learner_evidence row exists for the bridged student.
  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  assert.ok(evidence.length > 0)
  assert.ok(evidence.some(e => e.lifecycle_state === 'auto_confirmed' || e.lifecycle_state === 'reviewed_confirmed'))

  // Projection: recordBridgedMarks already called recomputeLearnerProjection —
  // verify a real, persisted row exists (Stop Condition: "first assessment
  // successfully reaches Projection").
  const { data: projectionRows } = await db.from('learner_projections').select('id, projector_type').eq('learner_id', legacyStudentId)
  assert.ok(projectionRows && projectionRows.length > 0)

  // Compass: the bridged teacher can access the bridged student's data via
  // the SAME, unmodified lib/compass/ownership.ts this platform already uses.
  const access = await resolveCompassStudentAccess(fixture.teacherUserId, legacyStudentId)
  assert.equal(access.allowed, true)
  if (access.allowed) assert.equal(access.via, 'teacher_direct')
})

// ── Step 2/4: idempotency — no duplicate identities ──────────────────────────

test('ensureBridgedClass: idempotent — repeated calls reuse the same legacy row, never duplicate', async () => {
  const fixture = await fullySetUpSchool('idem-class')
  const first = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)
  const second = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)

  assert.equal(first.legacyClassId, second.legacyClassId)
  const { data: rows } = await db.from('teacher_classes').select('id').eq('external_id', fixture.classId)
  assert.equal(rows?.length, 1)
})

test('ensureBridgedLearner: idempotent — repeated calls reuse the same legacy row, never duplicate', async () => {
  const fixture = await fullySetUpSchool('idem-learner')
  const learnerId = await admitAndEnroll(fixture, `IDEM-${Date.now()}`)
  const bridgedClass = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)

  const first = await ensureBridgedLearner(fixture.schoolId, asLearnerId(learnerId), bridgedClass)
  const second = await ensureBridgedLearner(fixture.schoolId, asLearnerId(learnerId), bridgedClass)

  assert.equal(first.legacyStudentId, second.legacyStudentId)
  const { data: rows } = await db.from('students').select('id').eq('external_id', learnerId)
  assert.equal(rows?.length, 1)
})

// IDENTITY-1 Phase 3 — the concurrency case `ensureBridgedLearner`'s
// find-then-insert cannot rule out on its own: two callers racing the SAME
// Core learner, both passing the lookup, one losing the insert to Phase 2's
// `uq_students_external_id_bridge` partial unique index. Proves the loser
// recovers the winner's row via `BridgeAlreadyClaimedError` instead of the
// request failing — and that only one `students` row ever exists.
test('ensureBridgedLearner: concurrent race for the same Core learner converges on one legacy row, never two', async () => {
  const fixture = await fullySetUpSchool('race-learner')
  const learnerId = await admitAndEnroll(fixture, `RACE-${Date.now()}`)
  const bridgedClass = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)

  const [a, b] = await Promise.all([
    ensureBridgedLearner(fixture.schoolId, asLearnerId(learnerId), bridgedClass),
    ensureBridgedLearner(fixture.schoolId, asLearnerId(learnerId), bridgedClass),
  ])

  // Both requests succeed — neither surfaces the race to its caller — and
  // agree on exactly the same legacy identity.
  assert.equal(a.legacyStudentId, b.legacyStudentId)

  const { data: rows } = await db.from('students').select('id').eq('external_id', learnerId)
  assert.equal(rows?.length, 1, 'a race must never leave two students rows bridged to one learner')

  // The roster link is still established for whichever request actually won —
  // upsertLegacyClassRoster runs on both the create path and the recovery path.
  const { data: roster } = await db.from('class_students').select('student_id').eq('class_id', bridgedClass.legacyClassId)
  assert.deepEqual(roster?.map(r => r.student_id), [a.legacyStudentId])
})

test('no duplicate teacher identity: the bridge reuses the existing canonical teachers row from Sprint 9C onboarding, creates no second one', async () => {
  const fixture = await fullySetUpSchool('no-dup-teacher')
  const beforeCount = (await db.from('teachers').select('id', { count: 'exact', head: true }).eq('user_id', fixture.teacherUserId)).count
  assert.equal(beforeCount, 1) // created by acceptTeacherInvitation, Sprint 9C

  const bridged = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)

  const afterCount = (await db.from('teachers').select('id', { count: 'exact', head: true }).eq('user_id', fixture.teacherUserId)).count
  assert.equal(afterCount, 1) // unchanged — no second teacher identity created
  assert.equal(bridged.legacyTeacherId, (await repos.teachers.findTeacherByUserId(fixture.teacherUserId))!.id)
})

// ── Step 7: security — school isolation, teacher ownership ──────────────────

test('security: a user with no membership in the school cannot bridge a class (school isolation)', async () => {
  const fixture = await fullySetUpSchool('sec-isolation')
  const outsider = await mkAuthUser('outsider')

  await assert.rejects(
    () => ensureBridgedClass(fixture.schoolId, fixture.classId, outsider.id),
    (err: unknown) => err instanceof MembershipRequiredError
  )
})

test('security: a class explicitly assigned to teacher A cannot be bridged by teacher B (ownership preserved, not weakened)', async () => {
  const fixture = await fullySetUpSchool('sec-ownership')

  const teacherB = await mkAuthUser('teacherB')
  const inviteB = await inviteTeacher(fixture.schoolId, teacherB.email, fixture.adminUserId)
  assert.equal(inviteB.status, 'invited')
  await acceptTeacherInvitation(teacherB.id, fixture.schoolId, { full_name: 'Teacher B' })

  // Explicitly assign the class to Teacher A (fixture.teacherUserId) via
  // school_users.id, matching classes.class_teacher_id's real FK target.
  const teacherASchoolUser = await repos.schools.findSchoolUserByUserId(fixture.teacherUserId)
  await db.from('classes').update({ class_teacher_id: teacherASchoolUser!.id }).eq('id', fixture.classId)

  await assert.rejects(
    () => ensureBridgedClass(fixture.schoolId, fixture.classId, teacherB.id),
    (err: unknown) => err instanceof PermissionDeniedError
  )

  // Teacher A (the assigned owner) succeeds normally.
  const bridged = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)
  assert.ok(bridged.legacyClassId)
})

test('security: an admin may bridge a class even when it is explicitly assigned to a specific teacher', async () => {
  const fixture = await fullySetUpSchool('sec-admin-override')
  const teacherASchoolUser = await repos.schools.findSchoolUserByUserId(fixture.teacherUserId)
  await db.from('classes').update({ class_teacher_id: teacherASchoolUser!.id }).eq('id', fixture.classId)

  // Admin has no teachers row by default (ADR-0002 Part 7's known,
  // unresolved edge case) — give the admin one to exercise the admin-tier
  // branch of ensureBridgedClass's ownership check specifically, not the
  // separate, already-documented "admin has no teachers row at all" gap.
  const { data: adminTeacher } = await db.from('teachers').insert({ user_id: fixture.adminUserId, full_name: 'Admin As Teacher', school: 'x' }).select('id').single()

  const bridged = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.adminUserId)
  assert.ok(bridged.legacyClassId)
  void adminTeacher
})

// ── Step 2: ranking/grading preserved, unmodified ────────────────────────────

test('ranking and grading are computed by the existing, unmodified engines for bridged marks', async () => {
  const fixture = await fullySetUpSchool('ranking')
  const learnerA = await admitAndEnroll(fixture, `RANK-A-${Date.now()}`)
  const learnerB = await admitAndEnroll(fixture, `RANK-B-${Date.now()}`)

  const { assessmentId, legacyClassId } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'Ranking Test',
    assessment_type: 'exam',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['english'],
    curriculum_type: 'cbc',
  })
  const legacyTeacherId = (await repos.teachers.findTeacherByUserId(fixture.teacherUserId))!.id

  const { legacyStudentIds } = await recordBridgedMarks(
    fixture.schoolId, assessmentId,
    { legacyClassId, legacyTeacherId, coreClassId: fixture.classId, gradeNumber: 10 },
    fixture.teacherUserId,
    [
      { coreLearnerId: asLearnerId(learnerA), admission_number: 'RANK-A', student_name: 'Learner A', subject_scores: { english: 90 }, total_marks: 90, mean_score: 90 },
      { coreLearnerId: asLearnerId(learnerB), admission_number: 'RANK-B', student_name: 'Learner B', subject_scores: { english: 60 }, total_marks: 60, mean_score: 60 },
    ]
  )

  const { data: marks } = await db.from('learner_marks').select('student_id, total_marks, position').eq('assessment_id', assessmentId).order('position')
  assert.equal(marks?.length, 2)
  assert.equal(marks?.[0].total_marks, 90)
  assert.equal(marks?.[0].position, 1) // canonical Ranking Engine — higher score, better position
  assert.equal(marks?.[1].position, 2)
})

// ── Step 4: repeated marks recording is safe to retry ────────────────────────

test('recordBridgedMarks: repeated calls with the same scores upsert, not duplicate, learner_marks rows', async () => {
  const fixture = await fullySetUpSchool('retry-marks')
  const learnerId = await admitAndEnroll(fixture, `RETRY-${Date.now()}`)

  const { assessmentId, legacyClassId } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'Retry Test',
    assessment_type: 'cat',
    term: '1',
    year: 2026,
    max_score: 50,
    subjects: ['science'],
    curriculum_type: 'cbc',
  })
  const legacyTeacherId = (await repos.teachers.findTeacherByUserId(fixture.teacherUserId))!.id
  const bridgedClass = { legacyClassId, legacyTeacherId, coreClassId: fixture.classId, gradeNumber: 10 }
  const scores = [{ coreLearnerId: asLearnerId(learnerId), admission_number: 'RETRY', student_name: 'Retry Test', subject_scores: { science: 40 }, total_marks: 40, mean_score: 40 }]

  const first = await recordBridgedMarks(fixture.schoolId, assessmentId, bridgedClass, fixture.teacherUserId, scores)
  const second = await recordBridgedMarks(fixture.schoolId, assessmentId, bridgedClass, fixture.teacherUserId, scores)

  assert.deepEqual(first.legacyStudentIds, second.legacyStudentIds)
  const { data: markRows } = await db.from('learner_marks').select('id').eq('assessment_id', assessmentId)
  assert.equal(markRows?.length, 1) // still exactly one mark row, not two
})
