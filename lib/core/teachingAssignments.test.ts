// lib/core/teachingAssignments.test.ts
//
// class_subjects → Teacher Workspace convergence. Proves the institutional
// read (lib/core/teachingAssignments.ts) returns exactly what the school
// assigned, to exactly the teacher it was assigned to, and nothing else.
//
// Two fixture schools with a teacher each, so cross-school isolation is
// proven against real rows rather than asserted. Follows the fixture
// convention in lib/core/classes.workflow.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/teachingAssignments.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher, listClassSubjects } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { deactivateSchoolMembership } from '@/lib/core/school-users'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  listTeachingAssignmentsForUser,
  groupAssignmentsBySubject,
  resolveTeachingContext,
} from '@/lib/core/teachingAssignments'

const SYNTHETIC_MARKER = 'SYNTHETIC_CSTW_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `cstw-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

// ── School A ──
let schoolAId: string
let gradeId: string
let academicYearId: string
let peterUserId: string
let peterMembershipId: string
let graceUserId: string
let graceMembershipId: string
let sevenEastId: string
let eightNorthId: string
let mathsId: string
let englishId: string
let scienceId: string

// ── School B (isolation) ──
let schoolBId: string
let brianUserId: string

// A teacher with a membership but no assignment, and one with no membership.
let unassignedUserId: string
let soloUserId: string

async function setUpSchool(label: string): Promise<{ schoolId: string; adminId: string }> {
  const admin = await mkAuthUser(`${label}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${label}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const activation = await activateSchool(school.id, { gradeCodes: ['G7', 'G8'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)
  return { schoolId: school.id, adminId: admin.id }
}

async function addTeacher(schoolId: string, adminId: string, label: string): Promise<{ userId: string; membershipId: string }> {
  const user = await mkAuthUser(label)
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, membershipId: accepted.schoolUser.id }
}

before(async () => {
  // ── School A: Peter (Maths), Grace (English), plus Mary's subject slot ──
  const a = await setUpSchool('A')
  schoolAId = a.schoolId

  const { data: classes } = await db
    .from('classes')
    .select('id, grade_id, academic_year_id')
    .eq('school_id', schoolAId)
    .limit(1)
  gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id

  const subjects = await listSubjects('junior_secondary')
  mathsId   = subjects.find(s => s.name === 'Mathematics')!.id
  englishId = subjects.find(s => s.name === 'English')!.id
  scienceId = subjects.find(s => s.name === 'Integrated Science')!.id

  const sevenEast = await createClass(schoolAId, {
    grade_id: gradeId, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 7 East`,
  })
  sevenEastId = sevenEast.id
  const eightNorth = await createClass(schoolAId, {
    grade_id: gradeId, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 8 North`,
  })
  eightNorthId = eightNorth.id

  const peter = await addTeacher(schoolAId, a.adminId, 'peter')
  peterUserId = peter.userId
  peterMembershipId = peter.membershipId

  const grace = await addTeacher(schoolAId, a.adminId, 'grace')
  graceUserId = grace.userId
  graceMembershipId = grace.membershipId

  const unassigned = await addTeacher(schoolAId, a.adminId, 'unassigned')
  unassignedUserId = unassigned.userId

  // ── School B: Brian, entirely separate ──
  const b = await setUpSchool('B')
  schoolBId = b.schoolId
  const { data: bClasses } = await db
    .from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolBId).limit(1)
  const brian = await addTeacher(schoolBId, b.adminId, 'brian')
  brianUserId = brian.userId
  const bClass = await createClass(schoolBId, {
    grade_id: bClasses![0].grade_id,
    academic_year_id: bClasses![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} School B Grade 7`,
  })
  await assignSubjectTeacher(schoolBId, bClass.id, mathsId, brian.membershipId)

  // ── A Solo Teacher: an account, no school membership at all ──
  const solo = await mkAuthUser('solo')
  soloUserId = solo.id

  // ── The admin performs the assignments (the locked product model) ──
  await assignSubjectTeacher(schoolAId, sevenEastId,  mathsId,   peterMembershipId)
  await assignSubjectTeacher(schoolAId, eightNorthId, mathsId,   peterMembershipId)
  await assignSubjectTeacher(schoolAId, sevenEastId,  englishId, graceMembershipId)
})

after(async () => {
  // class_subjects.teacher_id -> school_users(id) is ON DELETE NO ACTION, so
  // deleting a school cascades to school_users and is then BLOCKED by any
  // surviving assignment row. Clear assignments first or the school delete
  // fails silently and leaks fixture schools.
  for (const id of createdSchoolIds) await db.from('class_subjects').delete().eq('school_id', id)
  // teacher_classes.school_id -> schools(id) is also NO ACTION (test 11 puts
  // a legacy private class on the fixture school).
  for (const id of createdSchoolIds) await db.from('teacher_classes').delete().eq('school_id', id)
  for (const id of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', id)
    // Surfaced, not swallowed: a silently-failing cleanup is how synthetic
    // fixture schools accumulate in the live database unnoticed.
    if (error) console.error(`[cleanup] school ${id} not deleted: ${error.message}`)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── 1/2. The admin assigns; the teacher reads exactly that ──────────────────

test('1+2. admin assigns Mathematics → Grade 7 East → Peter, and Peter reads it back', async () => {
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  const sevenEastMaths = assignments.find(a => a.classId === sevenEastId && a.subjectId === mathsId)

  assert.ok(sevenEastMaths, 'Peter should see the Grade 7 East Mathematics assignment')
  assert.equal(sevenEastMaths.subjectName, 'Mathematics')
  assert.equal(sevenEastMaths.className, `${SYNTHETIC_MARKER} Grade 7 East`)
  assert.equal(sevenEastMaths.schoolId, schoolAId)
  // teacher_id is a school_users.id — an employment relationship, never a
  // teachers.id and never an auth.users.id.
  assert.equal(sevenEastMaths.teacherMembershipId, peterMembershipId)
  assert.notEqual(sevenEastMaths.teacherMembershipId, peterUserId)
})

test('2b. Peter did not create the class — the school did, and it carries the school\'s id', async () => {
  const { data: cls } = await db.from('classes').select('school_id, class_teacher_id').eq('id', sevenEastId).single()
  assert.equal(cls!.school_id, schoolAId)
  // No teacher owns the class row itself; assignment lives in class_subjects.
  assert.equal(cls!.class_teacher_id, null)
})

// ── 3/4. Isolation ──────────────────────────────────────────────────────────

test('3. Grace does not see Peter\'s assignments (same school, different teacher)', async () => {
  const graceAssignments = await listTeachingAssignmentsForUser(graceUserId)
  assert.ok(graceAssignments.every(a => a.teacherMembershipId === graceMembershipId))
  assert.ok(!graceAssignments.some(a => a.subjectId === mathsId), 'Grace teaches English, not Peter\'s Mathematics')
  assert.equal(graceAssignments.length, 1)
})

test('4. a teacher at School B sees none of School A\'s assignments', async () => {
  const brianAssignments = await listTeachingAssignmentsForUser(brianUserId)
  assert.ok(brianAssignments.length > 0, 'Brian has his own assignment at School B')
  assert.ok(brianAssignments.every(a => a.schoolId === schoolBId))
  assert.ok(!brianAssignments.some(a => a.schoolId === schoolAId))
})

test('4b. cross-school safety does not depend on any client-supplied id', async () => {
  // The read takes ONLY an authenticated user id. Even knowing School A's
  // ids exactly, Brian's own resolution cannot reach them, because the
  // membership set is derived server-side from his user id alone.
  const brianAssignments = await listTeachingAssignmentsForUser(brianUserId)
  assert.ok(!brianAssignments.some(a => a.classId === sevenEastId))
  assert.ok(!brianAssignments.some(a => a.teacherMembershipId === peterMembershipId))
})

// ── 5/6/7. Cardinality (Phase 15) ───────────────────────────────────────────

test('5. one teacher → many classes (Peter teaches Maths to 7 East AND 8 North)', async () => {
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  const mathsClasses = assignments.filter(a => a.subjectId === mathsId).map(a => a.classId)
  assert.equal(mathsClasses.length, 2)
  assert.ok(mathsClasses.includes(sevenEastId))
  assert.ok(mathsClasses.includes(eightNorthId))
})

test('6. one teacher → many subjects', async () => {
  // Peter picks up Integrated Science in 8 North as well.
  await assignSubjectTeacher(schoolAId, eightNorthId, scienceId, peterMembershipId)
  const groups = groupAssignmentsBySubject(await listTeachingAssignmentsForUser(peterUserId))
  const names = groups.map(g => g.subjectName)
  assert.ok(names.includes('Mathematics'))
  assert.ok(names.includes('Integrated Science'))
  // Grouped subject-first: Mathematics carries both its classes in one group.
  assert.equal(groups.find(g => g.subjectName === 'Mathematics')!.classes.length, 2)
})

test('7. one class → many subject teachers, with no duplicate class row', async () => {
  const classSubjects = await listClassSubjects(sevenEastId)
  const teacherIds = new Set(classSubjects.map(cs => cs.teacher_id))
  assert.ok(teacherIds.has(peterMembershipId), '7 East Mathematics → Peter')
  assert.ok(teacherIds.has(graceMembershipId), '7 East English → Grace')

  // The whole point: two teachers, ONE class row.
  const { data: rows } = await db
    .from('classes').select('id').eq('school_id', schoolAId).eq('display_name', `${SYNTHETIC_MARKER} Grade 7 East`)
  assert.equal(rows!.length, 1)
})

// ── 8. Active membership required (Phase 4) ─────────────────────────────────

test('8. a deactivated membership returns zero CURRENT assignments, without deleting them', async () => {
  const before = await listTeachingAssignmentsForUser(graceUserId)
  assert.ok(before.length > 0)

  const removed = await deactivateSchoolMembership(graceUserId, schoolAId)
  assert.equal(removed, true)

  const after = await listTeachingAssignmentsForUser(graceUserId)
  assert.equal(after.length, 0, 'an inactive membership confers no current teaching work')

  // The assignment ROW survives — history is a later phase's problem, and
  // this read must not be what destroys it.
  const { data: surviving } = await db
    .from('class_subjects').select('id').eq('teacher_id', graceMembershipId)
  assert.ok(surviving!.length > 0, 'class_subjects rows are retained, merely not current')

  // Grace is now a school teacher with no current assignment, NOT a Solo
  // Teacher — but her membership is inactive, so she has no active
  // membership either. She resolves to solo, which is correct: an inactive
  // membership is not a school relationship.
  const context = await resolveTeachingContext(graceUserId)
  assert.equal(context.kind, 'solo')

  // Restore for any later test ordering.
  await db.from('school_users').update({ is_active: true }).eq('id', graceMembershipId)
})

// ── 9. Read grants no write authority (Phase 13) ────────────────────────────

test('9. the assignment module exposes no mutation at all', async () => {
  const mod = await import('@/lib/core/teachingAssignments')
  const exported = Object.keys(mod)
  // Every export is a read or a pure transform. If a future change adds a
  // writer here, this fails loudly — assignment mutation belongs to the
  // admin-gated POST /api/core/subjects, and nowhere else.
  assert.deepEqual(
    exported.sort(),
    ['groupAssignmentsBySubject', 'listTeachingAssignmentsForUser', 'resolveTeachingContext'],
  )
})

// ── 10/11/12. Context resolution and the no-silent-fallback rule ────────────

test('10. school teacher with zero assignments gets the institutional empty state', async () => {
  const context = await resolveTeachingContext(unassignedUserId)
  assert.equal(context.kind, 'school_unassigned')
  if (context.kind === 'school_unassigned') {
    assert.deepEqual(context.schoolIds, [schoolAId])
  }
})

test('11. a school teacher does NOT silently fall back to teacher_classes', async () => {
  // Give the unassigned school teacher a legacy private class — the exact
  // shape that used to masquerade as an institutional assignment.
  const teacher = await repos.teachers.findTeacherByUserId(unassignedUserId)
  assert.ok(teacher, 'fixture: the accept flow materialized a teachers row')
  const { error } = await db.from('teacher_classes').insert({
    teacher_id: teacher.id,
    school_id: schoolAId,
    name: `${SYNTHETIC_MARKER} Private Class`,
    grade: 7,
    subject: 'Mathematics',
    academic_year: '2026',
    class_code: `CSTW${Date.now().toString().slice(-6)}`,
  })
  assert.equal(error, null)

  // The legacy row exists...
  const { data: legacy } = await db.from('teacher_classes').select('id').eq('teacher_id', teacher.id)
  assert.equal(legacy!.length, 1)

  // ...and the institutional read still reports zero. A private class is
  // never promoted into an institutional assignment.
  const context = await resolveTeachingContext(unassignedUserId)
  assert.equal(context.kind, 'school_unassigned')
  assert.equal((await listTeachingAssignmentsForUser(unassignedUserId)).length, 0)
})

test('12. a Solo Teacher (no membership) resolves to solo, leaving personal flows intact', async () => {
  const context = await resolveTeachingContext(soloUserId)
  assert.equal(context.kind, 'solo')
})

// ── 17. Auto-provisioning: CHARACTERIZED, not fixed (Phase 17) ──────────────

test('17a. a school-linked teacher never needs the auto-provisioning fallback', async () => {
  // resolveOwningSchool provisions a fictional school ONLY when it cannot
  // find an existing membership. Peter has one, so it resolves to his real
  // school and creates nothing. This is the property that must hold before
  // the fallback can be removed in a later phase: a teacher the school
  // actually employs is never routed through it.
  const { resolveOwningSchool } = await import('@/lib/core/institutionOwnership')
  const schoolsBefore = await db.from('schools').select('id', { count: 'exact', head: true })

  const resolved = await resolveOwningSchool(peterUserId, 'SHOULD NEVER BE CREATED')

  assert.equal(resolved.schoolId, schoolAId, 'resolves to the real employing school')
  assert.equal(resolved.created, false, 'and provisions nothing')

  const schoolsAfter = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(schoolsAfter.count, schoolsBefore.count, 'no school row was created')
})

test('17b. KNOWN ANTI-PATTERN — a teacher with no membership still auto-provisions a school and becomes its admin', async () => {
  const { resolveOwningSchool } = await import('@/lib/core/institutionOwnership')

  const stray = await mkAuthUser('stray')
  const resolved = await resolveOwningSchool(stray.id, `${SYNTHETIC_MARKER} Stray's School (pending setup)`)
  createdSchoolIds.push(resolved.schoolId)

  const { data: school } = await db
    .from('schools').select('provisioning_source').eq('id', resolved.schoolId).single()
  assert.equal(school!.provisioning_source, 'teacher_first_write_auto_provision')

  // ...and it made them school_admin of it.
  const { data: membership } = await db
    .from('school_users').select('role, is_active').eq('school_id', resolved.schoolId).eq('user_id', stray.id).single()
  assert.equal(membership!.role, 'school_admin')
  assert.equal(membership!.is_active, true)

  // CHARACTERIZATION ONLY — deliberately unchanged in this phase. The two
  // live call sites able to trigger this are:
  //   app/api/teacher/classes/route.ts                    (POST, create class)
  //   app/api/teacher/classes/[classId]/students/route.ts (POST, create learner)
  // Both are Solo-Teacher-legitimate today. Removing the provisioning branch
  // requires the no-school blocked state to ship first, or every teacher
  // without a school breaks. Owned by the auto-provision cleanup phase.
})

// ── 16. Replacement now PRESERVES history (was a characterized limitation) ──

test('16. reassigning a class+subject closes the previous tenure instead of erasing it', async () => {
  // This test used to CHARACTERIZE the opposite: an upsert on
  // UNIQUE(class_id, subject_id) overwrote teacher_id in place, so Peter's
  // tenure vanished when Mary replaced him. Migration 20260813120000 added
  // started_at/ended_at plus a partial unique index scoped to current rows,
  // and the assertion is inverted accordingly — the succession is now recorded.
  const mary = await addTeacher(schoolAId, (await repos.schools.findById(schoolAId)).created_by!, 'mary')
  await assignSubjectTeacher(schoolAId, sevenEastId, mathsId, mary.membershipId)

  // Mary sees it immediately — the class is NOT recreated, learners NOT re-enrolled.
  const maryAssignments = await listTeachingAssignmentsForUser(mary.userId)
  assert.ok(maryAssignments.some(a => a.classId === sevenEastId && a.subjectId === mathsId))

  // Peter no longer teaches it — correct, it is no longer his CURRENT work.
  const peterAssignments = await listTeachingAssignmentsForUser(peterUserId)
  assert.ok(!peterAssignments.some(a => a.classId === sevenEastId && a.subjectId === mathsId))

  // But the record that he taught it survives, closed rather than deleted.
  const { data: rows } = await db
    .from('class_subjects').select('id, teacher_id, ended_at')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).order('started_at')
  assert.equal(rows!.length, 2, 'two tenures recorded, not one overwritten row')

  const peterRow = rows!.find(r => r.teacher_id === peterMembershipId)
  const maryRow  = rows!.find(r => r.teacher_id === mary.membershipId)
  assert.ok(peterRow, 'Peter\'s tenure is still on record')
  assert.ok(peterRow!.ended_at, 'and it is closed')
  assert.ok(maryRow, 'Mary holds the post')
  assert.equal(maryRow!.ended_at, null, 'and hers is current')

  // Exactly one CURRENT teacher — the invariant the partial unique index holds.
  assert.equal(rows!.filter(r => r.ended_at === null).length, 1)
})
