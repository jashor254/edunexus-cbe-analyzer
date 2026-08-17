// lib/core/academicBridge.multiTeacher.test.ts
//
// Phase 13A (NEW-01 closure) — the Phase 13 freeze audit empirically
// reproduced a real P0: ensureBridgedClass() derives teacher_classes.
// class_code from coreClassId ALONE, but teacher_classes.class_code has a
// live global UNIQUE constraint. The very first time a SECOND subject
// teacher of the same Core class creates an assessment, their bridge
// insert collides with the first teacher's row and throws a raw,
// unhandled `insertLegacyClass: duplicate key value violates unique
// constraint "teacher_classes_class_code_key"` — a generic 500 to the
// teacher. This is not a rare edge case: it is the default shape of any
// real class with more than one subject teacher.
//
// This suite proves the fix: class_code is now scoped to (coreClassId,
// teacherId), so distinct teachers of the same Core class never collide,
// while existing bridge identity — teacher-scoped lookup via
// (external_id, teacher_id), completely independent of the exact
// class_code string — is left untouched for old rows.
//
// Run: npx tsx --env-file=.env.local --test lib/core/academicBridge.multiTeacher.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks, removeStaleLegacyRosterMembership } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE13A_BRIDGE_MULTITEACHER_TEST'
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
    if (classExternalIds.length) {
      await db.from('class_assessments').delete().in('class_id',
        (await db.from('teacher_classes').select('id').in('external_id', classExternalIds)).data?.map(r => r.id) ?? []
      )
      await db.from('teacher_classes').delete().in('external_id', classExternalIds)
    }
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

let schoolId: string
let adminId: string
let classId: string
let termId: string
let academicYearId: string
let aliceUserId: string
let brianUserId: string
let carolUserId: string
let mathsId: string
let englishId: string
let scienceId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school-${Date.now()}` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', schoolId).limit(1)
  classId = classes![0].id
  academicYearId = classes![0].academic_year_id
  const term = await repos.schools.findCurrentTerm(schoolId)
  termId = term!.id

  const subjects = await listSubjects('junior_secondary')
  mathsId = subjects.find(s => s.name === 'Mathematics')!.id
  englishId = subjects.find(s => s.name === 'English')!.id
  scienceId = subjects.find(s => s.name === 'Integrated Science')!.id

  async function addTeacher(label: string, subjectId: string): Promise<string> {
    const t = await mkAuthUser(label)
    await inviteTeacher(schoolId, t.email, adminId)
    const accept = await acceptTeacherInvitation(t.id, schoolId, { full_name: `${label} Bridge` })
    await assignSubjectTeacher(schoolId, classId, subjectId, accept.schoolUser.id)
    return t.id
  }

  aliceUserId = await addTeacher('alice', mathsId)
  brianUserId = await addTeacher('brian', englishId)
  carolUserId = await addTeacher('carol', scienceId)
})

// ── §1: deterministic reproduction of the exact freeze-audit failure ───────

test('REPRODUCTION: a second subject teacher of the same Core class can bridge it without a class_code collision', async () => {
  const aliceBridge = await ensureBridgedClass(schoolId, classId, aliceUserId)
  assert.ok(aliceBridge.legacyClassId)

  // Before the fix, this line threw:
  //   insertLegacyClass: duplicate key value violates unique constraint "teacher_classes_class_code_key"
  const brianBridge = await ensureBridgedClass(schoolId, classId, brianUserId)
  assert.ok(brianBridge.legacyClassId)
  assert.notEqual(brianBridge.legacyClassId, aliceBridge.legacyClassId, 'Brian must never share Alice\'s legacy class identity')
})

// ── §9: three teachers, not merely two ──────────────────────────────────────

test('three subject teachers of the same Core class each get a distinct, correctly-owned legacy representation', async () => {
  const alice = await ensureBridgedClass(schoolId, classId, aliceUserId)
  const brian = await ensureBridgedClass(schoolId, classId, brianUserId)
  const carol = await ensureBridgedClass(schoolId, classId, carolUserId)

  const ids = [alice.legacyClassId, brian.legacyClassId, carol.legacyClassId]
  assert.equal(new Set(ids).size, 3, 'three distinct teacher_classes rows')

  const { data: rows } = await db.from('teacher_classes').select('id, teacher_id, class_code, external_id').in('id', ids)
  assert.equal(new Set(rows!.map(r => r.class_code)).size, 3, 'three distinct class_codes')
  assert.ok(rows!.every(r => r.external_id === classId), 'all three represent the same Core class')
  const teacherIds = new Set(rows!.map(r => r.teacher_id))
  assert.equal(teacherIds.size, 3, 'each row is owned by its own teacher — none shared')
})

// ── §7: same-teacher retry idempotency, unaffected by the fix ──────────────

test('the same teacher bridging the same Core class twice is idempotent — no duplicate row, code unchanged', async () => {
  const first = await ensureBridgedClass(schoolId, classId, brianUserId)
  const second = await ensureBridgedClass(schoolId, classId, brianUserId)
  assert.equal(second.legacyClassId, first.legacyClassId)

  const { data: rows } = await db.from('teacher_classes').select('id').eq('external_id', classId).eq('teacher_id', first.legacyTeacherId)
  assert.equal(rows?.length, 1, 'exactly one row for this teacher, not a second one on retry')
})

// ── §13: THE primary real-world proof — two teachers each create their FIRST assessment ──

test('assessment creation: two subject teachers of the same class each create their first assessment successfully', async () => {
  const aliceAssessment = await createBridgedAssessment(schoolId, classId, aliceUserId, {
    title: 'Alice CAT 1', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  assert.ok(aliceAssessment.assessmentId)

  // Before the fix, THIS is the exact call that raised a raw 500 to Brian —
  // his first assessment ever, in a class Alice had already bridged.
  const brianAssessment = await createBridgedAssessment(schoolId, classId, brianUserId, {
    title: 'Brian CAT 1', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['english'], curriculum_type: 'cbc',
  })
  assert.ok(brianAssessment.assessmentId)
  assert.notEqual(brianAssessment.legacyClassId, aliceAssessment.legacyClassId)

  // Each assessment belongs to the correct teacher's own legacy class context.
  const { data: aliceRow } = await db.from('class_assessments').select('class_id').eq('id', aliceAssessment.assessmentId).single()
  const { data: brianRow } = await db.from('class_assessments').select('class_id').eq('id', brianAssessment.assessmentId).single()
  assert.equal(aliceRow?.class_id, aliceAssessment.legacyClassId)
  assert.equal(brianRow?.class_id, brianAssessment.legacyClassId)
})

// ── §14: multiple subjects, SAME teacher — must NOT create a second row ────

test('the same teacher teaching two subjects to the same class still gets ONE legacy class representation, not two', async () => {
  // Alice already bridged for Mathematics above; simulate her also being
  // asked to bridge again (e.g. recording a second subject's assessment in
  // the same Core class) — existing one-legacy-class-per-teacher-per-Core-
  // class contract must hold; subject is not part of bridge identity.
  const first = await ensureBridgedClass(schoolId, classId, aliceUserId)
  const second = await ensureBridgedClass(schoolId, classId, aliceUserId)
  assert.equal(second.legacyClassId, first.legacyClassId)
})

// ── §5/§6: different Core classes remain fully independent ─────────────────

test('a different Core class for the same teacher gets its own independent bridge and class_code', async () => {
  const { data: grade } = await db.from('classes').select('grade_id').eq('id', classId).single()
  const { data: otherClass } = await db.from('classes').insert({
    school_id: schoolId, class_name: 'Other Class', display_name: 'Other Class', grade_id: grade!.grade_id, academic_year_id: academicYearId,
  }).select('id').single()

  const inFirstClass = await ensureBridgedClass(schoolId, classId, aliceUserId)
  const inOtherClass = await ensureBridgedClass(schoolId, otherClass!.id, aliceUserId)

  assert.notEqual(inFirstClass.legacyClassId, inOtherClass.legacyClassId)
  const { data: codes } = await db.from('teacher_classes').select('class_code').in('id', [inFirstClass.legacyClassId, inOtherClass.legacyClassId])
  assert.equal(new Set(codes!.map(c => c.class_code)).size, 2)
})

// ── §9 (continued) / §16: legacy roster convergence under REAL multi-representation ──

test('legacy roster convergence removes a moved learner from ALL stale teacher-owned representations of the vacated class', async () => {
  // Two teachers, Alice and Brian, both bridge 7A (already proven above).
  const aliceBridge = await ensureBridgedClass(schoolId, classId, aliceUserId)
  const brianBridge = await ensureBridgedClass(schoolId, classId, brianUserId)
  assert.notEqual(aliceBridge.legacyClassId, brianBridge.legacyClassId)

  const janeId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-JANE-${Date.now()}`, first_name: 'Jane', last_name: 'Roster',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })).learnerId!

  // Jane bridged once — ensureBridgedLearner rosters her into whichever
  // teacher's legacy class it's called with; called with BOTH here to
  // reflect the real shape (both teachers' gradebooks show her).
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, asLearnerId(janeId), aliceBridge)
  await repos.teachers.upsertLegacyClassRoster(brianBridge.legacyClassId, legacyStudentId)

  const { data: rosterBefore } = await db.from('class_students').select('id, class_id').eq('student_id', legacyStudentId)
  assert.equal(rosterBefore?.length, 2, 'fixture: Jane is on BOTH teachers\' legacy rosters for 7A')

  const { removed } = await removeStaleLegacyRosterMembership(asLearnerId(janeId), classId)
  assert.equal(removed, 2, 'both stale representations removed, not just one')

  const { data: rosterAfter } = await db.from('class_students').select('id').eq('student_id', legacyStudentId)
  assert.equal(rosterAfter?.length, 0, 'Jane is on neither teacher\'s legacy roster for the vacated class')
})

// ── §17: historical integrity — bridging a second teacher touches nothing about the first ──

test('bridging a second teacher does not alter the first teacher\'s existing assessment/marks history', async () => {
  const alice = await createBridgedAssessment(schoolId, classId, aliceUserId, {
    title: 'History Check CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  const janeId = (await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-HIST-${Date.now()}`, first_name: 'Hist', last_name: 'Check',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })).learnerId!
  const aliceBridge = await ensureBridgedClass(schoolId, classId, aliceUserId)
  await recordBridgedMarks(schoolId, alice.assessmentId, aliceBridge, aliceUserId, [
    { coreLearnerId: asLearnerId(janeId), admission_number: 'HIST', student_name: 'Hist Check', subject_scores: { mathematics: 82 }, total_marks: 82, mean_score: 82 },
  ])
  const { data: marksBefore } = await db.from('learner_marks').select('total_marks').eq('assessment_id', alice.assessmentId)

  // Brian bridges AFTER Alice's history already exists.
  await ensureBridgedClass(schoolId, classId, brianUserId)

  const { data: marksAfter } = await db.from('learner_marks').select('total_marks').eq('assessment_id', alice.assessmentId)
  assert.deepEqual(marksAfter, marksBefore, 'Alice\'s marks are byte-for-byte unchanged by Brian\'s bridge creation')
})
