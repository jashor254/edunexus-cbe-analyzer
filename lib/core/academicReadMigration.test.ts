// lib/core/academicReadMigration.test.ts
//
// Sprint 9G — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established throughout this series.
// Proves the canonical read migration: given a Core-originated learner
// (Sprint 9D) with a real bridged assessment (Sprint 9F), every downstream
// read this sprint audited — Teacher Dashboard's class count, the
// roster-based class view, Learner Timeline, Career Intelligence, Compass
// access, cross-school isolation, and duplicate prevention — resolves
// correctly, using the existing, unmodified underlying reads.
//
// Where a read is REPLICATED here rather than called through a page
// component (Teacher Dashboard, the roster-based class view), the exact
// same query shape the real page/route uses is reproduced verbatim (cited
// to file:line in comments) — this is not a guess at what those surfaces
// do, it is the same query, run directly, since a React Server Component
// can't be exercised from a node:test integration test.
//
// Run: npx tsx --env-file=.env.local --test lib/core/academicReadMigration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordBridgedMarks, ensureBridgedClass, resolveLegacyStudentId, getBridgedLearnerTimeline, getBridgedCareerIntelligence, getBridgedCompassAccess } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_9G_READ_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint9g-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
  // Same full-dependency-chain sweep Sprint 9F's own test cleanup bug
  // taught this series to use — see that sprint's implementation log entry.
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
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
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) await db.from('teacher_classes').delete().in('external_id', classExternalIds)
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

async function fullyOnboardedLearner(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacher = await mkAuthUser(`${labelPrefix}-teacher`)
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: `${labelPrefix} Teacher` })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${labelPrefix}-${Date.now()}`,
    first_name: 'Read',
    last_name: 'Migration',
    class_id: classId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: 'Read Migration Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error(`fixture enrollment failed: ${enroll.error}`)
  const coreLearnerId = enroll.learnerId!

  const { assessmentId, legacyClassId } = await createBridgedAssessment(school.id, classId, teacher.id, {
    title: 'Read Migration CAT',
    assessment_type: 'cat',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['mathematics'],
    curriculum_type: 'cbc',
  })
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacher.id)
  const { legacyStudentIds } = await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacher.id, [
    { coreLearnerId: asLearnerId(coreLearnerId), admission_number: 'RM', student_name: 'Read Migration', subject_scores: { mathematics: 82 }, total_marks: 82, mean_score: 82 },
  ])

  return { schoolId: school.id, adminUserId: admin.id, teacherUserId: teacher.id, classId, termId, coreLearnerId, legacyClassId, legacyStudentId: legacyStudentIds[0], assessmentId }
}

// ── Teacher Dashboard (Step 4) — replicates app/teacher/dashboard/page.tsx:47-63 ──

test('Teacher Dashboard: a bridged class is counted in activeClasses, exactly as the real dashboard query would see it', async () => {
  const fixture = await fullyOnboardedLearner('dash')
  const legacyTeacherId = (await repos.teachers.findTeacherByUserId(fixture.teacherUserId))!.id

  // Same query shape as app/teacher/dashboard/page.tsx:47-51,60-63.
  const { data: teacher } = await db.from('teachers').select('id, full_name').eq('user_id', fixture.teacherUserId).single()
  assert.equal(teacher?.id, legacyTeacherId)

  const { data: classes } = await db.from('teacher_classes').select('id').eq('teacher_id', teacher!.id)
  const activeClasses = (classes ?? []).length
  assert.equal(activeClasses, 1) // the bridged class, counted with zero code changes
})

// ── Roster-based class view (Step 4/7 finding, fixed this sprint) ───────────

test('class-detail roster view: a bridged learner appears via class_students, exactly as app/api/teacher/classes/[classId]/route.ts reads it', async () => {
  const fixture = await fullyOnboardedLearner('roster')

  // Same query shape as app/api/teacher/classes/[classId]/route.ts:51-58.
  const { data: studentLinks } = await db.from('class_students').select('student_id, parent_id').eq('class_id', fixture.legacyClassId)
  const studentIds = (studentLinks ?? []).map(l => l.student_id)
  assert.ok(studentIds.includes(fixture.legacyStudentId))

  const { data: studentRows } = await db.from('students').select('id, name, grade').in('id', studentIds)
  assert.equal(studentRows?.[0].name, 'Read Migration')
})

// ── Learner Timeline (Step 5) ─────────────────────────────────────────────────

test('Learner Timeline: canonical end-to-end via the bridge, showing the recorded evidence', async () => {
  const fixture = await fullyOnboardedLearner('timeline')

  const timeline = await getBridgedLearnerTimeline(asLearnerId(fixture.coreLearnerId))
  assert.ok(timeline)
  assert.ok(timeline!.length > 0)
  assert.ok(timeline!.some(e => e.kind === 'evidence'))
})

test('Learner Timeline: returns null (not an error) for a learner with no bridge yet', async () => {
  const fixture = await fullyOnboardedLearner('timeline-none')
  // A second, never-assessed learner in the same fixture school — enrolled but no assessment recorded.
  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', fixture.schoolId).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', fixture.schoolId).order('term_number').limit(1)
  const second = await onboardLearner(fixture.schoolId, {
    admission_number: `timeline-none-2-${Date.now()}`,
    first_name: 'Never', last_name: 'Assessed',
    class_id: classes![0].id, term_id: terms![0].id, academic_year_id: classes![0].academic_year_id,
  })
  assert.equal(second.status, 'complete')

  const timeline = await getBridgedLearnerTimeline(asLearnerId(second.learnerId!))
  assert.equal(timeline, null)
})

// ── Career Intelligence (Step 9) ─────────────────────────────────────────────

test('Career Intelligence: resolvable through the canonical bridge, unmodified buildCareerIntelligence', async () => {
  const fixture = await fullyOnboardedLearner('career')
  const result = await getBridgedCareerIntelligence(asLearnerId(fixture.coreLearnerId))
  // A single CAT is unlikely to produce a confident career match, but the
  // call must succeed and return the real, unmodified shape (studentId
  // resolved to the bridged legacy id, mode set from grade) — not throw,
  // not a stub.
  assert.ok(result !== null)
  assert.equal(result!.studentId, fixture.legacyStudentId)
  assert.equal(result!.mode, 'planning') // Grade 10 -> Senior
})

// ── Compass (Step 10) ─────────────────────────────────────────────────────────

test('Compass: the bridged teacher is granted direct access to the bridged learner, unmodified resolveCompassStudentAccess', async () => {
  const fixture = await fullyOnboardedLearner('compass')
  const result = await getBridgedCompassAccess(asLearnerId(fixture.coreLearnerId), fixture.teacherUserId)
  assert.ok(result)
  assert.equal(result!.legacyStudentId, fixture.legacyStudentId)
  assert.equal(result!.access.allowed, true)
  if (result!.access.allowed) assert.equal(result!.access.via, 'teacher_direct')
})

test('Compass: an unrelated teacher is denied access to the bridged learner (no cross-teacher leakage)', async () => {
  const fixture = await fullyOnboardedLearner('compass-deny')
  const outsiderTeacher = await mkAuthUser('compass-outsider')
  const outsiderSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_outsider_${Date.now()}` }, outsiderTeacher.id)
  createdSchoolIds.push(outsiderSchool.id)
  await repos.schools.addSchoolUser(outsiderSchool.id, outsiderTeacher.id, 'school_admin')
  await db.from('teachers').insert({ user_id: outsiderTeacher.id, full_name: 'Outsider', school: 'Outsider School' })

  const result = await getBridgedCompassAccess(asLearnerId(fixture.coreLearnerId), outsiderTeacher.id)
  assert.ok(result)
  assert.equal(result!.access.allowed, false)
})

// ── Cross-school isolation (Step 6/10) ────────────────────────────────────────

test('cross-school isolation: a learner bridged in School A is invisible to a School B teacher via the same read paths', async () => {
  const fixtureA = await fullyOnboardedLearner('isolation-a')
  const fixtureB = await fullyOnboardedLearner('isolation-b')

  const timelineViaB = await getBridgedCompassAccess(asLearnerId(fixtureA.coreLearnerId), fixtureB.teacherUserId)
  assert.equal(timelineViaB!.access.allowed, false)

  // School B's teacher_classes count is unaffected by School A's bridge.
  const legacyTeacherB = (await repos.teachers.findTeacherByUserId(fixtureB.teacherUserId))!.id
  const { data: classesB } = await db.from('teacher_classes').select('id').eq('teacher_id', legacyTeacherB)
  assert.equal(classesB?.length, 1) // only School B's own bridged class, not School A's
})

// ── Duplicate prevention (Step 10) ────────────────────────────────────────────

test('duplicate prevention: resolving reads for the same learner twice never creates a second bridge or roster row', async () => {
  const fixture = await fullyOnboardedLearner('dup')

  const first = await resolveLegacyStudentId(asLearnerId(fixture.coreLearnerId))
  const second = await resolveLegacyStudentId(asLearnerId(fixture.coreLearnerId))
  assert.equal(first, second)

  const { data: studentRows } = await db.from('students').select('id').eq('external_id', fixture.coreLearnerId)
  assert.equal(studentRows?.length, 1)
  const { data: rosterRows } = await db.from('class_students').select('id').eq('student_id', fixture.legacyStudentId)
  assert.equal(rosterRows?.length, 1)
})

// ── Canonical identity resolution (Step 10) ──────────────────────────────────

test('canonical identity resolution: teacher identity is the same ADR-0002 teachers.id across dashboard, bridge, and Compass', async () => {
  const fixture = await fullyOnboardedLearner('canonical')
  const legacyTeacherId = (await repos.teachers.findTeacherByUserId(fixture.teacherUserId))!.id

  const { data: bridgedClassRow } = await db.from('teacher_classes').select('teacher_id').eq('external_id', fixture.classId).single()
  assert.equal(bridgedClassRow?.teacher_id, legacyTeacherId)

  const compassResult = await getBridgedCompassAccess(asLearnerId(fixture.coreLearnerId), fixture.teacherUserId)
  assert.equal(compassResult!.access.allowed, true) // resolved via the same teachers.id, no second identity
})
