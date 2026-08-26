// lib/learnerBlueprint/composeProgrammeAcademicRecord.integration.test.ts
//
// Real-DB integration tests against DISPOSABLE LOCAL DOCKER SUPABASE ONLY.
// Same convention as lib/curriculum/seniorProgramme.integration.test.ts and
// lib/core/learnerIdentityConvergence.integration.test.ts — this file calls
// functions built on createServiceClient() (NEXT_PUBLIC_SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY), not createTestServiceClient().
//
// Run (example, local Supabase CLI default ports):
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   npx tsx --experimental-test-module-mocks --test lib/learnerBlueprint/composeProgrammeAcademicRecord.integration.test.ts
//
// Proves the Phase 2 mandatory acceptance case: a real Grade 10 learner with
// a canonical Social Sciences + Core Mathematics programme, real evidence
// for some subjects (including the audited Kiswahili/Kiswahili Lugha alias
// split), zero evidence for CSL, ambiguous generic Mathematics evidence, and
// evidence for a subject NOT in the current programme.

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { extractProjectRef, KNOWN_PRODUCTION_PROJECT_REF } from '@/utils/supabase/productionRef'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { createOrUpdateSeniorProgramme } from '@/lib/curriculum/seniorProgramme'
import { composeProgrammeAcademicRecord } from './composeProgrammeAcademicRecord'

const resolvedRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
if (resolvedRef === KNOWN_PRODUCTION_PROJECT_REF) {
  throw new Error('composeProgrammeAcademicRecord.integration.test.ts: refusing to run against the known production project.')
}

const db = createServiceClient()
const SYNTHETIC_MARKER = 'SYNTHETIC_P2_PROGRAMME_BLUEPRINT'

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []
const createdLearnerIds: string[] = []
const bridgedClassExternalIds: string[] = []
const bridgedLearnerExternalIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function subjectByCode(code: string): Promise<{ id: string; name: string }> {
  const { data, error } = await db.from('subjects').select('id, name').eq('code', code).single()
  if (error || !data) throw new Error(`fixture subject ${code} not found: ${error?.message}`)
  return data
}

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (bridgedLearnerExternalIds.length) {
    const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', bridgedLearnerExternalIds)
    const studentIds = (bridgedStudents ?? []).map(s => s.id)
    if (studentIds.length) {
      const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
      const evidenceIds = (evidenceRows ?? []).map(e => e.id)
      if (evidenceIds.length) {
        await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds))
        await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds))
      }
      await safely(() => db.from('learner_evidence').delete().in('learner_id', studentIds))
      await safely(() => db.from('learner_projections').delete().in('learner_id', studentIds))
      await safely(() => db.from('learner_marks').delete().in('student_id', studentIds))
      await safely(() => db.from('students').delete().in('id', studentIds))
    }
  }
  if (bridgedClassExternalIds.length) await safely(() => db.from('teacher_classes').delete().in('external_id', bridgedClassExternalIds))
  // learner_programmes/learner_programme_subjects cascade from learners —
  // deleted explicitly (not relied on via schools cascade, which learners
  // does NOT participate in: learners.school_id has no ON DELETE CASCADE,
  // so deleting schools first while learners rows remain fails the FK
  // check and is silently swallowed by safely() below, leaking rows).
  if (createdLearnerIds.length) await safely(() => db.from('learners').delete().in('id', createdLearnerIds))
  for (const id of createdSchoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of createdAuthUserIds) {
    await safely(() => db.from('teachers').delete().eq('user_id', id))
    await safely(() => db.from('profiles').delete().eq('id', id))
    await safely(() => db.auth.admin.deleteUser(id))
  }
})

test('mandatory synthetic Grade 10 acceptance: programme truth + evidence reconciliation, never the other way around', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${SYNTHETIC_MARKER}-${Date.now()}`,
    first_name: 'Grade10', last_name: 'Acceptance',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Acceptance Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(enroll.status, 'complete')
  const learnerId = enroll.learnerId!
  createdLearnerIds.push(learnerId)
  const coreLearnerId = asLearnerId(learnerId)

  // ── Programme truth: Social Sciences + Core Mathematics + Kiswahili +
  // English + CSL. Deliberately does NOT include Business Studies — that
  // will be the "evidence exists, not a current subject" case.
  const [kiswahili, english, csl, coreMath] = await Promise.all([
    subjectByCode('SS-KIS'), subjectByCode('SS-ENG'), subjectByCode('SS-CSL'), subjectByCode('SS-MATH-CORE'),
  ])

  await createOrUpdateSeniorProgramme({
    learnerId: coreLearnerId,
    schoolId: school.id,
    academicYearId,
    pathway: 'Social Sciences',
    source: 'admin_entry',
    subjects: [
      { subjectId: kiswahili.id, role: 'compulsory' },
      { subjectId: english.id, role: 'compulsory' },
      { subjectId: csl.id, role: 'compulsory' },
      { subjectId: coreMath.id, role: 'exception', reason: 'approved_exception' },
    ],
  })

  // ── Real Evidence, via the actual teacher-gradebook pipeline (proves the
  // read side against real production write-path behavior, including the
  // subject-key normalization that pipeline already applies).
  const teacherUser = await mkAuthUser('teacher')
  const invite = await inviteTeacher(school.id, teacherUser.email, admin.id)
  assert.equal(invite.status, 'invited')
  const accept = await acceptTeacherInvitation(teacherUser.id, school.id, { full_name: 'Acceptance Teacher' })
  assert.equal(accept.status, 'accepted')

  bridgedClassExternalIds.push(classId)
  bridgedLearnerExternalIds.push(learnerId)
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacherUser.id)
  const { legacyStudentId } = await ensureBridgedLearner(school.id, coreLearnerId, bridgedClass)

  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacherUser.id, {
    title: `${SYNTHETIC_MARKER} Term 1 Exam`,
    assessment_type: 'exam',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
    subjects: ['kiswahili', 'kiswahili_lugha', 'english', 'mathematics', 'essential_mathematics', 'business_studies'],
    curriculum_type: 'cbc',
  })

  await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacherUser.id, [{
    coreLearnerId,
    admission_number: `${SYNTHETIC_MARKER}-${Date.now()}`,
    student_name: 'Grade10 Acceptance',
    subject_scores: {
      kiswahili: 72,             // deterministic Kiswahili alias #1
      kiswahili_lugha: 78,       // deterministic Kiswahili alias #2 (the audited slug split)
      english: 65,                // straightforward current-subject evidence
      mathematics: 55,            // generic — must NOT attribute to Core Mathematics
      essential_mathematics: 60,  // explicit different variant — must NOT attribute to Core Mathematics either
      business_studies: 80,       // NOT a current programme subject
    },
    total_marks: 410,
    mean_score: 68,
  }])

  // ── Read-only proof, baseline: capture programme table counts BEFORE composing.
  const countBefore = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('learner_id', learnerId)
  const subjCountBefore = await db.from('learner_programme_subjects').select('id', { count: 'exact', head: true })

  const record = await composeProgrammeAcademicRecord(coreLearnerId, legacyStudentId)

  // ── Read-only proof, after.
  const countAfter = await db.from('learner_programmes').select('id', { count: 'exact', head: true }).eq('learner_id', learnerId)
  const subjCountAfter = await db.from('learner_programme_subjects').select('id', { count: 'exact', head: true })
  assert.equal(countAfter.count, countBefore.count, 'composing the Blueprint academic record must never write to learner_programmes')
  assert.equal(subjCountAfter.count, subjCountBefore.count, 'composing the Blueprint academic record must never write to learner_programme_subjects')

  assert.equal(record.status, 'available')
  const data = record.data!
  assert.equal(data.programmeStatus, 'canonical')
  assert.equal(data.source, 'canonical_programme')

  // Kiswahili: ONE current subject card, evidence from BOTH aliases merged.
  const kiswahiliCards = data.bySubject.filter(s => s.subject === 'Kiswahili')
  assert.equal(kiswahiliCards.length, 1, 'Kiswahili must appear exactly once, not once per raw evidence alias')
  assert.equal(kiswahiliCards[0].evidenceCount, 2, 'both kiswahili and kiswahili_lugha evidence rows must contribute to the one Kiswahili card')

  // English: ordinary current subject with evidence.
  const englishCard = data.bySubject.find(s => s.subject === 'English')
  assert.ok(englishCard, 'English must appear as a current subject with evidence')
  assert.equal(englishCard!.evidenceCount, 1)

  // CSL: programme subject, zero evidence — present as insufficient, never fabricated, never absent.
  assert.equal(data.bySubject.some(s => s.subject === 'Community Service Learning'), false, 'CSL must never appear in bySubject with an invented level')
  assert.ok(
    data.evidenceInsufficientSubjects?.some(s => s.subject === 'Community Service Learning'),
    'CSL must appear as a programme subject with insufficient evidence'
  )

  // Core Mathematics: programme subject, present, but NOT attributed from
  // generic 'mathematics' evidence and NOT from 'essential_mathematics' evidence.
  assert.equal(data.bySubject.some(s => s.subject === 'Core Mathematics'), false, 'Core Mathematics must not show a fabricated/borrowed score')
  assert.ok(
    data.evidenceInsufficientSubjects?.some(s => s.subject === 'Core Mathematics'),
    'Core Mathematics must appear as a programme subject with insufficient (unattributed) evidence'
  )

  // Generic mathematics and essential_mathematics evidence must be visible
  // as unattributed, not silently dropped and not silently misattributed.
  assert.ok(data.unattributedEvidenceSubjects?.includes('mathematics'))
  assert.ok(data.unattributedEvidenceSubjects?.includes('essential_mathematics'))

  // Business Studies: real evidence exists, but it is NOT a current
  // programme subject — must not appear in bySubject at all.
  assert.equal(data.bySubject.some(s => s.subject === 'Business Studies'), false)
  assert.ok(data.unattributedEvidenceSubjects?.includes('business_studies'), 'non-current-subject evidence must be visible as unattributed, not silently discarded')
})

test('Senior learner with unresolved programme falls back to an explicitly-labeled legacy evidence view, never masquerading as programme truth', async () => {
  const admin = await mkAuthUser('admin2')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_unresolved_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${SYNTHETIC_MARKER}-u-${Date.now()}`,
    first_name: 'Unresolved', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Unresolved Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  assert.equal(enroll.status, 'complete')
  const learnerId = enroll.learnerId!
  createdLearnerIds.push(learnerId)
  const coreLearnerId = asLearnerId(learnerId)

  // No senior programme created for this learner — deliberately.

  const teacherUser = await mkAuthUser('teacher2')
  await inviteTeacher(school.id, teacherUser.email, admin.id)
  await acceptTeacherInvitation(teacherUser.id, school.id, { full_name: 'Unresolved Teacher' })

  bridgedClassExternalIds.push(classId)
  bridgedLearnerExternalIds.push(learnerId)
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacherUser.id)
  const { legacyStudentId } = await ensureBridgedLearner(school.id, coreLearnerId, bridgedClass)

  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacherUser.id, {
    title: `${SYNTHETIC_MARKER} Unresolved CAT`,
    assessment_type: 'cat',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
    subjects: ['geography'],
    curriculum_type: 'cbc',
  })
  await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacherUser.id, [{
    coreLearnerId,
    admission_number: `${SYNTHETIC_MARKER}-u-${Date.now()}`,
    student_name: 'Unresolved Learner',
    subject_scores: { geography: 70 },
    total_marks: 70,
    mean_score: 70,
  }])

  const record = await composeProgrammeAcademicRecord(coreLearnerId, legacyStudentId)

  assert.equal(record.status, 'available')
  assert.equal(record.data?.programmeStatus, 'unresolved')
  assert.equal(record.data?.source, 'legacy_evidence_view')
  // The legacy view may still show evidence-derived subjects, but callers
  // must check `source` before ever treating this as the learner's current
  // programme — this is proven by the tag being present, not by hiding data.
  assert.ok(record.data?.bySubject.some(s => s.subject === 'geography'))
})

test('Phase 2A regression: explicit Core Mathematics evidence (real ingestion) attributes to the Core Mathematics programme subject, and Essential Mathematics evidence does not contaminate it', async () => {
  const admin = await mkAuthUser('admin3')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_math_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${SYNTHETIC_MARKER}-math-${Date.now()}`,
    first_name: 'Math', last_name: 'Regression',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Math Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  assert.equal(enroll.status, 'complete')
  const learnerId = enroll.learnerId!
  createdLearnerIds.push(learnerId)
  const coreLearnerId = asLearnerId(learnerId)

  const coreMath = await subjectByCode('SS-MATH-CORE')
  await createOrUpdateSeniorProgramme({
    learnerId: coreLearnerId,
    schoolId: school.id,
    academicYearId,
    pathway: 'STEM',
    source: 'admin_entry',
    subjects: [{ subjectId: coreMath.id, role: 'compulsory' }],
  })

  const teacherUser = await mkAuthUser('teacher3')
  await inviteTeacher(school.id, teacherUser.email, admin.id)
  await acceptTeacherInvitation(teacherUser.id, school.id, { full_name: 'Math Teacher' })

  bridgedClassExternalIds.push(classId)
  bridgedLearnerExternalIds.push(learnerId)
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacherUser.id)
  const { legacyStudentId } = await ensureBridgedLearner(school.id, coreLearnerId, bridgedClass)

  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacherUser.id, {
    title: `${SYNTHETIC_MARKER} Math Exam`,
    assessment_type: 'exam',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
    // Real production subject keys a teacher's gradebook would send for
    // each variant — proves the Phase 2A ingestion fix, not a synthetic
    // canonical string.
    subjects: ['core_mathematics', 'essential_mathematics'],
    curriculum_type: 'cbc',
  })
  await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacherUser.id, [{
    coreLearnerId,
    admission_number: `${SYNTHETIC_MARKER}-math-${Date.now()}`,
    student_name: 'Math Regression',
    subject_scores: { core_mathematics: 88, essential_mathematics: 61 },
    total_marks: 149,
    mean_score: 74.5,
  }])

  const record = await composeProgrammeAcademicRecord(coreLearnerId, legacyStudentId)
  assert.equal(record.status, 'available')
  const data = record.data!

  const coreMathCard = data.bySubject.find(s => s.subject === 'Core Mathematics')
  assert.ok(coreMathCard, 'Core Mathematics must show real, attributed evidence now that ingestion preserves its identity')
  assert.equal(coreMathCard!.evidenceCount, 1)
  assert.ok(coreMathCard!.latestLevel >= 3, `expected a high CBC level for an 88% score, got ${coreMathCard!.latestLevel}`)

  // Essential Mathematics evidence exists (61) but is NOT a programme
  // subject here — must not appear as a current subject, and must not have
  // leaked into Core Mathematics' evidence either (evidenceCount stayed 1).
  assert.equal(data.bySubject.some(s => s.subject === 'Essential Mathematics'), false)
  assert.ok(data.unattributedEvidenceSubjects?.includes('essential_mathematics'))
})
