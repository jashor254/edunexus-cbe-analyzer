// lib/core/classes.workflow.test.ts
//
// Sprint 10 (Core Administration Completion) — the four backends the
// new Academic Structure UI activates (createStream, createClass,
// assignSubjectToGrade, assignSubjectTeacher, all in lib/core/classes.ts +
// lib/core/subjects.ts) had zero test coverage before this sprint, per
// docs/architecture/sprint9-school-operations-excellence-audit.md §Phase 7
// ("Partial" class management, "Dormant" subject/teacher allocation).
// Follows the fixture convention established in lib/core/learnerOnboarding.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/classes.workflow.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createStream, createClass, assignSubjectTeacher, listClassSubjects, listStreams } from '@/lib/core/classes'
import { assignSubjectToGrade, listGradeSubjects, listSubjects } from '@/lib/core/subjects'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { PermissionDeniedError, MembershipRequiredError, SchoolMismatchError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_S10_CLASSES_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `s10-classes-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let schoolId: string
let academicYearId: string
let gradeId: string
let adminEmail: string
let teacherSchoolUserId: string
let teacherEmail: string
let subjectId: string

let otherSchoolId: string
let otherAdminEmail: string
let otherSchoolClassId: string
let otherSchoolTeacherSchoolUserId: string
let inactiveTeacherSchoolUserId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminEmail = admin.email
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')

  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id

  const subjects = await listSubjects('junior_secondary')
  subjectId = subjects[0].id

  // A teacher, invited and accepted, to be the allocation target.
  const teacherUser = await mkAuthUser('teacher')
  teacherEmail = teacherUser.email
  await inviteTeacher(schoolId, teacherEmail, admin.id)
  const accepted = await acceptTeacherInvitation(teacherUser.id, schoolId, { full_name: 'S10 Test Teacher' })
  teacherSchoolUserId = accepted.schoolUser.id

  // A second, unrelated school + admin, for cross-school denial checks.
  const otherAdmin = await mkAuthUser('other-admin')
  otherAdminEmail = otherAdmin.email
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_OTHER_${Date.now()}` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')

  // Task 5 fixtures — a real class and a real teacher at the OTHER school,
  // to prove assignSubjectTeacher rejects them when supplied against `schoolId`.
  const otherActivation = await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
  if (otherActivation.status !== 'complete') throw new Error(`other-school fixture activation failed: ${otherActivation.error}`)
  const { data: otherClasses } = await db.from('classes').select('id').eq('school_id', otherSchoolId).limit(1)
  otherSchoolClassId = otherClasses![0].id

  const otherSchoolTeacherUser = await mkAuthUser('other-school-teacher')
  await inviteTeacher(otherSchoolId, otherSchoolTeacherUser.email, otherAdmin.id)
  const otherAccepted = await acceptTeacherInvitation(otherSchoolTeacherUser.id, otherSchoolId, { full_name: 'Other School Teacher' })
  otherSchoolTeacherSchoolUserId = otherAccepted.schoolUser.id

  // A teacher at THIS school whose membership has since been deactivated
  // (departed) — assignSubjectTeacher must reject assigning them.
  const inactiveTeacherUser = await mkAuthUser('inactive-teacher')
  await inviteTeacher(schoolId, inactiveTeacherUser.email, admin.id)
  const inactiveAccepted = await acceptTeacherInvitation(inactiveTeacherUser.id, schoolId, { full_name: 'Departed Teacher' })
  inactiveTeacherSchoolUserId = inactiveAccepted.schoolUser.id
  await db.from('school_users').update({ is_active: false }).eq('id', inactiveTeacherSchoolUserId)
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('createStream + listStreams: a new stream is created and reappears in the school\'s stream list', async () => {
  const stream = await createStream(schoolId, `${SYNTHETIC_MARKER}_East`)
  assert.equal(stream.school_id, schoolId)
  const streams = await listStreams(schoolId)
  assert.ok(streams.some(s => s.id === stream.id))
})

test('createClass: creates a class scoped to this school, grade, and academic year', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 West`,
  })
  assert.equal(cls.school_id, schoolId)
  assert.equal(cls.grade_id, gradeId)
  assert.equal(cls.display_name, `${SYNTHETIC_MARKER} Grade 7 West`)
})

test('createClass: class_teacher_id accepts a school_users.id (not a teachers.id)', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 With Teacher`,
    class_teacher_id: teacherSchoolUserId,
  })
  assert.equal(cls.class_teacher_id, teacherSchoolUserId)
})

test('assignSubjectToGrade + listGradeSubjects: subject appears assigned to the grade', async () => {
  await assignSubjectToGrade(schoolId, gradeId, subjectId, true)
  const gradeSubjects = await listGradeSubjects(schoolId, gradeId)
  assert.ok(gradeSubjects.some(gs => gs.subject_id === subjectId))
})

test('assignSubjectTeacher + listClassSubjects: teacher allocation round-trips, keyed by school_users.id', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 Allocation Target`,
  })
  await assignSubjectTeacher(schoolId, cls.id, subjectId, teacherSchoolUserId)
  const classSubjects = await listClassSubjects(cls.id)
  assert.equal(classSubjects.length, 1)
  assert.equal(classSubjects[0].teacher_id, teacherSchoolUserId)
  assert.equal(classSubjects[0].subject_id, subjectId)
})

test('assignSubjectTeacher: re-assigning the same class+subject upserts rather than duplicating', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 Upsert Target`,
  })
  await assignSubjectTeacher(schoolId, cls.id, subjectId, teacherSchoolUserId)
  await assignSubjectTeacher(schoolId, cls.id, subjectId, teacherSchoolUserId)
  const classSubjects = await listClassSubjects(cls.id)
  assert.equal(classSubjects.length, 1, 'UNIQUE(class_id, subject_id) upsert must not create a duplicate row')
})

// ── Authorization: the routes the new UI calls (POST /api/core/classes,
// POST /api/core/subjects) gate every write with requireSchoolAdmin — this
// is the composed authorization check those routes actually run, not a new
// primitive. Confirms cross-school and non-admin actors are rejected
// before any of the workflow above would ever execute for them.
test('requireSchoolAdmin rejects an admin from a DIFFERENT school acting on this schoolId', async () => {
  const client = await signInAs(otherAdminEmail)
  await assert.rejects(() => requireSchoolAdmin(client, schoolId), MembershipRequiredError)
})

test('requireSchoolAdmin rejects a teacher-tier member of THIS school attempting an admin-only action', async () => {
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => requireSchoolAdmin(client, schoolId), PermissionDeniedError)
})

test('requireSchoolAdmin allows the school\'s own admin', async () => {
  const client = await signInAs(adminEmail)
  const membership = await requireSchoolAdmin(client, schoolId)
  assert.equal(membership.role, 'school_admin')
})

// ── Task 5: assignSubjectTeacher's own cross-school scoping checks ─────────
// requireSchoolAdmin above only proves the caller's own membership in
// `schoolId` — these prove assignSubjectTeacher no longer trusts classId/
// teacherId at face value just because the caller is a real admin
// SOMEWHERE. Before this fix none of these four rejected.

test('assignSubjectTeacher: same-school teacher/class succeeds (control case)', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 Task5 Control`,
  })
  const result = await assignSubjectTeacher(schoolId, cls.id, subjectId, teacherSchoolUserId)
  assert.equal(result.unchanged, false)
})

test('assignSubjectTeacher: a class belonging to a DIFFERENT school is rejected', async () => {
  await assert.rejects(
    () => assignSubjectTeacher(schoolId, otherSchoolClassId, subjectId, teacherSchoolUserId),
    SchoolMismatchError
  )
})

test('assignSubjectTeacher: a teacher (school_users.id) belonging to a DIFFERENT school is rejected', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 Task5 CrossTeacher`,
  })
  await assert.rejects(
    () => assignSubjectTeacher(schoolId, cls.id, subjectId, otherSchoolTeacherSchoolUserId),
    SchoolMismatchError
  )
})

// Phase 2 correction (was: "a deactivated membership is rejected"). Phase 1
// rejected ANY inactive membership here, which incidentally also blocked
// assigning a still-PENDING (invited, not yet accepted) teacher — exactly
// the "admin pre-provisions before the teacher ever logs in" ordering
// Phase 2's activation flow depends on. is_active can't distinguish
// "pending" from "departed" (both are simply `false`), so
// assignSubjectTeacher no longer treats it as disqualifying — only school
// membership and role matter. This is a deliberate, evidence-driven
// change to Phase 1 behavior, not a silent regression — see
// lib/core/classes.ts's own comment at the same check.
test('assignSubjectTeacher: an inactive (pending OR departed) membership at THIS school is still ALLOWED — only cross-school is rejected', async () => {
  const cls = await createClass(schoolId, {
    grade_id: gradeId,
    academic_year_id: academicYearId,
    display_name: `${SYNTHETIC_MARKER} Grade 7 Task5 Inactive`,
  })
  const result = await assignSubjectTeacher(schoolId, cls.id, subjectId, inactiveTeacherSchoolUserId)
  assert.equal(result.unchanged, false)
})

test('assignSubjectTeacher: cross-school class+teacher together (both wrong) is still rejected, not silently accepted', async () => {
  await assert.rejects(
    () => assignSubjectTeacher(schoolId, otherSchoolClassId, subjectId, otherSchoolTeacherSchoolUserId),
    SchoolMismatchError
  )
})
