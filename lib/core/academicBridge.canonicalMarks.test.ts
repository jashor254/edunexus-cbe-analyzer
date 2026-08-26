// lib/core/academicBridge.canonicalMarks.test.ts
//
// Phase 3C — proves `recordCanonicalAssessmentMarks`/`getCanonicalAssessmentMarksView`
// (lib/core/academicBridge.ts), the domain layer behind
// `app/api/core/assessments/[assessmentId]/marks` and the new
// `app/teacher/assessments/[assessmentId]/marks` page. Complements (does
// not duplicate) `academicBridge.canonicalSubject.test.ts` (Phase 3A —
// assessment CREATION identity/tampering) and
// `institutionalAssignmentAuthority.test.ts` (the shared tenure primitive).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/academicBridge.canonicalMarks.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordCanonicalAssessmentMarks, getCanonicalAssessmentMarksView } from '@/lib/core/academicBridge'
import { createOrUpdateSeniorProgramme } from '@/lib/curriculum/seniorProgramme'
import { composeProgrammeAcademicRecord } from '@/lib/learnerBlueprint/composeProgrammeAcademicRecord'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_3C_MARKS_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p3c-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  const { data, error } = await db.from('class_subjects').select('id').eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

async function admit(schoolId: string, classId: string, termId: string, academicYearId: string, label: string) {
  const result = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    first_name: label,
    last_name: 'Learner',
    class_id: classId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: `${label} Guardian`, phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (result.status !== 'complete') throw new Error(`fixture enrollment failed: ${result.error}`)
  return asLearnerId(result.learnerId!)
}

after(async () => {
  for (const id of createdSchoolIds) {
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
let gradeEastId: string
let gradeWestId: string
let gradeNineId: string
let coreMathId: string
let essentialMathId: string
let juniorMathId: string
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
  const act = await activateSchool(schoolId, { gradeCodes: ['G9', 'G10'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id, grades(code)').eq('school_id', schoolId)
  const g9Class = classes!.find(c => (c.grades as unknown as { code: string } | null)?.code === 'G9')!
  const g10Class = classes!.find(c => (c.grades as unknown as { code: string } | null)?.code === 'G10')!
  gradeNineId = g9Class.id
  academicYearId = g10Class.academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).eq('is_current', true).limit(1)
  termId = terms![0].id

  const juniorSubjects = await listSubjects('junior_secondary')
  juniorMathId = juniorSubjects.find(s => s.name === 'Mathematics')!.id
  const seniorSubjects = await listSubjects('senior_secondary')
  coreMathId = seniorSubjects.find(s => s.name === 'Core Mathematics')!.id
  essentialMathId = seniorSubjects.find(s => s.name === 'Essential Mathematics')!.id

  const east = await createClass(schoolId, { grade_id: g10Class.grade_id, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 10 East` })
  gradeEastId = east.id
  const west = await createClass(schoolId, { grade_id: g10Class.grade_id, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 10 West` })
  gradeWestId = west.id

  peter = await addTeacher(schoolId, adminId, 'peter')
  mary = await addTeacher(schoolId, adminId, 'mary')

  await assignSubjectTeacher(schoolId, gradeEastId, coreMathId, peter.membershipId)
  peterCoreMathsCsId = await currentClassSubjectId(gradeEastId, coreMathId)
  await assignSubjectTeacher(schoolId, gradeWestId, essentialMathId, mary.membershipId)
  maryEssentialMathsCsId = await currentClassSubjectId(gradeWestId, essentialMathId)
  await assignSubjectTeacher(schoolId, gradeNineId, juniorMathId, peter.membershipId)
})

test('Core Mathematics: marks save reaches Evidence, Projection, and programme-aware Blueprint; Essential Mathematics does not contaminate it', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Mid-Term', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'CoreA')
  await createOrUpdateSeniorProgramme({
    learnerId, schoolId, academicYearId, pathway: 'Social Sciences', source: 'admin_entry',
    subjects: [{ subjectId: coreMathId, role: 'exception' }],
  })

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 88 }])
  assert.deepEqual(result.rejected, [])
  assert.deepEqual(result.saved, [learnerId])

  const legacyStudentId = (await resolveLegacyStudentId(learnerId))!
  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  const coreEvidence = evidence.find(e => e.subject === 'core_mathematics')
  assert.ok(coreEvidence, 'must produce learner_evidence.subject = core_mathematics, not "mathematics"')

  const record = await composeProgrammeAcademicRecord(learnerId, legacyStudentId)
  assert.equal(record.status, 'available')
  const coreCard = record.data!.bySubject.find(s => s.subject === 'Core Mathematics')
  assert.ok(coreCard, 'Core Mathematics marks must reach the programme-aware Blueprint subject')
  assert.equal(coreCard!.evidenceCount, 1)

  // Existing-scores read-back — the marks page must show what was just saved.
  const view = await getCanonicalAssessmentMarksView(schoolId, assessmentId)
  if (view.kind !== 'canonical') throw new Error('expected canonical view')
  const rosterEntry = view.roster.find(r => r.coreLearnerId === learnerId)
  assert.equal(rosterEntry?.existingScore, 88)
  assert.equal(rosterEntry?.programmeStatus, 'matched')
})

test('Essential Mathematics: distinct subject, own class', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeWestId, mary.userId,
    { title: 'Mid-Term', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    maryEssentialMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeWestId, termId, academicYearId, 'EssA')

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, mary.userId, [{ coreLearnerId: learnerId, score: 74 }])
  assert.deepEqual(result.saved, [learnerId])

  const legacyStudentId = (await resolveLegacyStudentId(learnerId))!
  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  assert.ok(evidence.some(e => e.subject === 'essential_mathematics'))
  assert.ok(!evidence.some(e => e.subject === 'core_mathematics'))
})

test('programme-unresolved learner is allowed (transitional), never fabricates a programme', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Unresolved-Learner CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Unresolved')
  const before = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 60 }])
  assert.deepEqual(result.saved, [learnerId])
  assert.deepEqual(result.rejected, [])

  const after = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
  assert.equal(after.count, before.count, 'marks entry must never create a learner_programme row')
})

test('explicit programme mismatch is rejected, not silently scored', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Mismatch CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Mismatch')
  await createOrUpdateSeniorProgramme({
    learnerId, schoolId, academicYearId, pathway: 'STEM', source: 'admin_entry',
    subjects: [{ subjectId: essentialMathId, role: 'exception' }], // programme explicitly does NOT include Core Mathematics
  })

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 90 }])
  assert.deepEqual(result.saved, [])
  assert.equal(result.rejected.length, 1)
  assert.equal(result.rejected[0].reason, 'programme_mismatch')

  const legacyStudentId = await resolveLegacyStudentId(learnerId)
  const evidence = legacyStudentId ? await repos.evidence.findByLearner(legacyStudentId) : []
  assert.ok(!evidence.some(e => e.subject === 'core_mathematics'), 'a mismatched learner must not receive Core Mathematics evidence')
})

test('Grade 9 roster: no Senior programme check runs at all, marks save normally', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeNineId, peter.userId,
    { title: 'G9 CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    (await currentClassSubjectId(gradeNineId, juniorMathId)),
  )
  const learnerId = await admit(schoolId, gradeNineId, termId, academicYearId, 'G9A')

  const view = await getCanonicalAssessmentMarksView(schoolId, assessmentId)
  if (view.kind !== 'canonical') throw new Error('expected canonical view')
  assert.equal(view.roster.find(r => r.coreLearnerId === learnerId)?.programmeStatus, 'not_applicable')

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 70 }])
  assert.deepEqual(result.saved, [learnerId])
})

test('a learner not on the current class roster is rejected, not saved', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Roster CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  // Enrolled in the WEST class, not East — must not be scorable against an East assessment.
  const foreignLearnerId = await admit(schoolId, gradeWestId, termId, academicYearId, 'Foreign')

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: foreignLearnerId, score: 50 }])
  assert.deepEqual(result.saved, [])
  assert.equal(result.rejected[0].reason, 'not_on_roster')
})

test('score bounds: out-of-range marks are rejected per-learner; the rest of the batch still saves (partial entry)', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Bounds CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const goodLearner = await admit(schoolId, gradeEastId, termId, academicYearId, 'Good')
  const negLearner = await admit(schoolId, gradeEastId, termId, academicYearId, 'Neg')
  const overLearner = await admit(schoolId, gradeEastId, termId, academicYearId, 'Over')

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [
    { coreLearnerId: goodLearner, score: 75 },
    { coreLearnerId: negLearner, score: -5 },
    { coreLearnerId: overLearner, score: 150 },
  ])
  assert.deepEqual(result.saved, [goodLearner])
  assert.equal(result.rejected.length, 2)
  assert.ok(result.rejected.every(r => r.reason === 'score_out_of_range'))
})

test('duplicate learner id in one payload is rejected outright', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Dup CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Dup')

  await assert.rejects(
    () => recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [
      { coreLearnerId: learnerId, score: 50 },
      { coreLearnerId: learnerId, score: 90 },
    ]),
  )
})

test('legacy assessment (no canonical subject) is refused by the canonical marks path', async () => {
  const bridgedNoSubject = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Legacy CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc' },
    // classSubjectId omitted -> legacy free-text assessment
  )
  const view = await getCanonicalAssessmentMarksView(schoolId, bridgedNoSubject.assessmentId)
  assert.equal(view.kind, 'legacy')

  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'LegacyLearner')
  await assert.rejects(
    () => recordCanonicalAssessmentMarks(schoolId, bridgedNoSubject.assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 50 }]),
    ResourceOwnershipError,
  )
})

test('teacher replacement: a departed teacher cannot save marks; the current subject teacher can, into the same assessment', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Replacement CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'ReplA')

  // Mary replaces Peter on Grade 10 East Core Mathematics.
  await assignSubjectTeacher(schoolId, gradeEastId, coreMathId, mary.membershipId)

  await assert.rejects(
    () => recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 80 }]),
    ResourceOwnershipError,
    'Peter no longer holds the current tenure for this class+subject',
  )

  const result = await recordCanonicalAssessmentMarks(schoolId, assessmentId, mary.userId, [{ coreLearnerId: learnerId, score: 80 }])
  assert.deepEqual(result.saved, [learnerId], 'Mary, the current subject teacher, may manage the existing assessment even though Peter created it')
})

test('score correction: re-saving a corrected mark reflects the new value; the original assessment creator history is untouched', async () => {
  // The prior test reassigned Grade 10 East Core Mathematics to Mary —
  // resolve whoever CURRENTLY holds it rather than the (by now ended)
  // `peterCoreMathsCsId` fixture variable.
  const currentCsId = await currentClassSubjectId(gradeEastId, coreMathId)
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, mary.userId,
    { title: 'Correction CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    currentCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Correction')

  await recordCanonicalAssessmentMarks(schoolId, assessmentId, mary.userId, [{ coreLearnerId: learnerId, score: 45 }])
  await recordCanonicalAssessmentMarks(schoolId, assessmentId, mary.userId, [{ coreLearnerId: learnerId, score: 78 }])

  const legacyStudentId = (await resolveLegacyStudentId(learnerId))!
  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  const coreEntries = evidence.filter(e => e.subject === 'core_mathematics')
  // Existing platform correction/supersession architecture (Phase E4,
  // lib/intelligence/correctionKey.ts) — a genuine correction keeps ONE
  // correction identity across two rows (original superseded, correction
  // auto_confirmed). Reused unmodified; this test proves Phase 3C's writer
  // participates in it correctly, not that the mechanism itself changed.
  assert.equal(coreEntries.length, 2, 'a correction produces the original plus the corrected row, not a silent overwrite')
  const confirmed = coreEntries.find(e => e.lifecycle_state === 'auto_confirmed' || e.lifecycle_state === 'reviewed_confirmed')
  assert.equal(confirmed?.score, 78, 'the currently-confirmed row reflects the corrected value')

  const view = await getCanonicalAssessmentMarksView(schoolId, assessmentId)
  if (view.kind !== 'canonical') throw new Error('expected canonical view')
  assert.equal(view.roster.find(r => r.coreLearnerId === learnerId)?.existingScore, 78, 'the marks page must show the corrected value, not the original')
})
