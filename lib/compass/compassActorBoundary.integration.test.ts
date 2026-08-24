// lib/compass/compassActorBoundary.integration.test.ts
//
// Parent Portal Phase P2 (Compass / Learner-Action Access Boundary Audit) —
// proves, against real rows in local Docker Supabase, the two fixes made to
// lib/compass/ownership.ts:
//
//   1. resolveParentOwnership() used to check ONLY `students.parent_user_id`
//      — the same legacy-only identity gap P1 already found and fixed on
//      /api/student/{resources,materials,calendar,announcements}. An
//      institutional-only guardian (linked solely via `learner_guardians`,
//      never `students.parent_user_id`) got a silent 403 on Progress,
//      Holiday and the Compass subject picker, even though the PAGE-level
//      `requireParent()` check upstream (Core learner id space) had already
//      let them through. Fixed by bridging `resolveParent()`'s
//      `coreLearnerIds` back to the legacy compatibility `students.id`
//      space, same primitive P1's `resolveFamilyStudentIds` uses.
//
//   2. resolveCompassMutationAccess() is new: teacher + learner-self only,
//      parent excluded outright. `/api/learn` (POST) and `/api/learn/end`
//      (POST) — the two routes that mint learner-attributed Evidence/XP —
//      now use this instead of the combined resolveCompassStudentAccess.
//      Progress/Holiday/the subject picker are read-only and keep using the
//      combined resolver — parent visibility there is unaffected.
//
// Run:
//   TEST_SUPABASE_URL=... TEST_SUPABASE_SERVICE_ROLE_KEY=... TEST_SUPABASE_PROJECT_REF=local-docker \
//   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
//   npx tsx --experimental-test-module-mocks --test lib/compass/compassActorBoundary.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { resolveCompassStudentAccess, resolveCompassMutationAccess } from './ownership'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_P2_COMPASS_ACTOR_BOUNDARY'
const db = createServiceClient()

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

let teacherUserId: string
let teacherRowId: string

// Institutional family: guardian linked ONLY via learner_guardians.
let institutionalParentUserId: string
let institutionalLearnerId: string
let institutionalStudentId: string // Phase 1C compatibility row, no parent_user_id/user_id

// Legacy family: guardian linked ONLY via students.parent_user_id.
let legacyParentUserId: string
let legacyStudentId: string

// Self-login learner.
let selfLearnerUserId: string
let selfStudentId: string

// Unrelated guardian — linked to nothing.
let unrelatedUserId: string

async function mkUser(label: string): Promise<string> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  return data.user.id
}

before(async () => {
  teacherUserId = await mkUser('teacher')
  const { data: teacherRow, error: teacherErr } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: MARKER, school: MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr
  teacherRowId = teacherRow.id
  teacherRowIds.push(teacherRowId)

  // ── Institutional family ──────────────────────────────────────────────
  institutionalParentUserId = await mkUser('inst-parent')

  const { data: school, error: schoolErr } = await db.from('schools').insert({ school_name: `${MARKER}_school` }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const { data: learner, error: learnerErr } = await db.from('learners')
    .insert({ school_id: school.id, admission_number: `${MARKER}-001`, first_name: 'Institutional', last_name: 'Child' })
    .select('id').single()
  if (learnerErr) throw learnerErr
  institutionalLearnerId = learner.id
  learnerIds.push(institutionalLearnerId)

  const { error: guardianErr } = await db.from('learner_guardians')
    .insert({ learner_id: institutionalLearnerId, school_id: school.id, user_id: institutionalParentUserId, relationship: 'mother', full_name: MARKER, phone: '0700000000' })
  if (guardianErr) throw guardianErr

  // Phase 1C compatibility row — bridged via external_id, deliberately NO
  // user_id/parent_user_id, the exact shape P0/P1 found unreachable by the
  // old parent_user_id-only check.
  const { data: instStudent, error: instStudentErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', external_id: institutionalLearnerId, school_id: school.id })
    .select('id').single()
  if (instStudentErr) throw instStudentErr
  institutionalStudentId = instStudent.id
  studentIds.push(institutionalStudentId)

  // ── Legacy family ──────────────────────────────────────────────────────
  legacyParentUserId = await mkUser('legacy-parent')
  const { data: legacyStudent, error: legacyErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', parent_user_id: legacyParentUserId })
    .select('id').single()
  if (legacyErr) throw legacyErr
  legacyStudentId = legacyStudent.id
  studentIds.push(legacyStudentId)

  // ── Self-login learner ───────────────────────────────────────────────
  selfLearnerUserId = await mkUser('self-learner')
  const { data: selfStudent, error: selfErr } = await db.from('students')
    .insert({ teacher_id: teacherRowId, name: MARKER, grade: 8, level: 'Junior School', school: MARKER, added_by: 'teacher', user_id: selfLearnerUserId })
    .select('id').single()
  if (selfErr) throw selfErr
  selfStudentId = selfStudent.id
  studentIds.push(selfStudentId)

  // ── Unrelated ────────────────────────────────────────────────────────
  unrelatedUserId = await mkUser('unrelated')
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  for (const id of studentIds) await safely(() => db.from('students').delete().eq('id', id))
  for (const id of learnerIds) {
    await safely(() => db.from('learner_guardians').delete().eq('learner_id', id))
    await safely(() => db.from('learners').delete().eq('id', id))
  }
  for (const id of schoolIds) await safely(() => db.from('schools').delete().eq('id', id))
  for (const id of teacherRowIds) await safely(() => db.from('teachers').delete().eq('id', id))
  for (const u of authUserIds) await deleteAuthUserOrThrow(db, u)
})

// ── Institutional guardian — the P2 fix ─────────────────────────────────────

test('institutional-only guardian: READ access now granted (was 403 before the P2 fix)', async () => {
  const access = await resolveCompassStudentAccess(institutionalParentUserId, institutionalStudentId)
  assert.equal(access.allowed, true)
  assert.equal((access as { via: string }).via, 'parent')
})

test('institutional-only guardian: MUTATION access denied (parent may view, not act)', async () => {
  const access = await resolveCompassMutationAccess(institutionalParentUserId, institutionalStudentId)
  assert.equal(access.allowed, false)
})

// ── Legacy guardian — unchanged behavior ────────────────────────────────────

test('legacy guardian (parent_user_id): READ access unchanged', async () => {
  const access = await resolveCompassStudentAccess(legacyParentUserId, legacyStudentId)
  assert.equal(access.allowed, true)
  assert.equal((access as { via: string }).via, 'parent')
})

test('legacy guardian (parent_user_id): MUTATION access denied', async () => {
  const access = await resolveCompassMutationAccess(legacyParentUserId, legacyStudentId)
  assert.equal(access.allowed, false)
})

// ── Learner-self — must retain full access, unaffected by the P2 change ────

test('learner-self: READ access unchanged', async () => {
  const access = await resolveCompassStudentAccess(selfLearnerUserId, selfStudentId)
  assert.equal(access.allowed, true)
  assert.equal((access as { via: string }).via, 'learner')
})

test('learner-self: MUTATION access GRANTED — the whole point of Compass', async () => {
  const access = await resolveCompassMutationAccess(selfLearnerUserId, selfStudentId)
  assert.equal(access.allowed, true)
  assert.equal((access as { via: string }).via, 'learner')
})

// ── Teacher — unchanged ──────────────────────────────────────────────────

test('teacher (direct link): READ and MUTATION both granted, unchanged', async () => {
  const read = await resolveCompassStudentAccess(teacherUserId, institutionalStudentId)
  assert.equal(read.allowed, true)
  const mutate = await resolveCompassMutationAccess(teacherUserId, institutionalStudentId)
  assert.equal(mutate.allowed, true)
})

// ── Unrelated guardian — must stay denied everywhere ────────────────────────

test('unrelated user: denied READ and MUTATION on every student', async () => {
  for (const sid of [institutionalStudentId, legacyStudentId, selfStudentId]) {
    const read = await resolveCompassStudentAccess(unrelatedUserId, sid)
    assert.equal(read.allowed, false, `unrelated user should not READ ${sid}`)
    const mutate = await resolveCompassMutationAccess(unrelatedUserId, sid)
    assert.equal(mutate.allowed, false, `unrelated user should not MUTATE ${sid}`)
  }
})

// ── Mixed-family proof: institutional parent must not gain rights over the ──
// ── unrelated legacy student, and vice versa — no cross-student leakage.  ──

test('mixed-family isolation: institutional parent denied on legacy student, legacy parent denied on institutional student', async () => {
  const a = await resolveCompassStudentAccess(institutionalParentUserId, legacyStudentId)
  assert.equal(a.allowed, false)
  const b = await resolveCompassStudentAccess(legacyParentUserId, institutionalStudentId)
  assert.equal(b.allowed, false)
})
