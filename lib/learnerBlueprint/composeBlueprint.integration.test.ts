// lib/learnerBlueprint/composeBlueprint.integration.test.ts
//
// Sprint 12G proved, against real synthetic Supabase data, that the
// Composition Engine actually reads Core (Identity, Attendance) and
// degrades every other section gracefully when no legacy `students`
// identity is bridged (learner-record-layer-decisions.md Decision 3), and
// that one domain failing (a nonexistent learner) never throws.
//
// Sprint 12H closes the "known test-coverage limitation" Sprint 12G flagged
// honestly at the time (the `available` code path for Academic Record/
// Compass/Career was never exercised, since no learner had a bridged legacy
// identity): the third test below uses lib/core/academicBridge.ts's own
// existing ensureBridgedClass/ensureBridgedLearner to create a real bridge,
// then proves composeBlueprint's internal call to the new canonical
// lib/core/identity.ts::resolveLegacyStudentId() actually resolves it — the
// legacy-space sections stop being unavailable-for-lack-of-bridge and
// genuinely attempt their real domain calls.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerBlueprint/composeBlueprint.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createAttendanceSession, bulkRecordAttendance } from '@/lib/core/attendance'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { createClient as createAnonClient, type SupabaseClient } from '@supabase/supabase-js'
import { createDraft as createReflectionDraft, publish as publishReflection } from '@/lib/teacherReflection/reflection'
import { composeBlueprint } from './composeBlueprint'

const SYNTHETIC_MARKER = 'SYNTHETIC_12G_BLUEPRINT_COMPOSITION_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []
const bridgedClassExternalIds: string[] = []
const bridgedLearnerExternalIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint12g-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  // Legacy bridge rows first — not FK'd to `schools`, so they don't cascade
  // from the school delete below (same cleanup order academicBridge.test.ts uses).
  if (bridgedLearnerExternalIds.length) {
    const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', bridgedLearnerExternalIds)
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
  if (bridgedClassExternalIds.length) await db.from('teacher_classes').delete().in('external_id', bridgedClassExternalIds)

  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id)
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('composeBlueprint produces a partial-but-valid Blueprint for a Core-only learner (no legacy student bridge)', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `12g-${Date.now()}`,
    first_name: 'Amani', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Amani Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(enroll.status, 'complete')
  const learnerId = enroll.learnerId!

  const session = await createAttendanceSession(admin.id, {
    school_id: school.id, academic_year_id: academicYearId, term_id: termId, class_id: classId,
    attendance_date: '2026-02-01',
  })
  await bulkRecordAttendance(admin.id, school.id, session.id, [{ learner_id: learnerId, status: 'present' }])

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: admin.id,
    coreLearnerId: learnerId,
    schoolId: school.id,
  })

  assert.equal(blueprint.identity.status, 'available')
  assert.equal(blueprint.identity.data?.learnerName, 'Amani Learner')
  assert.equal(blueprint.identity.data?.admissionNumber.startsWith('12g-'), true)

  assert.equal(blueprint.attendance.status, 'available')
  assert.equal(blueprint.attendance.data?.presentCount, 1)
  assert.equal(blueprint.attendance.data?.totalSessions, 1)
  assert.equal(blueprint.attendance.data?.attendancePercentage, 100)

  // No legacy student bridge -> these three degrade explicitly, never throw,
  // never fabricate a value (the real Decision-3 gap Sprint 12G found).
  assert.equal(blueprint.academicRecord.status, 'unavailable')
  assert.match(blueprint.academicRecord.unavailableReason ?? '', /bridged/)
  assert.equal(blueprint.learningCompass.status, 'unavailable')
  assert.equal(blueprint.career.status, 'unavailable')

  // Sprint 12O: Teacher Reflection is Core-native (keyed to `learners.id`,
  // no legacy bridge needed) — a learner with no published reflection yet
  // is 'unavailable' with an explicit reason, never 'not_implemented'
  // (that status now correctly means "no domain exists," which is no
  // longer true for Teacher Reflection) and never fabricated content.
  assert.equal(blueprint.teacherReflection.status, 'unavailable')
  assert.ok(blueprint.teacherReflection.unavailableReason)

  // Remaining placeholders, per explicit mission instruction.
  assert.equal(blueprint.educationalIdentity.status, 'not_implemented')
  assert.equal(blueprint.growthTimeline.status, 'not_implemented')
  assert.deepEqual(blueprint.growthTimeline.data, [])

  // Parent Summary degrades to using only what's available (Attendance),
  // never a generated paragraph.
  assert.equal(blueprint.parentSummary.status, 'available')
  assert.match(blueprint.parentSummary.data?.detail ?? '', /100%/)

  assert.equal(blueprint.metadata.freshness, 'partial')
  assert.equal(blueprint.metadata.snapshotState, 'current')

  assert.equal(validation.valid, true, JSON.stringify(validation.errors))
})

test('composeBlueprint never throws for a nonexistent learner — Identity becomes explicitly unavailable, and validation reports it', async () => {
  const admin = await mkAuthUser('admin2')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: admin.id,
    coreLearnerId: '00000000-0000-0000-0000-000000000000',
    schoolId: school.id,
  })

  assert.equal(blueprint.identity.status, 'unavailable')
  assert.ok(blueprint.identity.unavailableReason)
  assert.equal(validation.valid, false)
  assert.ok(validation.errors.some(e => e.field === 'identity'))
})

test('composeBlueprint resolves a real bridged legacy identity via the canonical resolver — legacy-space sections stop being unavailable-for-lack-of-bridge', async () => {
  const admin = await mkAuthUser('admin3')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `12h-${Date.now()}`,
    first_name: 'Bridged', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Bridged Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'father' },
  })
  assert.equal(enroll.status, 'complete')
  const learnerId = enroll.learnerId!

  // ensureBridgedClass requires a canonical `teachers` row (ADR-0002) for
  // the acting user — a school_admin membership alone isn't one; complete
  // real teacher onboarding first, same fixture pattern academicBridge.test.ts
  // already uses.
  const teacherUser = await mkAuthUser('bridgeteacher')
  const invite = await inviteTeacher(school.id, teacherUser.email, admin.id)
  assert.equal(invite.status, 'invited')
  const accept = await acceptTeacherInvitation(teacherUser.id, school.id, { full_name: 'Bridge Teacher' })
  assert.equal(accept.status, 'accepted')

  // Create the bridge via the platform's own existing mechanism — Blueprint
  // itself never creates one (it stays a pure consumer of the resolver).
  bridgedClassExternalIds.push(classId)
  bridgedLearnerExternalIds.push(learnerId)
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacherUser.id)
  const { legacyStudentId } = await ensureBridgedLearner(school.id, learnerId, bridgedClass)
  assert.ok(legacyStudentId)

  // Prove the canonical resolver itself now finds it (this is what
  // composeBlueprint calls internally — asserted directly first so a
  // failure here is attributed to the resolver, not the composer).
  assert.equal(await resolveLegacyStudentId(learnerId), legacyStudentId)

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: admin.id,
    coreLearnerId: learnerId,
    schoolId: school.id,
  })

  assert.equal(blueprint.identity.status, 'available')

  // No evidence recorded yet for this bridged student, so Academic Record
  // legitimately has nothing to show — but it must now be 'available' with
  // empty content (Projection ran, found no evidence), never 'unavailable'
  // for lack of a bridge, since one now genuinely exists.
  assert.equal(blueprint.academicRecord.status, 'available')
  assert.deepEqual(blueprint.academicRecord.data?.bySubject, [])

  assert.equal(blueprint.learningCompass.status, 'available')

  // Sprint 12N: with zero evidence, Career Intelligence itself reports
  // insufficient evidence (`buildCareerIntelligence`'s own `notice` branch)
  // — Blueprint must surface that as an explicit Unavailable state, never
  // as "available" with every field silently null (the pre-Sprint-12N
  // behaviour this test used to assert).
  assert.equal(blueprint.career.status, 'unavailable')
  assert.equal(
    blueprint.career.unavailableReason,
    'More learning evidence is needed before Career Intelligence can provide reliable guidance.'
  )

  assert.equal(validation.valid, true, JSON.stringify(validation.errors))
})

test('composeBlueprint surfaces Career Intelligence as available, cluster-level only, once real evidence exists (Sprint 12N)', async () => {
  const admin = await mkAuthUser('career-admin')
  const created = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_career2_${Date.now()}` }, admin.id)
  createdSchoolIds.push(created.id)
  await repos.schools.addSchoolUser(created.id, admin.id, 'school_admin')
  const activation = await activateSchool(created.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', created.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', created.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const teacher = await mkAuthUser('career-teacher')
  const invite = await inviteTeacher(created.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  const accept = await acceptTeacherInvitation(teacher.id, created.id, { full_name: 'Career Teacher' })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed: ${accept.status}`)

  const enroll = await onboardLearner(created.id, {
    admission_number: `12n-career-${Date.now()}`,
    first_name: 'Career', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Career Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!
  bridgedLearnerExternalIds.push(learnerId)
  bridgedClassExternalIds.push(classId)

  const { assessmentId } = await createBridgedAssessment(created.id, classId, teacher.id, {
    title: '12N Career CAT',
    assessment_type: 'cat',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['mathematics'],
    curriculum_type: 'cbc',
  })
  const bridgedClass = await ensureBridgedClass(created.id, classId, teacher.id)
  await recordBridgedMarks(created.id, assessmentId, bridgedClass, teacher.id, [
    { coreLearnerId: learnerId, admission_number: 'CAREER-12N', student_name: 'Career Learner', subject_scores: { mathematics: 85 }, total_marks: 85, mean_score: 85 },
  ])

  const { blueprint, validation } = await composeBlueprint({
    actorUserId: admin.id,
    coreLearnerId: learnerId,
    schoolId: created.id,
  })

  assert.equal(blueprint.career.status, 'available')
  const careerData = blueprint.career.data!
  assert.ok(careerData.careerCluster, 'a cluster label must be present once real evidence exists')
  assert.ok(['Low', 'Medium', 'High'].includes(careerData.confidence!), 'confidence must be one of Career Intelligence\'s own canonical labels')
  assert.ok(careerData.futureDirection, 'a next-direction sentence must be present')
  // Never a specific career/job title — the type itself no longer has a
  // `careerTitle` field (compile-time enforcement); this is a runtime
  // sanity check that no field smuggles one in under another name.
  assert.ok(!('careerTitle' in careerData))
  assert.equal(validation.valid, true, JSON.stringify(validation.errors))
})

test('composeBlueprint surfaces a published Teacher Reflection, and only once it is actually published (Sprint 12O)', async () => {
  const REFLECTION_PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`
  async function mkPasswordUser(label: string): Promise<{ id: string; email: string }> {
    const email = `sprint12o-blueprint-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data, error } = await db.auth.admin.createUser({ email, password: REFLECTION_PASSWORD, email_confirm: true })
    if (error) throw error
    createdAuthUserIds.push(data.user.id)
    return { id: data.user.id, email }
  }
  async function signInAs(email: string): Promise<SupabaseClient> {
    const client = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await client.auth.signInWithPassword({ email, password: REFLECTION_PASSWORD })
    if (error) throw error
    return client
  }

  const admin = await mkPasswordUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_reflection_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  const teacher = await mkPasswordUser('teacher')
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: 'Reflection Blueprint Teacher' })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed: ${accept.status}`)

  const enroll = await onboardLearner(school.id, {
    admission_number: `12o-bp-${Date.now()}`,
    first_name: 'Reflected', last_name: 'Learner',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
    guardian: { full_name: 'Reflected Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error('enroll failed')
  const learnerId = enroll.learnerId!

  // Before any reflection exists, Blueprint must show an explicit
  // Unavailable state — never a blank/fabricated Teacher Reflection.
  const before = await composeBlueprint({ actorUserId: admin.id, coreLearnerId: learnerId, schoolId: school.id })
  assert.equal(before.blueprint.teacherReflection.status, 'unavailable')
  assert.ok(before.blueprint.teacherReflection.unavailableReason)

  const client = await signInAs(teacher.email)
  const draft = await createReflectionDraft(client, school.id, learnerId, teacher.id, {
    strengths: 'Asks thoughtful questions and helps peers during science experiments.',
    growthArea: 'Building stamina for longer written tasks.',
    learningHabits: 'Reads ahead of class and keeps a tidy notebook.',
    recommendedSupport: 'Short daily writing practice, gradually increasing length.',
    holidayFocus: 'A short daily writing journal over the holidays.',
  })

  // A draft in progress must never leak into Blueprint.
  const duringDraft = await composeBlueprint({ actorUserId: admin.id, coreLearnerId: learnerId, schoolId: school.id })
  assert.equal(duringDraft.blueprint.teacherReflection.status, 'unavailable')

  await publishReflection(client, school.id, draft.id, teacher.id)

  const after = await composeBlueprint({ actorUserId: admin.id, coreLearnerId: learnerId, schoolId: school.id })
  assert.equal(after.blueprint.teacherReflection.status, 'available')
  const reflectionData = after.blueprint.teacherReflection.data!
  assert.equal(reflectionData.strengths, 'Asks thoughtful questions and helps peers during science experiments.')
  assert.equal(reflectionData.teacherSignature, 'Reflection Blueprint Teacher')
  assert.ok(reflectionData.publishedAt)
  assert.equal(reflectionData.version, 1)
  assert.equal(after.validation.valid, true, JSON.stringify(after.validation.errors))
})
