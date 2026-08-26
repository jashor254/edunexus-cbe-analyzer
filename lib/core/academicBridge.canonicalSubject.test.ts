// lib/core/academicBridge.canonicalSubject.test.ts
//
// Phase 3A — Core institutional assessment canonical subject identity.
// Proves `lib/core/academicBridge.ts::createBridgedAssessment`'s new
// `classSubjectId` parameter: canonical subject identity is derived
// server-side from a verified `class_subjects` teaching tenure (never
// client-supplied text), and every tampering/authority surface named in the
// phase spec is closed. Complements (does not duplicate)
// `lib/core/institutionalAssignmentAuthority.test.ts`, which already proves
// the underlying tenure/ended_at/membership/role checks exhaustively for the
// assignment/quiz domain — this file proves the NEW school/class-match
// validation `createBridgedAssessment` layers on top, plus the full
// Assessment -> Evidence -> Projection -> Blueprint chain for Core vs
// Essential Mathematics via the Core/bridged path specifically.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/academicBridge.canonicalSubject.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { ensureBridgedClass, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { createOrUpdateSeniorProgramme } from '@/lib/curriculum/seniorProgramme'
import { composeProgrammeAcademicRecord } from '@/lib/learnerBlueprint/composeProgrammeAcademicRecord'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_3A_ASSESSMENT_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p3a-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function addTeacher(schoolId: string, adminId: string, label: string) {
  const user = await mkUser(label)
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }
}

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db
    .from('class_subjects')
    .select('id')
    .eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

after(async () => {
  for (const id of createdSchoolIds) {
    const { data: csRows } = await db.from('class_subjects').select('id').eq('school_id', id)
    const csIds = (csRows ?? []).map(r => r.id)
    if (csIds.length) await db.from('class_assessments').update({ class_subject_id: null }).in('class_subject_id', csIds)

    const { data: coreLearners } = await db.from('learners').select('id').eq('school_id', id)
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
        await db.from('students').delete().in('id', studentIds)
      }
    }
    const { data: coreClasses } = await db.from('classes').select('id').eq('school_id', id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) {
      const { data: legacyClasses } = await db.from('teacher_classes').select('id').in('external_id', classExternalIds)
      const legacyClassIds = (legacyClasses ?? []).map(c => c.id)
      if (legacyClassIds.length) await db.from('class_assessments').delete().in('class_id', legacyClassIds)
      await db.from('teacher_classes').delete().in('external_id', classExternalIds)
    }
    await db.from('learner_programmes').delete().eq('school_id', id)
  }
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades Core-side rows (classes, class_subjects, school_users, learners)
  }
  for (const id of createdAuthUserIds) {
    const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', id)
    const teacherIds = (teacherRows ?? []).map(t => t.id)
    if (teacherIds.length) {
      // ingestion_runs.teacher_id (legacy `teachers.id`) is a second FK
      // distinct from ingestion_runs.initiated_by (auth.users.id) — both
      // must be cleared before the teachers row itself can be deleted.
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
let otherSchoolId: string
let adminId: string
let otherAdminId: string
let gradeEastId: string
let gradeWestId: string
let otherSchoolClassId: string
let coreMathId: string
let essentialMathId: string
let termId: string
let academicYearId: string

let peter: { userId: string; email: string; membershipId: string }
let mary: { userId: string; email: string; membershipId: string }

let peterCoreMathsCsId: string
let maryEssentialMathsCsId: string

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  const act = await activateSchool(schoolId, { gradeCodes: ['G10'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  academicYearId = classes![0].academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  termId = terms![0].id

  const subjects = await listSubjects('senior_secondary')
  coreMathId = subjects.find(s => s.name === 'Core Mathematics')!.id
  essentialMathId = subjects.find(s => s.name === 'Essential Mathematics')!.id

  const east = await createClass(schoolId, { grade_id: classes![0].grade_id, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 10 East` })
  gradeEastId = east.id
  const west = await createClass(schoolId, { grade_id: classes![0].grade_id, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 10 West` })
  gradeWestId = west.id

  peter = await addTeacher(schoolId, adminId, 'peter')
  mary = await addTeacher(schoolId, adminId, 'mary')

  await assignSubjectTeacher(schoolId, gradeEastId, coreMathId, peter.membershipId)
  peterCoreMathsCsId = await currentClassSubjectId(gradeEastId, coreMathId)

  await assignSubjectTeacher(schoolId, gradeWestId, essentialMathId, mary.membershipId)
  maryEssentialMathsCsId = await currentClassSubjectId(gradeWestId, essentialMathId)

  // A second, unrelated school — cross-school tampering fixture. Peter also
  // teaches Core Mathematics there, holding a second, genuinely independent
  // tenure — the multi-school shape the cross-school test needs (a
  // classSubjectId that is real and Peter's own, but at the WRONG school).
  const otherAdmin = await mkUser('other-admin')
  otherAdminId = otherAdmin.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdminId)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdminId, 'school_admin')
  const otherAct = await activateSchool(otherSchoolId, { gradeCodes: ['G10'] })
  if (otherAct.status !== 'complete') throw new Error(`fixture activation failed (other school): ${otherAct.error}`)
  const { data: otherClasses } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', otherSchoolId).limit(1)
  otherSchoolClassId = otherClasses![0].id
  await repos.schools.addSchoolUser(otherSchoolId, peter.userId, 'teacher')
  const peterOtherSchoolMembership = (await repos.teachers.findSchoolUser(peter.userId, otherSchoolId))!.id
  await assignSubjectTeacher(otherSchoolId, otherSchoolClassId, coreMathId, peterOtherSchoolMembership)
})

// ── Core Mathematics acceptance: identity, non-STEM pathway, full chain ────

test('Core Mathematics: canonical identity stored server-side, non-STEM pathway does not block it, chain reaches Blueprint without Essential contamination', async () => {
  const learner = await onboardLearner(schoolId, {
    admission_number: `P3A-CORE-${Date.now()}`,
    first_name: 'Core',
    last_name: 'Learner',
    class_id: gradeEastId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: 'Core Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (learner.status !== 'complete') throw new Error(`fixture enrollment failed: ${learner.error}`)
  const learnerId = asLearnerId(learner.learnerId!)

  // Deliberately Social Sciences, not STEM — the exact regression Phase 3
  // exists to prevent (Core Mathematics must never require a STEM pathway).
  await createOrUpdateSeniorProgramme({
    learnerId, schoolId, academicYearId,
    pathway: 'Social Sciences', source: 'admin_entry',
    subjects: [{ subjectId: coreMathId, role: 'exception' }],
  })

  const { assessmentId, legacyClassId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Mid-Term Assessment', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )

  const { data: row } = await db.from('class_assessments').select('class_subject_id, subject_id, subjects').eq('id', assessmentId).single()
  assert.equal(row!.class_subject_id, peterCoreMathsCsId)
  assert.equal(row!.subject_id, coreMathId)
  assert.deepEqual(row!.subjects, ['Core Mathematics'])

  const bridgedClass = await ensureBridgedClass(schoolId, gradeEastId, peter.userId)
  assert.equal(bridgedClass.legacyClassId, legacyClassId)

  const { legacyStudentIds } = await recordBridgedMarks(schoolId, assessmentId, bridgedClass, peter.userId, [
    {
      coreLearnerId: learnerId, admission_number: 'P3A-CORE', student_name: 'Core Learner',
      // A stray Essential Mathematics key on the SAME mark row — proves
      // cross-contamination cannot happen even when both are present in one
      // ingestion batch (Phase 3A Step 21/Case A/B).
      subject_scores: { core_mathematics: 88, essential_mathematics: 61 },
      total_marks: 88, mean_score: 88,
    },
  ])
  const legacyStudentId = legacyStudentIds[0]

  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  const coreEvidence = evidence.find(e => e.subject === 'core_mathematics')
  assert.ok(coreEvidence, 'Core Mathematics assessment must survive into learner_evidence.subject = core_mathematics, not "mathematics"')

  const record = await composeProgrammeAcademicRecord(learnerId, legacyStudentId)
  assert.equal(record.status, 'available')
  assert.equal(record.data!.programmeStatus, 'canonical')
  const coreCard = record.data!.bySubject.find(s => s.subject === 'Core Mathematics')
  assert.ok(coreCard, 'Core Mathematics evidence must reach the programme-aware Blueprint subject')
  assert.equal(coreCard!.evidenceCount, 1)
  assert.ok(!record.data!.bySubject.some(s => s.subject === 'Essential Mathematics'), 'Essential Mathematics evidence must not contaminate the Core Mathematics programme')
  assert.ok(record.data!.unattributedEvidenceSubjects.includes('essential_mathematics'), 'Essential Mathematics evidence is surfaced as unattributed, not silently dropped or merged')
})

// ── Essential Mathematics acceptance ────────────────────────────────────────

test('Essential Mathematics: canonical identity stored server-side, distinct from Core', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeWestId, mary.userId,
    { title: 'Mid-Term Assessment', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    maryEssentialMathsCsId,
  )
  const { data: row } = await db.from('class_assessments').select('class_subject_id, subject_id, subjects').eq('id', assessmentId).single()
  assert.equal(row!.class_subject_id, maryEssentialMathsCsId)
  assert.equal(row!.subject_id, essentialMathId)
  assert.notEqual(row!.subject_id, coreMathId)
  assert.deepEqual(row!.subjects, ['Essential Mathematics'])
})

// ── Programme-unresolved learner ────────────────────────────────────────────

test('programme-unresolved learner: canonical assessment identity does not require, and does not fabricate, a learner programme', async () => {
  const before = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)

  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Unresolved-Learner CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const { data: row } = await db.from('class_assessments').select('subject_id').eq('id', assessmentId).single()
  assert.equal(row!.subject_id, coreMathId, 'teaching authority alone establishes canonical identity — no programme required')

  const after = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
  assert.equal(after.count, before.count, 'assessment creation must never create a learner_programme row')
})

// ── Subject tampering ────────────────────────────────────────────────────────

test('subject tampering: contradictory client subject text is ignored, server-derived canonical identity wins', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Tamper Attempt', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['Essential Mathematics — FAKE'], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const { data: row } = await db.from('class_assessments').select('subject_id, subjects').eq('id', assessmentId).single()
  assert.equal(row!.subject_id, coreMathId)
  assert.deepEqual(row!.subjects, ['Core Mathematics'], 'client-submitted subject text must never override the verified classSubjectId')
})

// ── Class tampering ──────────────────────────────────────────────────────────

test('class tampering: classSubjectId for Grade 10 East cannot authorize an assessment declared against Grade 10 West', async () => {
  const before = await db.from('class_assessments').select('id', { count: 'exact', head: true }).eq('class_subject_id', peterCoreMathsCsId)

  await assert.rejects(
    () => createBridgedAssessment(
      schoolId, gradeWestId, peter.userId,
      { title: 'Class Mismatch', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
      peterCoreMathsCsId,
    ),
    ResourceOwnershipError,
  )

  const after = await db.from('class_assessments').select('id', { count: 'exact', head: true }).eq('class_subject_id', peterCoreMathsCsId)
  assert.equal(after.count, before.count, 'a rejected class-mismatch request must create no assessment row')
})

// ── Cross-school tampering ───────────────────────────────────────────────────

test('cross-school tampering: a genuine tenure at School B cannot authorize an assessment declared under School A', async () => {
  const otherSchoolCsId = await currentClassSubjectId(otherSchoolClassId, coreMathId)

  await assert.rejects(
    () => createBridgedAssessment(
      schoolId, gradeEastId, peter.userId,
      { title: 'Cross-School Attempt', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
      otherSchoolCsId,
    ),
    ResourceOwnershipError,
  )
})

// ── Unrelated teacher ────────────────────────────────────────────────────────

test('unrelated teacher: Mary cannot create an assessment against Peter\'s Core Mathematics tenure', async () => {
  await assert.rejects(
    () => createBridgedAssessment(
      schoolId, gradeEastId, mary.userId,
      { title: 'Unrelated Teacher Attempt', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
      peterCoreMathsCsId,
    ),
    ResourceOwnershipError,
  )
})

// ── Ended assignment / teacher replacement / history ────────────────────────

test('teacher replacement: an ended tenure cannot authorize a new assessment; historical assessments keep their original creator and tenure', async () => {
  const { assessmentId: assessmentA } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Assessment A (Peter)', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )

  // Mary replaces Peter on Grade 10 East Core Mathematics -> closes Peter's tenure.
  await assignSubjectTeacher(schoolId, gradeEastId, coreMathId, mary.membershipId)
  const maryCoreMathsCsId = await currentClassSubjectId(gradeEastId, coreMathId)
  assert.notEqual(maryCoreMathsCsId, peterCoreMathsCsId)

  // Peter's now-ended tenure no longer authorizes a NEW assessment.
  await assert.rejects(
    () => createBridgedAssessment(
      schoolId, gradeEastId, peter.userId,
      { title: 'Attempted After Departure', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
      peterCoreMathsCsId,
    ),
    ResourceOwnershipError,
  )

  // Mary's new tenure creates Assessment B, same canonical subject.
  const { assessmentId: assessmentB } = await createBridgedAssessment(
    schoolId, gradeEastId, mary.userId,
    { title: 'Assessment B (Mary)', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    maryCoreMathsCsId,
  )

  const { data: rowA } = await db.from('class_assessments').select('class_subject_id, subject_id, teacher_id').eq('id', assessmentA).single()
  const { data: rowB } = await db.from('class_assessments').select('class_subject_id, subject_id, teacher_id').eq('id', assessmentB).single()

  assert.equal(rowA!.class_subject_id, peterCoreMathsCsId, 'Assessment A must never be reassigned to Mary\'s tenure')
  assert.equal(rowB!.class_subject_id, maryCoreMathsCsId)
  assert.equal(rowA!.subject_id, coreMathId)
  assert.equal(rowB!.subject_id, coreMathId, 'canonical subject identity is unchanged across the teacher replacement')
  assert.notEqual(rowA!.teacher_id, rowB!.teacher_id, 'the legacy creator identity is not repointed to the replacement teacher')
})

// ── Backward compatibility: omitted classSubjectId is unaffected ───────────

test('legacy compatibility: omitting classSubjectId reproduces pre-Phase-3A free-text behaviour exactly', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Legacy Free-Text Assessment', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc' },
    // classSubjectId omitted entirely
  )
  const { data: row } = await db.from('class_assessments').select('class_subject_id, subject_id, subjects').eq('id', assessmentId).single()
  assert.equal(row!.class_subject_id, null)
  assert.equal(row!.subject_id, null)
  assert.deepEqual(row!.subjects, ['Mathematics'], 'free-text subject is stored unchanged when no canonical tenure is supplied — legacy readers unaffected')
})
