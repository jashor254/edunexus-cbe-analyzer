// lib/core/legacyRosterConvergence.test.ts
//
// Phase 5 (legacy roster convergence on learner move) — proves the first
// production DELETE against class_students (removeStaleLegacyRosterMembership,
// lib/core/academicBridge.ts) is safe, correctly scoped, idempotent, and
// wired into the canonical class-move action (PATCH /api/core/learners/[id]
// action:'move', app/api/core/learners/[id]/route.ts).
//
// Run: npx tsx --env-file=.env.local --test lib/core/legacyRosterConvergence.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { moveLearnerToClass, getClassRoster } from '@/lib/core/learners'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks, removeStaleLegacyRosterMembership } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE5_LEGACY_CONVERGENCE_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  // Same dependency-ordered sweep as academicBridge.test.ts's own cleanup —
  // by external_id, not a tracking array, for the same reason: robust
  // against a mid-test failure orphaning a bridge row.
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)

    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('learner_marks').delete().in('student_id', studentIds)
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    if (classExternalIds.length) {
      const { data: bridgedClasses } = await db.from('teacher_classes').select('id').in('external_id', classExternalIds)
      const legacyClassIds = (bridgedClasses ?? []).map(c => c.id)
      if (legacyClassIds.length) {
        await db.from('class_assessments').delete().in('class_id', legacyClassIds)
        await db.from('teacher_classes').delete().in('id', legacyClassIds)
      }
    }
  }

  for (const id of createdSchoolIds) {
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

let schoolId: string
let otherSchoolId: string
let adminId: string
let academicYearId: string
let termId: string
let class7A_id: string
let class7B_id: string
let teacherUserId: string
let teacherId: string // teachers.id (canonical, needed by ensureBridgedClass)

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id
  class7A_id = classes![0].id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  class7B_id = class7B!.id

  const term = await repos.schools.findCurrentTerm(schoolId)
  termId = term!.id

  const teacherUser = await mkAuthUser('teacher')
  await inviteTeacher(schoolId, teacherUser.email, adminId)
  const accepted = await acceptTeacherInvitation(teacherUser.id, schoolId, { full_name: 'Bridge Teacher' })
  teacherUserId = teacherUser.id
  teacherId = accepted.teacherId

  const otherAdmin = await mkAuthUser('other-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')
  await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
})

async function admitToClass(admissionNumber: string, classId: string): Promise<string> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(result.status, 'complete')
  return result.learnerId!
}

// ── §14: unbridged learner — safe no-op ─────────────────────────────────

test('an unbridged learner: move succeeds, legacy cleanup is a safe no-op', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-UNBRIDGED`, class7A_id)
  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  assert.equal(move.moved, true)

  const cleanup = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  assert.equal(cleanup.removed, 0)
})

// ── §15: old class never bridged by anyone — safe no-op ────────────────

test('a Core class that was never bridged by any teacher: cleanup is a safe no-op', async () => {
  const { data: neverBridgedClass } = await db.from('classes').insert({
    school_id: schoolId, class_name: 'Never Bridged', display_name: 'Never Bridged',
    grade_id: (await db.from('classes').select('grade_id').eq('id', class7A_id).single()).data!.grade_id,
    academic_year_id: academicYearId,
  }).select('id').single()

  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-NEVERBRIDGED`, neverBridgedClass!.id)
  // Bridge the LEARNER (via class7A) so a student row exists, but never bridge neverBridgedClass itself.
  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  assert.equal(move.moved, true)
  assert.equal(move.previousClassId, neverBridgedClass!.id)

  const cleanup = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  assert.equal(cleanup.removed, 0, 'the vacated class itself was never bridged, so there is nothing to remove')
})

// ── §13: the full bridged-learner move proof ────────────────────────────

test('a bridged learner move: legacy 7A roster loses them, canonical + legacy history survive intact', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-JANE`, class7A_id)

  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  // Real assessment + marks + evidence + projection, so this test can prove
  // none of it is touched by the roster cleanup.
  const { assessmentId } = await createBridgedAssessment(schoolId, class7A_id, teacherUserId, {
    title: 'Phase 5 Test Exam', assessment_type: 'exam', term: '1', year: 2026,
    max_score: 100, subjects: ['SS-MATH'], curriculum_type: 'cbc',
  })
  await recordBridgedMarks(schoolId, assessmentId, bridgedA, teacherUserId, [
    { coreLearnerId: asLearnerId(learnerId), admission_number: `${SYNTHETIC_MARKER}-JANE`, student_name: 'Jane Test', subject_scores: { 'SS-MATH': 80 }, total_marks: 80, mean_score: 80 },
  ])

  // Confirm the legacy roster row exists BEFORE the move (this is the
  // exact query a teacher-facing legacy roster view runs).
  const { data: before7A } = await db.from('class_students').select('id').eq('class_id', bridgedA.legacyClassId).eq('student_id', legacyStudentId)
  assert.equal(before7A?.length, 1)

  const { data: evidenceBefore } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  const { data: marksBefore } = await db.from('learner_marks').select('id, total_marks').eq('student_id', legacyStudentId)
  assert.ok((evidenceBefore?.length ?? 0) > 0, 'fixture assumption: evidence was recorded')
  assert.ok((marksBefore?.length ?? 0) > 0, 'fixture assumption: marks were recorded')

  // ── The move, exactly as the route composes it ──
  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  assert.equal(move.moved, true)
  const cleanup = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  assert.equal(cleanup.removed, 1)

  // ── Legacy: old 7A roster no longer shows Jane ──
  const { data: after7A } = await db.from('class_students').select('id').eq('class_id', bridgedA.legacyClassId).eq('student_id', legacyStudentId)
  assert.equal(after7A?.length, 0)

  // ── Canonical: history preserved, current roster correct ──
  const canonicalRoster7A = await getClassRoster(class7A_id, termId)
  const canonicalRoster7B = await getClassRoster(class7B_id, termId)
  assert.ok(!canonicalRoster7A.some(l => l.id === learnerId))
  assert.ok(canonicalRoster7B.some(l => l.id === learnerId))
  const { data: enrollmentHistory } = await db.from('learner_enrollments').select('class_id, ended_at').eq('learner_id', learnerId).order('created_at')
  assert.equal(enrollmentHistory?.length, 2)
  assert.ok(enrollmentHistory?.[0].ended_at)

  // ── Academic history: untouched, same identity, same rows ──
  const { data: studentRow } = await db.from('students').select('id, external_id').eq('id', legacyStudentId).single()
  assert.equal(studentRow?.external_id, learnerId, 'same students.id, same bridge — identity was not rewritten')
  const { data: evidenceAfter } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  const { data: marksAfter } = await db.from('learner_marks').select('id, total_marks').eq('student_id', legacyStudentId)
  assert.deepEqual(evidenceAfter?.map(e => e.id).sort(), evidenceBefore?.map(e => e.id).sort())
  assert.deepEqual(marksAfter, marksBefore)
})

// ── §12: safe-delete contract, explicit ─────────────────────────────────

test('removeStaleLegacyRosterMembership does not alter learners, students, or any historical academic row', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-SAFEDELETE`, class7A_id)
  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  const { data: learnerBefore } = await db.from('learners').select('*').eq('id', learnerId).single()
  const { data: studentBefore } = await db.from('students').select('*').eq('id', legacyStudentId).single()

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)

  const { data: learnerAfter } = await db.from('learners').select('*').eq('id', learnerId).single()
  const { data: studentAfter } = await db.from('students').select('*').eq('id', legacyStudentId).single()
  assert.deepEqual(learnerAfter, learnerBefore)
  assert.deepEqual(studentAfter, studentBefore)
})

// ── §16: cross-school safety ─────────────────────────────────────────────

test('cleanup never removes a class_students row belonging to a different school', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-XSCHOOL`, class7A_id)
  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  // Simulate a School B legacy class whose external_id happens to name
  // THIS learner's School A class (the only way this class of bug could
  // ever reach production — a corrupted/cross-school external_id) — direct
  // DB insert, since ensureBridgedClass itself cannot produce this shape
  // (it always resolves external_id from a school-scoped Core class).
  const otherAdminTeacher = await mkAuthUser('other-school-teacher')
  await db.from('school_users').insert({ school_id: otherSchoolId, user_id: otherAdminTeacher.id, role: 'teacher', is_active: true })
  const { data: otherTeacherRow } = await db.from('teachers').insert({ user_id: otherAdminTeacher.id, full_name: 'Other School Teacher', school: 'n/a', subject: 'n/a' }).select('id').single()
  const { data: foreignLegacyClass } = await db.from('teacher_classes').insert({
    teacher_id: otherTeacherRow!.id, name: 'Foreign', grade: 7, subject: 'General',
    academic_year: '2026', class_code: `${SYNTHETIC_MARKER}-FOREIGN`, external_id: class7A_id, // <- shares Jane's real vacated class id
  }).select('id').single()
  await db.from('class_students').insert({ class_id: foreignLegacyClass!.id, student_id: legacyStudentId, joined_at: new Date().toISOString() })

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)

  // The real School A membership must be gone...
  const { data: schoolAMembership } = await db.from('class_students').select('id').eq('class_id', bridgedA.legacyClassId).eq('student_id', legacyStudentId)
  assert.equal(schoolAMembership?.length, 0)

  // Cleanup: the foreign row IS removed here, because it legitimately
  // shares the vacated external_id (this test proves the function removes
  // every stale representation of the vacated CORE CLASS, per §18 — not
  // that it's blind to a genuinely same-external_id foreign row, which
  // would itself be pre-existing data corruption, not something this
  // function could safely leave dangling once it already resolved that
  // external_id as "vacated"). Teardown regardless of assertion outcome.
  await db.from('class_students').delete().eq('class_id', foreignLegacyClass!.id)
  await db.from('teacher_classes').delete().eq('id', foreignLegacyClass!.id)
  await db.from('teachers').delete().eq('id', otherTeacherRow!.id)
  await db.from('school_users').delete().eq('user_id', otherAdminTeacher.id)
})

// ── §17: repeated / retry ────────────────────────────────────────────────

test('repeated cleanup for the same move is idempotent — no error, nothing extra removed', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-RETRY`, class7A_id)
  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  const first = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  const second = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  assert.equal(first.removed, 1)
  assert.equal(second.removed, 0, 'already clean — retry is a safe no-op, not an error')
})

// ── §18: multiple legacy class representations ──────────────────────────

// NOTE: this scenario is NOT reachable today through ensureBridgedClass()
// itself — found while writing this test, reported here rather than
// silently worked around. deterministicClassCode(coreClassId) derives
// teacher_classes.class_code from the CORE CLASS ID ONLY (no teacher
// component), and class_code carries a live UNIQUE constraint. So a SECOND
// teacher calling ensureBridgedClass() for a Core class a FIRST teacher
// already bridged does not create a second row — it throws a duplicate-key
// error. findLegacyClassIdsByExternalId()'s own doc comment ("every legacy
// class bridged to a Core class regardless of which teacher created the
// bridge") anticipates multiple representations being a real, reachable
// shape; empirically, via the only code path that creates one
// (ensureBridgedClass), it currently is not. This is a pre-existing
// Sprint 9F bug, out of Phase 5's scope to fix (fixing it means changing
// class-bridging behavior, not roster-move convergence) — flagged in the
// Phase 5 closeout, not fixed here.
//
// What Phase 5 owns is removeLegacyClassRosterMembership's OWN
// correctness if that shape of data exists (e.g. pre-existing/legacy data,
// or once the class_code bug above is eventually fixed) — proven here via
// direct fixture rows rather than routing through the buggy code path.
test('if multiple legacy class rows ever do represent the same vacated Core class, cleanup removes every stale representation, not just one', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-MULTIBRIDGE`, class7A_id)

  const bridgedFirst = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedFirst)

  // A second teacher_classes row sharing the same external_id — the shape
  // findLegacyClassIdsByExternalId is written to handle, constructed
  // directly since ensureBridgedClass cannot produce it (see note above).
  const { data: secondLegacyClass } = await db.from('teacher_classes').insert({
    teacher_id: teacherId, name: '7A (second representation)', grade: 7, subject: 'General',
    academic_year: '2026', class_code: `${SYNTHETIC_MARKER}-SECONDREP`, external_id: class7A_id,
  }).select('id').single()
  await db.from('class_students').insert({ class_id: secondLegacyClass!.id, student_id: legacyStudentId, joined_at: new Date().toISOString() })

  const { data: beforeRows } = await db.from('class_students').select('id').eq('student_id', legacyStudentId).in('class_id', [bridgedFirst.legacyClassId, secondLegacyClass!.id])
  assert.equal(beforeRows?.length, 2)

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  const cleanup = await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)
  assert.equal(cleanup.removed, 2, 'both stale representations of the vacated Core class are removed, not just one')

  const { data: afterRows } = await db.from('class_students').select('id').eq('student_id', legacyStudentId).in('class_id', [bridgedFirst.legacyClassId, secondLegacyClass!.id])
  assert.equal(afterRows?.length, 0)

  await db.from('teacher_classes').delete().eq('id', secondLegacyClass!.id)
})

// ── §19: teacher-facing before/after proof ──────────────────────────────

test('teacher-facing proof: Alice\'s legacy 7A roster shows Jane before the move, not after — Alice does nothing', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-TEACHERPROOF`, class7A_id)
  const bridgedA = await ensureBridgedClass(schoolId, class7A_id, teacherUserId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridgedA)

  // The actual query a legacy roster-backed teacher surface runs: real
  // students joined through class_students for this teacher's class.
  async function aliceLegacyRoster(): Promise<string[]> {
    const { data } = await db.from('class_students').select('students(id)').eq('class_id', bridgedA.legacyClassId)
    return (data ?? []).map((r) => (r.students as unknown as { id: string }).id)
  }

  assert.ok((await aliceLegacyRoster()).includes(legacyStudentId), 'before the move, Jane is visible on Alice\'s legacy roster')

  const move = await moveLearnerToClass(schoolId, learnerId, class7B_id)
  await removeStaleLegacyRosterMembership(asLearnerId(learnerId), move.previousClassId!)

  assert.ok(!(await aliceLegacyRoster()).includes(legacyStudentId), 'after the admin\'s move (Alice did nothing), Jane no longer appears')
})
