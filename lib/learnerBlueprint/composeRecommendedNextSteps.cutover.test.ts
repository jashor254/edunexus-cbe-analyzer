// lib/learnerBlueprint/composeRecommendedNextSteps.cutover.test.ts
//
// Test #23 of Phase 1 (docs/architecture/blueprint-living-action-plan-audit.md):
// proves composeRecommendedNextSteps.ts's mandatory cutover behaves exactly
// as documented — legacy fallback when no canonical, approved,
// stakeholder-visible action items exist; canonical-only (never merged)
// once at least one does.
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/composeRecommendedNextSteps.cutover.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { composeRecommendedNextSteps } from './composeRecommendedNextSteps'
import { proposeBlueprintAction, approveBlueprintAction } from './actionPlan/lifecycle'
import type { BlueprintSection, LearningCompassData, TeacherReflectionData, AttendanceData, CareerData } from './types'

const SYNTHETIC_MARKER = 'SYNTHETIC_CUTOVER_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

// This session's environment has shown sustained, intermittent network
// flakiness against the Supabase project (reproduced with a minimal
// standalone script containing zero application code) — wraps every
// fixture-setup network call, not just user creation.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
    }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function retryDb<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>, attempts = 8): Promise<{ data: T; error: null }> {
  return retryAsync(async () => {
    const result = await fn()
    if (result.error) throw result.error
    return result as { data: T; error: null }
  }, attempts)
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
  }, 5)
  return client
}

async function mkUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
  return { id: data.user.id, email }
}

function unavailable<T>(): BlueprintSection<T> {
  return { status: 'unavailable', owner: 'test', freshness: 'live', data: null, unavailableReason: 'not composed in this test' }
}

let schoolId: string
let coreLearnerId: string
let teacherUserId: string, teacherEmail: string
let adminUserId: string
let classId: string
const teacherRowIds: string[] = []

before(async () => {
  const admin = await mkUser('admin'); adminUserId = admin.id
  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email

  const school = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId))
  schoolId = school.id

  await retryDb(() => db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
  ]).select('school_id'))

  const { data: teacherRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(teacherRow!.id)

  const { data: classRow } = await retryDb(() => db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow!.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single())
  classId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db
    .from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Cutover', last_name: 'Test' })
    .select('id').single())
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await retryDb(() => db
    .from('students')
    .insert({ name: 'Cutover Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId })
    .select('id').single())
  await retryDb(() => db.from('class_students').insert({ class_id: classId, student_id: studentRow!.id }).select('class_id').single())
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort cleanup */ } }

  if (isUuid(coreLearnerId)) {
    await safely(async () => {
      const ids = (await db.from('blueprint_action_items').select('id').eq('learner_id', coreLearnerId)).data?.map(r => r.id) ?? []
      if (ids.length) await db.from('blueprint_action_item_history').delete().in('action_item_id', ids)
    })
    await safely(() => db.from('blueprint_action_items').delete().eq('learner_id', coreLearnerId))
    await safely(() => db.from('students').delete().eq('external_id', coreLearnerId))
  }
  if (isUuid(classId)) {
    await safely(() => db.from('class_students').delete().eq('class_id', classId))
    await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  }
  if (isUuid(coreLearnerId)) await safely(() => db.from('learners').delete().eq('id', coreLearnerId))
  await safely(() => db.from('teachers').delete().in('id', teacherRowIds.filter(isUuid)))
  if (isUuid(schoolId)) {
    await safely(() => db.from('school_users').delete().eq('school_id', schoolId))
    await safely(() => db.from('schools').delete().eq('id', schoolId))
  }
  for (const id of [adminUserId, teacherUserId]) {
    if (isUuid(id)) await safely(() => db.auth.admin.deleteUser(id))
  }
})

test('23a. with zero canonical action items, composeRecommendedNextSteps falls back to the legacy selector (no_action_needed, since no other signal is present)', async () => {
  const section = await composeRecommendedNextSteps(
    coreLearnerId, schoolId,
    unavailable<LearningCompassData>(), unavailable<TeacherReflectionData>(), unavailable<AttendanceData>(), unavailable<CareerData>()
  )
  assert.equal(section.status, 'available')
  assert.equal(section.data?.actions.length, 1)
  assert.equal(section.data?.actions[0].actionType, 'no_action_needed')
})

test('23b. a proposed-but-not-yet-approved canonical item does not trigger the cutover — legacy fallback still runs', async () => {
  const client = await signInAs(teacherEmail)
  await proposeBlueprintAction(client, {
    coreLearnerId,
    context: 'current_term',
    visibility: 'parent_visible',
    title: 'Not yet approved',
    rationale: 'Draft only.',
    intendedOutcome: 'n/a',
    successIndicator: 'n/a',
    proposalSource: 'teacher',
  })

  const section = await composeRecommendedNextSteps(
    coreLearnerId, schoolId,
    unavailable<LearningCompassData>(), unavailable<TeacherReflectionData>(), unavailable<AttendanceData>(), unavailable<CareerData>()
  )
  assert.equal(section.data?.actions[0].actionType, 'no_action_needed', 'a draft item must not trigger the canonical cutover')
})

test('23c. an approved, teacher_only-visibility item does not trigger the cutover either (not stakeholder-visible)', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, {
    coreLearnerId,
    context: 'current_term',
    visibility: 'teacher_only',
    title: 'Teacher-only approved item',
    rationale: 'Internal only.',
    // Real outcome and indicator, not 'n/a'. This test is about VISIBILITY, but
    // it has to approve the item to get there, and `requireCoherentApproval`
    // (added after this test was written) refuses to approve an action whose
    // success indicator is too generic to check against evidence. The old 'n/a'
    // made the test fail before it reached its own assertion.
    intendedOutcome: 'Kiswahili comprehension improves from Level 2 to Level 3.',
    successIndicator: 'Next Kiswahili assessment shows Level 3.',
    proposalSource: 'teacher',
  })
  await approveBlueprintAction(client, item.id)

  const section = await composeRecommendedNextSteps(
    coreLearnerId, schoolId,
    unavailable<LearningCompassData>(), unavailable<TeacherReflectionData>(), unavailable<AttendanceData>(), unavailable<CareerData>()
  )
  assert.equal(section.data?.actions[0].actionType, 'no_action_needed', 'a teacher_only item must never surface via the parent cutover')
})

test('23d. an approved, parent-visible canonical item switches composeRecommendedNextSteps to the canonical-only path — never merged with the legacy selector', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, {
    coreLearnerId,
    context: 'current_term',
    visibility: 'parent_visible',
    title: 'Practice fractions at home',
    rationale: 'Recent evidence shows steady progress in Mathematics.',
    intendedOutcome: 'Reach Level 3 in fractions.',
    parentSupport: 'Ask about one fraction problem a week.',
    successIndicator: 'Next assessment shows Level 3.',
    proposalSource: 'teacher',
  })
  await approveBlueprintAction(client, item.id)

  const section = await composeRecommendedNextSteps(
    coreLearnerId, schoolId,
    unavailable<LearningCompassData>(), unavailable<TeacherReflectionData>(), unavailable<AttendanceData>(), unavailable<CareerData>()
  )
  assert.equal(section.status, 'available')
  const actions = section.data?.actions ?? []
  assert.equal(actions.length, 1)
  assert.equal(actions[0].actionType, 'canonical_action_item')
  assert.equal(actions[0].title, 'Practice fractions at home')
  assert.equal(actions[0].sourceDomain, 'Blueprint Action Plan')
  assert.ok(!actions.some(a => a.actionType === 'no_action_needed'), 'the legacy selector must not also run once a canonical item exists')
})
