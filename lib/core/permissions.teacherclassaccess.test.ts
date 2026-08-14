// lib/core/permissions.teacherclassaccess.test.ts
//
// Phase 0 (docs/architecture/blueprint-living-action-plan-audit.md §1, §6-7):
// `canViewLearner`'s teacher branch used to check only legacy
// `students.teacher_id`-of-record, while the DB-level RLS policy already
// correctly derives teacher access via `class_students -> teacher_classes ->
// teachers` (`auth_is_teacher_of_student`, `20260525_rls_policies.sql`) OR
// the legacy of-record column (`auth_is_direct_teacher_of_student`,
// `20260720130000_sprint1_evidence_rls_bypass_fix.sql`). This file proves
// the corrected app-level rule now matches both RLS branches, keeps the two
// paths isolated from each other (a class-linked teacher gets no access via
// the legacy-only student, and vice versa), and leaves every other access
// path (self/parent/admin/unrelated) exactly as it was.
//
// Integration test against real (synthetic, cleaned-up) rows and real
// authenticated sessions, against the real `canViewLearner` boundary — no
// mocking of the authorization result itself.
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.teacherclassaccess.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { canViewLearner } from '@/lib/core/permissions'
import { asStudentId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_TEACHER_CLASS_ACCESS_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let schoolId: string
let otherSchoolId: string

let adminUserId: string, adminEmail: string
let classTeacherUserId: string, classTeacherEmail: string, classTeacherId: string
let legacyTeacherUserId: string, legacyTeacherEmail: string, legacyTeacherId: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string
let parentUserId: string, parentEmail: string
let outsiderUserId: string, outsiderEmail: string
let selfStudentUserId: string, selfStudentEmail: string

let classStudentId: string      // access only via class_students
let legacyOnlyStudentId: string // access only via legacy teacher_id
let selfStudentId: string

let classId: string
const teacherRowIds: string[] = []

before(async () => {
  // db.auth.admin.createUser is observed in this environment to
  // intermittently fail (a transient Supabase auth-layer flake, reproduced
  // with a minimal standalone script containing zero application code) —
  // retried rather than allowed to crash fixture setup.
  const mkUser = async (label: string) => {
    const email = `teacherclassaccess-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    let lastError: unknown
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
        if (!error) return { id: data.user.id, email }
        lastError = error
      } catch (err) {
        lastError = err
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
    throw lastError
  }

  const admin = await mkUser('admin'); adminUserId = admin.id; adminEmail = admin.email
  const classTeacher = await mkUser('class-teacher'); classTeacherUserId = classTeacher.id; classTeacherEmail = classTeacher.email
  const legacyTeacher = await mkUser('legacy-teacher'); legacyTeacherUserId = legacyTeacher.id; legacyTeacherEmail = legacyTeacher.email
  const unrelatedTeacher = await mkUser('unrelated-teacher'); unrelatedTeacherUserId = unrelatedTeacher.id; unrelatedTeacherEmail = unrelatedTeacher.email
  const otherSchoolTeacher = await mkUser('other-school-teacher'); otherSchoolTeacherUserId = otherSchoolTeacher.id; otherSchoolTeacherEmail = otherSchoolTeacher.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const outsider = await mkUser('outsider'); outsiderUserId = outsider.id; outsiderEmail = outsider.email
  const selfStudent = await mkUser('self-student'); selfStudentUserId = selfStudent.id; selfStudentEmail = selfStudent.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolTeacherUserId)
  otherSchoolId = otherSchool.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: classTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: legacyTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ])

  const { data: classTeacherRow } = await db.from('teachers')
    .insert({ user_id: classTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  classTeacherId = classTeacherRow!.id; teacherRowIds.push(classTeacherId)

  const { data: legacyTeacherRow } = await db.from('teachers')
    .insert({ user_id: legacyTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  legacyTeacherId = legacyTeacherRow!.id; teacherRowIds.push(legacyTeacherId)

  const { data: unrelatedTeacherRow } = await db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: otherSchoolTeacherRow } = await db.from('teachers')
    .insert({ user_id: otherSchoolTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(otherSchoolTeacherRow!.id)

  const { data: classRow, error: classError } = await db
    .from('teacher_classes')
    .insert({ teacher_id: classTeacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single()
  if (classError) throw new Error(`seed teacher_classes failed: ${classError.message}`)
  classId = classRow!.id

  // Student accessible ONLY via class_students (no teacher_id-of-record set).
  const { data: classStudentRow, error: classStudentErr } = await db.from('students').insert({
    name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher',
    parent_user_id: parentUserId,
  }).select('id').single()
  if (classStudentErr) throw new Error(`seed class-only student failed: ${classStudentErr.message}`)
  classStudentId = classStudentRow!.id
  await db.from('class_students').insert({ class_id: classId, student_id: classStudentId })

  // Student accessible ONLY via legacy teacher_id-of-record (no class_students row).
  const { data: legacyStudentRow, error: legacyStudentErr } = await db.from('students').insert({
    teacher_id: legacyTeacherId, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher',
  }).select('id').single()
  if (legacyStudentErr) throw new Error(`seed legacy-only student failed: ${legacyStudentErr.message}`)
  legacyOnlyStudentId = legacyStudentRow!.id

  // Student for self-access.
  const { data: selfStudentRow, error: selfStudentErr } = await db.from('students').insert({
    user_id: selfStudentUserId, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher',
  }).select('id').single()
  if (selfStudentErr) throw new Error(`seed self-access student failed: ${selfStudentErr.message}`)
  selfStudentId = selfStudentRow!.id
})

after(async () => {
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('students').delete().in('id', [classStudentId, legacyOnlyStudentId, selfStudentId])
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('school_users').delete().in('school_id', [schoolId, otherSchoolId])
  await db.from('schools').delete().in('id', [schoolId, otherSchoolId])
  for (const id of [adminUserId, classTeacherUserId, legacyTeacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId, parentUserId, outsiderUserId, selfStudentUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('canViewLearner: a teacher linked through class_students can view the learner', async () => {
  const client = await signInAs(classTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), true)
})

test('canViewLearner: a teacher not linked to any of the learner\'s classes cannot view them (fails closed)', async () => {
  const client = await signInAs(unrelatedTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), false)
})

test('canViewLearner: a teacher who is legitimately staff at a DIFFERENT school cannot view the learner (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), false)
})

test('canViewLearner: legacy teacher_id-of-record compatibility path still grants access (documented Phase 0 decision — retained because RLS still honors it)', async () => {
  const client = await signInAs(legacyTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(legacyOnlyStudentId)), true)
})

test('canViewLearner: the class-linked teacher has no access to the legacy-only student (the two paths are isolated, not a blanket grant)', async () => {
  const client = await signInAs(classTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(legacyOnlyStudentId)), false)
})

test('canViewLearner: the legacy-of-record teacher has no access to the class-only student (isolated the other direction too)', async () => {
  const client = await signInAs(legacyTeacherEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), false)
})

test('canViewLearner: parent access is unchanged', async () => {
  const client = await signInAs(parentEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), true)
})

test('canViewLearner: learner self-access is unchanged', async () => {
  const client = await signInAs(selfStudentEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(selfStudentId)), true)
})

test('canViewLearner: school-admin access is unchanged', async () => {
  const client = await signInAs(adminEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), true)
})

test('canViewLearner: a fully unrelated account (no role at all) is denied — fails closed', async () => {
  const client = await signInAs(outsiderEmail)
  assert.equal(await canViewLearner(client, schoolId, asStudentId(classStudentId)), false)
})
