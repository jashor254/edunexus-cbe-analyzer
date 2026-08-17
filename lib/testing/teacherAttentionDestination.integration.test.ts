// lib/testing/teacherAttentionDestination.integration.test.ts
//
// Phase 1 / P0-C — proves the authorization half of the attention-feed
// destination against real (synthetic, cleaned-up) rows and real
// authenticated sessions.
//
// P0-C repointed every per-learner AttentionItem at
// `/teacher/reports/blueprint/{legacy students.id}`, which resolves the
// bridged Core learner and redirects into `/student/blueprint/[learnerId]`.
// That destination owns its own gate (`requireLearnerAccess`), and the
// teacher action sections behind it own a narrower one
// (`canManageLearnerRecordCore`, via listReviewableBlueprintActionsForLearner).
// Since the feed can now send a teacher there, both gates must be proven
// for exactly the identifier the feed carries — not assumed from the fact
// that the class roster already linked to the same page.
//
// Tests the permission layer and the identity resolution directly rather
// than over HTTP: the destination is a `redirect()`-only server component,
// and the known Next.js notFound()/streaming quirk documented in
// parentExperienceConvergence.http.integration.test.ts makes page-body
// assertions the unreliable layer. What actually decides access is
// `requireLearnerAccess` / `canManageLearnerRecordCore`, and those are
// exercised here for real.
//
// ⚠️ Creates real (throwaway) auth.users accounts, schools, a teacher, a
// class, a Core learner and its legacy bridge — all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/testing/teacherAttentionDestination.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { canViewLearnerRecord, requireLearnerAccess, canManageLearnerRecordCore } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { listReviewableBlueprintActionsForLearner } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_P0C_ATTENTION_DESTINATION_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

// Same bounded setup-retry pattern as the other integration tests in this
// repo — this environment has shown intermittent Supabase auth/network
// flakiness. Never wrapped around an assertion.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function retryDb<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<{ data: T }> {
  return retryAsync(async () => {
    const result = await fn()
    if (result.error) throw result.error
    return result as { data: T }
  })
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('signInAs: session established but getUser() returned no user')
  }, 6)
  return client
}

let schoolId: string
let otherSchoolId: string
let coreLearnerId: string
let legacyStudentId: string
let unbridgedStudentId: string
let classId: string

let teacherUserId: string, teacherEmail: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string

const teacherRowIds: string[] = []

before(async () => {
  const mkUser = async (label: string) => {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
    return { id: data.user.id, email }
  }

  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email
  const unrelated = await mkUser('unrelated'); unrelatedTeacherUserId = unrelated.id; unrelatedTeacherEmail = unrelated.email
  const otherSchool = await mkUser('other-school'); otherSchoolTeacherUserId = otherSchool.id; otherSchoolTeacherEmail = otherSchool.email

  const school = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherUserId))
  schoolId = school.id
  const other = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other` }, otherSchoolTeacherUserId))
  otherSchoolId = other.id

  await retryDb(() => db.from('school_users').insert([
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ]))

  for (const [userId] of [[teacherUserId], [unrelatedTeacherUserId], [otherSchoolTeacherUserId]]) {
    const { data: row } = await retryDb(() => db.from('teachers')
      .insert({ user_id: userId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
    teacherRowIds.push(row!.id)
  }

  const { data: classRow } = await retryDb(() => db.from('teacher_classes')
    .insert({ teacher_id: teacherRowIds[0], name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single())
  classId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Mary', last_name: 'Test' })
    .select('id').single())
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await retryDb(() => db.from('students')
    .insert({
      name: 'Mary Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', external_id: coreLearnerId,
    })
    .select('id').single())
  legacyStudentId = studentRow!.id

  await retryDb(() => db.from('class_students')
    .insert({ class_id: classId, student_id: legacyStudentId }).select('class_id').single())

  // A legacy student that was never bridged to a Core learner — the
  // destination's own documented "unavailable" branch.
  const { data: unbridged } = await retryDb(() => db.from('students')
    .insert({
      name: 'Unbridged Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', external_id: null,
    })
    .select('id').single())
  unbridgedStudentId = unbridged!.id
  await retryDb(() => db.from('class_students')
    .insert({ class_id: classId, student_id: unbridgedStudentId }).select('class_id').single())
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort cleanup */ } }

  if (isUuid(classId)) await safely(() => db.from('class_students').delete().eq('class_id', classId))
  for (const id of [legacyStudentId, unbridgedStudentId]) {
    if (isUuid(id)) await safely(() => db.from('students').delete().eq('id', id))
  }
  if (isUuid(classId)) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (isUuid(coreLearnerId)) await safely(() => db.from('learners').delete().eq('id', coreLearnerId))
  await safely(() => db.from('teachers').delete().in('id', teacherRowIds.filter(isUuid)))
  const schools = [schoolId, otherSchoolId].filter(isUuid)
  if (schools.length) {
    await safely(() => db.from('school_users').delete().in('school_id', schools))
    await safely(() => db.from('schools').delete().in('id', schools))
  }
  for (const id of [teacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId]) {
    if (isUuid(id)) await deleteAuthUserOrThrow(db, id)
  }
})

// ── 2. The destination resolves ─────────────────────────────────────────────

test('2. the destination resolves the legacy students.id the feed carries to a Core learner', async () => {
  // Exactly what app/teacher/reports/blueprint/[studentId]/page.tsx does.
  const [row] = await repos.teachers.findExternalIdsByStudentIds([legacyStudentId])
  assert.equal(row?.external_id, coreLearnerId, 'the feed\'s identifier must resolve to the Core learner')

  // And the school the canonical Blueprint route will gate against.
  const resolvedSchoolId = await repos.learners.findSchoolId(coreLearnerId)
  assert.equal(resolvedSchoolId, schoolId)
})

// ── 5. The correct learner's Blueprint is reachable by the right teacher ────

test('5. the teacher of record can view this learner\'s record at the destination', async () => {
  const client = await signInAs(teacherEmail)
  assert.equal(await canViewLearnerRecord(client, schoolId, asLearnerId(coreLearnerId)), true)
  const user = await requireLearnerAccess(client, schoolId, asLearnerId(coreLearnerId))
  assert.ok(user.id, 'requireLearnerAccess returns the authenticated user for an authorized teacher')
})

// ── 3. An unauthorized teacher cannot ───────────────────────────────────────

test('3. a teacher who does not teach this learner is refused at the destination', async () => {
  const client = await signInAs(unrelatedTeacherEmail)
  assert.equal(await canViewLearnerRecord(client, schoolId, asLearnerId(coreLearnerId)), false)
  await assert.rejects(() => requireLearnerAccess(client, schoolId, asLearnerId(coreLearnerId)), ResourceOwnershipError)
})

// ── 4. Cross-school access fails ────────────────────────────────────────────

test('4. a teacher at a different school is refused (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolTeacherEmail)
  assert.equal(await canViewLearnerRecord(client, schoolId, asLearnerId(coreLearnerId)), false)
  await assert.rejects(() => requireLearnerAccess(client, schoolId, asLearnerId(coreLearnerId)), ResourceOwnershipError)
})

// ── 6. Teacher action sections are available when permitted ─────────────────

test('6. the teacher of record reaches the action-plan capability at the destination', async () => {
  const client = await signInAs(teacherEmail)
  assert.equal(await canManageLearnerRecordCore(client, schoolId, asLearnerId(coreLearnerId)), true)

  // The exact call app/student/blueprint/[learnerId]/page.tsx makes to
  // decide whether to render the candidate queue + action plan + delivery
  // panels. An empty list is the correct result for a learner with no
  // approved actions yet — what matters is that it does not throw
  // ResourceOwnershipError for this teacher.
  const items = await listReviewableBlueprintActionsForLearner(client, asLearnerId(coreLearnerId))
  assert.ok(Array.isArray(items), 'an authorized teacher gets the action list, not a permission error')
})

test('6b. an unrelated teacher does NOT reach the action-plan capability', async () => {
  const client = await signInAs(unrelatedTeacherEmail)
  assert.equal(await canManageLearnerRecordCore(client, schoolId, asLearnerId(coreLearnerId)), false)
  await assert.rejects(
    () => listReviewableBlueprintActionsForLearner(client, asLearnerId(coreLearnerId)),
    ResourceOwnershipError,
  )
})

// ── 7. An unbridged legacy learner fails safely ─────────────────────────────

test('7. a legacy student with no Core bridge resolves to null rather than throwing', async () => {
  const [row] = await repos.teachers.findExternalIdsByStudentIds([unbridgedStudentId])
  const coreId = row?.external_id ?? null
  assert.equal(coreId, null, 'no bridge means no Core learner id — the destination renders its unavailable state')
})
