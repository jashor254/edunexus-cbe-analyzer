// lib/classes/classEnrollment.integration.test.ts
//
// Security audit 2026-10-30, F-02, against a real database: joining a Solo
// Teacher class by code is bounded per account (including under concurrent
// guessing), existing legacy and Core codes keep working, and a teacher can
// remove a learner — after which that learner's class membership, and with
// it new signed download URLs for the class's files, are gone, while their
// other classes and records are untouched. Non-owner teachers cannot remove;
// Core-bridged rosters are left to the school's enrolment.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { joinClassByCode } from '@/lib/classes/joinClassByCode'
import { removeClassMember } from '@/lib/classes/removeClassMember'
import { generateClassCode } from '@/lib/classes/classCode'
import { canAccessClassResource } from '@/lib/classResources/resourceAccess'
import { requireClassMembership } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { ATTEMPT_LIMITS } from '@/lib/config/abuseLimits'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_CLASS_ENROLMENT'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const { limit: JOIN_LIMIT, bucket: JOIN_BUCKET } = ATTEMPT_LIMITS.classJoinByCode

type User = { id: string; email: string; password: string }
const users: User[] = []
const studentIds: string[] = []
const classIds: string[] = []

async function mkUser(label: string): Promise<User> {
  const email = `enrol-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  const user = { id: data.user.id, email, password }
  users.push(user)
  return user
}

async function signIn(user: User) {
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return client
}

async function mkTeacher(user: User): Promise<string> {
  const { data, error } = await db.from('teachers').insert({ user_id: user.id, full_name: `${MARKER} teacher`, school: MARKER }).select('id').single()
  if (error || !data) throw new Error(`teacher: ${error?.message}`)
  return data.id
}

async function mkClass(teacherId: string, classCode: string, externalId: string | null = null): Promise<string> {
  const { data, error } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: `${MARKER} class`, grade: 8, subject: 'Mathematics', academic_year: '2026', class_code: classCode, external_id: externalId })
    .select('id').single()
  if (error || !data) throw new Error(`class: ${error?.message}`)
  classIds.push(data.id)
  return data.id
}

async function mkOwnStudent(owner: User): Promise<string> {
  const { data, error } = await db.from('students').insert({ user_id: owner.id, name: `${MARKER} learner`, grade: 8, school: MARKER }).select('id').single()
  if (error || !data) throw new Error(`student: ${error?.message}`)
  studentIds.push(data.id)
  return data.id
}

async function isMember(classId: string, studentId: string): Promise<boolean> {
  const { data, error } = await db.from('class_students').select('id').eq('class_id', classId).eq('student_id', studentId)
  if (error) throw new Error(`isMember: ${error.message}`)
  return data.length > 0
}

const rand = (n: number) => randomBytes(n).toString('hex').toUpperCase()

let teacherA: User, teacherB: User
let teacherAId: string
let parent: User
let parentStudent: string
let legacyCode: string, newCode: string, coreCode: string
let legacyClass: string, newClass: string, bridgedClass: string

before(async () => {
  teacherA = await mkUser('teacher-a')
  teacherB = await mkUser('teacher-b')
  teacherAId = await mkTeacher(teacherA)
  await mkTeacher(teacherB)

  // An old-format code exactly like those already issued: prefix + 2 chars.
  legacyCode = `SYN826${rand(1)}`
  newCode    = generateClassCode('Synthetic', 8, '2026')
  coreCode   = `CORE-${rand(4)}-${rand(4)}`
  legacyClass  = await mkClass(teacherAId, legacyCode)
  newClass     = await mkClass(teacherAId, newCode)
  bridgedClass = await mkClass(teacherAId, coreCode, randomUUID())

  parent = await mkUser('parent')
  parentStudent = await mkOwnStudent(parent)
})

after(async () => {
  const subjects = users.map(u => u.id)
  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['rate_limit_attempts', () => db.from('rate_limit_attempts').delete().in('subject', subjects)],
    ['class_students',      () => db.from('class_students').delete().in('class_id', classIds)],
    ['teacher_classes',     () => db.from('teacher_classes').delete().in('id', classIds)],
    ['students',            () => db.from('students').delete().in('id', studentIds)],
    ['teachers',            () => db.from('teachers').delete().in('user_id', subjects)],
  ]
  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) throw new Error(`cleanup ${name}: ${error.message}`)
  }
  for (const u of users) await deleteAuthUserOrThrow(db, u.id)
})

test('an existing legacy-format code still joins, and a repeat is already_enrolled', async () => {
  const joined = await joinClassByCode({ userId: parent.id, studentId: parentStudent, classCode: legacyCode.toLowerCase() }, { db })
  assert.equal(joined.status, 'joined')
  assert.equal(await isMember(legacyClass, parentStudent), true)
  assert.deepEqual(await joinClassByCode({ userId: parent.id, studentId: parentStudent, classCode: legacyCode }, { db }), { status: 'already_enrolled' })
})

test('new-format codes and Core-bridged codes join as before', async () => {
  assert.equal((await joinClassByCode({ userId: parent.id, studentId: parentStudent, classCode: newCode }, { db })).status, 'joined')
  assert.equal((await joinClassByCode({ userId: parent.id, studentId: parentStudent, classCode: coreCode }, { db })).status, 'joined')
})

test('successful joins are refunded: they never count toward the limit', async () => {
  const { data, error } = await db.from('rate_limit_attempts').select('id').eq('bucket', JOIN_BUCKET).eq('subject', parent.id)
  if (error) throw new Error(error.message)
  assert.equal(data.length, 0)
})

test(`after ${JOIN_LIMIT} wrong codes the account is refused — even when it then tries a real code`, async () => {
  const guesser = await mkUser('guesser')
  const guesserStudent = await mkOwnStudent(guesser)
  for (let i = 0; i < JOIN_LIMIT; i++) {
    const r = await joinClassByCode({ userId: guesser.id, studentId: guesserStudent, classCode: `SYN826${rand(1)}X` }, { db })
    assert.equal(r.status, 'not_found')
  }
  assert.deepEqual(await joinClassByCode({ userId: guesser.id, studentId: guesserStudent, classCode: legacyCode }, { db }), { status: 'rate_limited' })
  assert.equal(await isMember(legacyClass, guesserStudent), false)
})

test(`20 concurrent wrong guesses yield at most ${JOIN_LIMIT} lookups`, async () => {
  const racer = await mkUser('racer')
  const racerStudent = await mkOwnStudent(racer)
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    joinClassByCode({ userId: racer.id, studentId: racerStudent, classCode: `NOPE${rand(4)}` }, { db })))
  assert.equal(results.filter(r => r.status === 'not_found').length, JOIN_LIMIT)
  assert.equal(results.filter(r => r.status === 'rate_limited').length, 20 - JOIN_LIMIT)
})

test('a teacher who does not own the class cannot remove its learners', async () => {
  const clientB = await signIn(teacherB)
  await assert.rejects(removeClassMember(clientB, legacyClass, parentStudent, { db }), ResourceOwnershipError)
  assert.equal(await isMember(legacyClass, parentStudent), true)
})

test('the class teacher removes a learner: membership and new file access end, other classes and records remain', async () => {
  const resource = { teacher_id: teacherAId, class_id: legacyClass }
  assert.equal(await canAccessClassResource(parent.id, resource, { db }), true, 'precondition: parent could download')

  const clientA = await signIn(teacherA)
  assert.deepEqual(await removeClassMember(clientA, legacyClass, parentStudent, { db }), { status: 'removed' })

  assert.equal(await isMember(legacyClass, parentStudent), false)
  await assert.rejects(requireClassMembership(parentStudent, legacyClass, db), ResourceOwnershipError)
  assert.equal(await canAccessClassResource(parent.id, resource, { db }), false, 'removed learner still gets new signed URLs')

  assert.equal(await isMember(newClass, parentStudent), true, 'an unrelated membership was removed')
  const { data: student } = await db.from('students').select('id').eq('id', parentStudent).maybeSingle()
  assert.ok(student, 'the learner record itself was deleted')
})

test('removing the same learner twice is safe and reports not_member', async () => {
  const clientA = await signIn(teacherA)
  assert.deepEqual(await removeClassMember(clientA, legacyClass, parentStudent, { db }), { status: 'not_member' })
})

test("a Core-bridged class's roster is left to the school's enrolment", async () => {
  const clientA = await signIn(teacherA)
  assert.deepEqual(await removeClassMember(clientA, bridgedClass, parentStudent, { db }), { status: 'managed_by_school' })
  assert.equal(await isMember(bridgedClass, parentStudent), true)
})
