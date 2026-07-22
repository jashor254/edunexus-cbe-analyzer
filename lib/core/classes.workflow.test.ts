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
import { PermissionDeniedError, MembershipRequiredError } from '@/lib/core/errors'

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
