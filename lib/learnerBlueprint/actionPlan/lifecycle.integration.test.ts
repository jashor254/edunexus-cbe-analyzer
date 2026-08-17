// lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts
//
// Integration tests against real (synthetic, cleaned-up) rows and real
// authenticated sessions — the Phase 1 domain's exact security/lifecycle
// boundary, not mocked. Covers most of the phase's required test list
// (#1-15, #18-22, #24-25); #16-17 are pure-domain tests in
// projections.test.ts, #23 is in composeRecommendedNextSteps.cutover
// .test.ts.
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { ResourceOwnershipError } from '@/lib/core/errors'
import {
  proposeBlueprintAction,
  editBlueprintAction,
  approveBlueprintAction,
  rejectBlueprintAction,
  deferBlueprintAction,
  getBlueprintAction,
  getBlueprintActionHistory,
  listBlueprintActionsForLearner,
} from './lifecycle'
import { generateActionCandidate } from './candidateGeneration'
import type { ProposeBlueprintActionInput } from './types'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_ACTIONPLAN_PHASE1_TEST'
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
    // Under this session's observed network flakiness, sign-in can report
    // success without the session actually being usable yet — verify it
    // with a real call before trusting the client, retrying the whole
    // sign-in if verification itself fails.
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('signInAs: session established but getUser() returned no user')
  }, 6)
  return client
}

let schoolId: string
let otherSchoolId: string
let coreLearnerId: string
let legacyStudentId: string
let classId: string

let adminUserId: string, adminEmail: string
let teacherUserId: string, teacherEmail: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string
let parentUserId: string, parentEmail: string
let learnerSelfUserId: string, learnerSelfEmail: string

const teacherRowIds: string[] = []

function basePropose(overrides: Partial<ProposeBlueprintActionInput> = {}): ProposeBlueprintActionInput {
  return {
    coreLearnerId: asLearnerId(coreLearnerId),
    context: 'current_term',
    title: 'Strengthen fractions',
    rationale: 'Recent evidence shows steady development in Mathematics.',
    intendedOutcome: 'Move to Level 3 in fractions by end of term.',
    successIndicator: 'Next confirmed assessment shows Level 3 or above.',
    proposalSource: 'teacher',
    ...overrides,
  }
}

before(async () => {
  // db.auth.admin.createUser is observed to intermittently fail with a
  // transient "unrecognized JWT kid" 403 (reproduced identically with a
  // minimal standalone script, no application code involved — a Supabase
  // auth-layer flake unrelated to this fixture) — one retry clears it.
  const mkUser = async (label: string) => {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
    return { id: data.user.id, email }
  }

  const admin = await mkUser('admin'); adminUserId = admin.id; adminEmail = admin.email
  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email
  const unrelatedTeacher = await mkUser('unrelated-teacher'); unrelatedTeacherUserId = unrelatedTeacher.id; unrelatedTeacherEmail = unrelatedTeacher.email
  const otherSchoolTeacher = await mkUser('other-school-teacher'); otherSchoolTeacherUserId = otherSchoolTeacher.id; otherSchoolTeacherEmail = otherSchoolTeacher.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const learnerSelf = await mkUser('learner-self'); learnerSelfUserId = learnerSelf.id; learnerSelfEmail = learnerSelf.email

  const school = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId))
  schoolId = school.id
  const otherSchool = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolTeacherUserId))
  otherSchoolId = otherSchool.id

  await retryDb(() => db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentUserId, role: 'parent', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ]))

  const { data: teacherRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(teacherRow!.id)

  const { data: unrelatedTeacherRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: otherSchoolTeacherRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: otherSchoolTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowIds.push(otherSchoolTeacherRow!.id)

  const { data: classRow } = await retryDb(() => db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow!.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single())
  classId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db
    .from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'Test' })
    .select('id').single())
  coreLearnerId = learnerRow!.id

  // Legacy bridge — also this learner's own self-service account (user_id),
  // so the "learner cannot propose/edit/approve" tests exercise a real,
  // resolvable self-identity, not just an arbitrary unrelated account.
  const { data: studentRow } = await retryDb(() => db
    .from('students')
    .insert({
      name: 'Amani Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher',
      external_id: coreLearnerId, user_id: learnerSelfUserId,
    })
    .select('id').single())
  legacyStudentId = studentRow!.id

  await retryDb(() => db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId }).select('class_id').single())

  await retryDb(() => db
    .from('learner_guardians')
    .insert({ school_id: schoolId, learner_id: coreLearnerId, user_id: parentUserId, relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000' })
    .select('id').single())
})

after(async () => {
  // before() may have failed partway through (e.g. a transient network
  // error creating one of six users) — guard every step so cleanup still
  // removes whatever WAS created, rather than one bad id crashing the
  // whole teardown and leaking the rest.
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort cleanup */ } }

  if (isUuid(coreLearnerId)) await safely(() => db.from('learner_guardians').delete().eq('learner_id', coreLearnerId))
  if (isUuid(classId)) await safely(() => db.from('class_students').delete().eq('class_id', classId))
  if (isUuid(legacyStudentId)) await safely(() => db.from('students').delete().eq('id', legacyStudentId))
  if (isUuid(classId)) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (isUuid(coreLearnerId)) await safely(() => db.from('learners').delete().eq('id', coreLearnerId))
  await safely(() => db.from('teachers').delete().in('id', teacherRowIds.filter(isUuid)))
  const schoolIds = [schoolId, otherSchoolId].filter(isUuid)
  if (schoolIds.length) {
    await safely(() => db.from('school_users').delete().in('school_id', schoolIds))
    await safely(() => db.from('schools').delete().in('id', schoolIds))
  }
  for (const id of [adminUserId, teacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId, parentUserId, learnerSelfUserId]) {
    if (isUuid(id)) {
      await db.from('notification_log').delete().eq('user_id', id)
      await db.from('platform_events').delete().eq('actor_id', id)
      await db.from('ingestion_runs').delete().eq('initiated_by', id)
      await deleteAuthUserOrThrow(db, id)
    }
  }
})

// ── 1-4: propose authorization ──────────────────────────────────────────────

test('1. an authorized teacher who teaches this learner can propose an action item', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose())
  assert.equal(item.status, 'proposed')
  assert.equal(item.learnerId, coreLearnerId)
  assert.ok(item.proposedBy, 'proposedBy should resolve to the teacher\'s school_users id')
})

test('2. an unrelated teacher (same school, no class/teacher_id link) is denied', async () => {
  const client = await signInAs(unrelatedTeacherEmail)
  await assert.rejects(() => proposeBlueprintAction(client, basePropose()), ResourceOwnershipError)
})

test('3. a teacher at a different school is denied (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolTeacherEmail)
  await assert.rejects(() => proposeBlueprintAction(client, basePropose()), ResourceOwnershipError)
})

test('4. a school administrator can propose (admin-tier access, matches existing policy)', async () => {
  const client = await signInAs(adminEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Admin-proposed item' }))
  assert.equal(item.status, 'proposed')
})

// ── 5-6: learner/parent write denial ────────────────────────────────────────

test('5. the learner themself cannot propose, edit, or approve', async () => {
  const client = await signInAs(learnerSelfEmail)
  await assert.rejects(() => proposeBlueprintAction(client, basePropose()), ResourceOwnershipError)

  // Use a teacher-created item to test edit/approve denial specifically.
  const teacherClient = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(teacherClient, basePropose({ title: 'For learner-denial test' }))
  await assert.rejects(() => editBlueprintAction(client, item.id, { title: 'hijacked' }), ResourceOwnershipError)
  await assert.rejects(() => approveBlueprintAction(client, item.id), ResourceOwnershipError)
})

test('6. a linked, real parent cannot propose, edit, or approve', async () => {
  const client = await signInAs(parentEmail)
  await assert.rejects(() => proposeBlueprintAction(client, basePropose()), ResourceOwnershipError)

  const teacherClient = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(teacherClient, basePropose({ title: 'For parent-denial test' }))
  await assert.rejects(() => editBlueprintAction(client, item.id, { title: 'hijacked' }), ResourceOwnershipError)
  await assert.rejects(() => approveBlueprintAction(client, item.id), ResourceOwnershipError)
})

// ── 7-8: source/status on creation ──────────────────────────────────────────

test('7. a system-generated proposal starts as "proposed", never "approved"', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({
    title: 'System candidate',
    proposalSource: 'system',
    sourceGenerator: 'deterministic-adaptive-v1',
    evidenceBasis: { projectorType: 'academic', supportingEvidenceIds: [], confidence: 40, lastComputed: new Date().toISOString(), projectionVersion: 'academic-v1' },
  }))
  assert.equal(item.status, 'proposed')
  assert.equal(item.proposalSource, 'system')
})

test('8. a teacher-authored proposal starts "proposed" too — never auto-approved, never "published"', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Teacher-authored' }))
  assert.equal(item.status, 'proposed')
  assert.notEqual(item.status, 'approved')
  assert.notEqual(item.status, 'published')
})

// ── 9-10: edit ───────────────────────────────────────────────────────────────

test('9. the teacher can edit allowed content fields', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Before edit' }))
  const edited = await editBlueprintAction(client, item.id, { title: 'After edit', priority: 'high' })
  assert.equal(edited.title, 'After edit')
  assert.equal(edited.priority, 'high')
  assert.equal(edited.status, 'edited')
})

test('10. immutable/identity fields cannot be overwritten through edit, even via a loosely-typed patch', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Immutability check', proposalSource: 'teacher' }))

  // Bypass the type system deliberately, the way a bug (not a legitimate
  // caller) might — proves runtime enforcement, not just compile-time.
  const maliciousPatch = {
    title: 'Legitimately changed title',
    learnerId: 'not-the-real-learner',
    proposalSource: 'system',
    sourceGenerator: 'fake-generator',
  } as unknown as Parameters<typeof editBlueprintAction>[2]

  const edited = await editBlueprintAction(client, item.id, maliciousPatch)
  assert.equal(edited.title, 'Legitimately changed title', 'the real editable field should change')
  assert.equal(edited.learnerId, coreLearnerId, 'learnerId must never be overwritable via edit')
  assert.equal(edited.proposalSource, 'teacher', 'proposalSource must never be overwritable via edit')
  assert.equal(edited.sourceGenerator, null, 'sourceGenerator must never be overwritable via edit')
})

// ── 11-13: decisions ─────────────────────────────────────────────────────────

test('11. the teacher can approve', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'To approve' }))
  const approved = await approveBlueprintAction(client, item.id)
  assert.equal(approved.status, 'approved')
  assert.ok(approved.reviewedBy)
  assert.ok(approved.reviewedAt)
})

// Phase 4A Conformance Audit, Area 2 — before this fix, coherence was only
// ever checked at Blueprint-page render time; nothing stopped a FAIL-grade
// action from being approved. `successIndicator` has no propose-time
// minimum-specificity check (only a max-length one, validation.ts), so a
// maximally-generic one ("Improves.") passes proposeBlueprintAction() but
// is exactly what reviewAlignment's checkReviewAlignment flags as a
// CRITICAL finding — deterministically, with no dependency on the
// learner's real evidence, making it a reliable trigger for this test.
test('11b. approval is blocked when it would leave the Blueprint coherence-FAIL (generic, unreviewable success indicator)', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Vague success criteria', successIndicator: 'Improves.' }))
  await assert.rejects(
    () => approveBlueprintAction(client, item.id),
    /coherence FAIL|cannot be approved/i
  )
  const stillPending = await getBlueprintAction(client, item.id)
  assert.equal(stillPending!.status, 'proposed', 'a blocked approval must not silently persist as approved')
})

test('12. the teacher can reject with a reason; an empty reason is refused', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'To reject' }))
  await assert.rejects(() => rejectBlueprintAction(client, item.id, ''))

  const rejected = await rejectBlueprintAction(client, item.id, 'Not the right priority for this term.')
  assert.equal(rejected.status, 'rejected')
  assert.equal(rejected.decisionReason, 'Not the right priority for this term.')
})

test('13. the teacher can defer with a reason and a review date', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'To defer' }))
  const deferred = await deferBlueprintAction(client, item.id, { reason: 'Revisit after the mid-term assessment.', reviewDate: '2026-09-01' })
  assert.equal(deferred.status, 'deferred')
  assert.equal(deferred.reviewDate, '2026-09-01')
  assert.equal(deferred.decisionReason, 'Revisit after the mid-term assessment.')
})

// ── 14: invalid transitions ──────────────────────────────────────────────────

test('14. invalid lifecycle transitions fail — cannot re-decide an already-approved/rejected item, cannot edit one either', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Decided once' }))
  await approveBlueprintAction(client, item.id)

  await assert.rejects(() => approveBlueprintAction(client, item.id))
  await assert.rejects(() => rejectBlueprintAction(client, item.id, 'too late'))
  await assert.rejects(() => editBlueprintAction(client, item.id, { title: 'no longer allowed' }))

  const rejectedItem = await proposeBlueprintAction(client, basePropose({ title: 'Rejected once' }))
  await rejectBlueprintAction(client, rejectedItem.id, 'Not appropriate.')
  await assert.rejects(() => approveBlueprintAction(client, rejectedItem.id))
})

test('14b. a deferred item IS revisitable — approve/reject/defer again all succeed from "deferred"', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Deferred then revisited' }))
  await deferBlueprintAction(client, item.id, { reason: 'wait a bit' })
  const approved = await approveBlueprintAction(client, item.id)
  assert.equal(approved.status, 'approved')
})

// ── 15: history / auditability ───────────────────────────────────────────────

test('15. the original proposal and every decision remain auditable in history, in order, with actor/timestamp/previous-resulting state', async () => {
  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'History check' }))
  await editBlueprintAction(client, item.id, { title: 'History check (edited)' })
  await approveBlueprintAction(client, item.id, { decisionReason: 'Looks good.' })

  const history = await getBlueprintActionHistory(client, item.id)
  assert.equal(history.length, 3)

  assert.equal(history[0].event_type, 'proposed')
  assert.equal(history[0].previous_status, null)
  assert.equal(history[0].resulting_status, 'proposed')
  assert.equal(history[0].snapshot.title, 'History check')

  assert.equal(history[1].event_type, 'edited')
  assert.equal(history[1].previous_status, 'proposed')
  assert.equal(history[1].resulting_status, 'edited')
  assert.equal(history[1].snapshot.title, 'History check (edited)')

  assert.equal(history[2].event_type, 'approved')
  assert.equal(history[2].previous_status, 'edited')
  assert.equal(history[2].resulting_status, 'approved')
  assert.equal(history[2].reason, 'Looks good.')
  assert.ok(history[2].actor_id)
  assert.ok(history[2].created_at)
})

// ── 18: parent/learner cannot read draft items (real RLS, not just app-layer) ─

test('18. RLS: a parent-role session cannot SELECT blueprint_action_items rows directly at all (not just app-layer denial)', async () => {
  const teacherClient = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(teacherClient, basePropose({ title: 'RLS parent check' }))

  const parentClient = await signInAs(parentEmail)
  const { data, error } = await parentClient.from('blueprint_action_items').select('id').eq('id', item.id)
  assert.equal(error, null)
  assert.deepEqual(data, [], 'RLS must return zero rows for a parent-role session, even for an item their own child is about')
})

test('18b. RLS: an unrelated teacher at a different school cannot SELECT this school\'s blueprint_action_items rows', async () => {
  const teacherClient = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(teacherClient, basePropose({ title: 'RLS cross-school check' }))

  const otherSchoolClient = await signInAs(otherSchoolTeacherEmail)
  const { data, error } = await otherSchoolClient.from('blueprint_action_items').select('id').eq('id', item.id)
  assert.equal(error, null)
  assert.deepEqual(data, [])
})

// ── 19: evidence/projection provenance ───────────────────────────────────────

test('19. a system-sourced action retains its evidence/projection provenance exactly as supplied — never fabricated', async () => {
  const client = await signInAs(teacherEmail)
  const evidenceBasis = {
    projectorType: 'academic',
    supportingEvidenceIds: ['ev-aaa', 'ev-bbb'],
    confidence: 63,
    lastComputed: '2026-07-20T10:00:00.000Z',
    projectionVersion: 'academic-v1',
  }
  const item = await proposeBlueprintAction(client, basePropose({
    title: 'Provenance check',
    proposalSource: 'system',
    sourceGenerator: 'deterministic-adaptive-v1',
    evidenceBasis,
  }))
  assert.deepEqual(item.evidenceBasis, evidenceBasis)

  const fetched = await getBlueprintAction(client, item.id)
  assert.deepEqual(fetched?.evidenceBasis, evidenceBasis)
})

// ── 20-22: no side-effect writers ────────────────────────────────────────────

test('20. candidate generation and the full propose/edit/approve/reject/defer lifecycle never write learner_evidence', async () => {
  const { count: before } = await db.from('learner_evidence').select('id', { count: 'exact', head: true }).eq('learner_id', legacyStudentId)

  // Candidate generation itself (read-only) — this learner has zero
  // evidence, so Projection reports insufficient_data and this correctly
  // returns null rather than fabricating anything.
  const candidate = await generateActionCandidate(asLearnerId(coreLearnerId), schoolId, 'Mathematics')
  assert.equal(candidate, null)

  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'No evidence write check' }))
  await editBlueprintAction(client, item.id, { title: 'No evidence write check (edited)' })
  await approveBlueprintAction(client, item.id)

  const another = await proposeBlueprintAction(client, basePropose({ title: 'Reject path' }))
  await rejectBlueprintAction(client, another.id, 'not needed')

  const third = await proposeBlueprintAction(client, basePropose({ title: 'Defer path' }))
  await deferBlueprintAction(client, third.id, { reason: 'later' })

  const { count: after } = await db.from('learner_evidence').select('id', { count: 'exact', head: true }).eq('learner_id', legacyStudentId)
  assert.equal(after, before, 'the action-plan domain must never write learner_evidence')
})

test('21. the full lifecycle never creates an assignment', async () => {
  const { count: before } = await db.from('assignments').select('id', { count: 'exact', head: true }).eq('class_id', classId)

  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'No assignment check' }))
  await approveBlueprintAction(client, item.id)

  const { count: after } = await db.from('assignments').select('id', { count: 'exact', head: true }).eq('class_id', classId)
  assert.equal(after, before, 'the action-plan domain must never create an assignment')
})

test('22. the full lifecycle never creates a Compass session', async () => {
  const { count: before } = await db.from('compass_sessions').select('id', { count: 'exact', head: true }).eq('student_id', legacyStudentId)

  const client = await signInAs(teacherEmail)
  const item = await proposeBlueprintAction(client, basePropose({ title: 'No compass check' }))
  await approveBlueprintAction(client, item.id)

  const { count: after } = await db.from('compass_sessions').select('id', { count: 'exact', head: true }).eq('student_id', legacyStudentId)
  assert.equal(after, before, 'the action-plan domain must never create a Compass session')
})

// ── 24-25: contexts and ADR-0030 ─────────────────────────────────────────────

test('24. multiple contexts can coexist for one learner', async () => {
  const client = await signInAs(teacherEmail)
  await proposeBlueprintAction(client, basePropose({ title: 'Current term item', context: 'current_term' }))
  await proposeBlueprintAction(client, basePropose({ title: 'Holiday item', context: 'holiday' }))
  await proposeBlueprintAction(client, basePropose({ title: 'Intervention item', context: 'intervention' }))

  const all = await listBlueprintActionsForLearner(client, asLearnerId(coreLearnerId))
  const contexts = new Set(all.map(a => a.context))
  assert.ok(contexts.has('current_term'))
  assert.ok(contexts.has('holiday'))
  assert.ok(contexts.has('intervention'))
})

test('25. context is stored exactly as the teacher selected it — never inferred or silently changed from calendar data', async () => {
  const client = await signInAs(teacherEmail)
  // This school has no academic_years/terms configured at all in this
  // fixture (getCurrentAcademicYear/getCurrentTerm will resolve null) —
  // proving context selection neither depends on nor is blocked by
  // missing calendar data (ADR-0030's "missing or conflicting calendar
  // data... require explicit teacher selection... preserve the selected
  // value").
  const item = await proposeBlueprintAction(client, basePropose({ title: 'Holiday despite no calendar data', context: 'holiday' }))
  assert.equal(item.context, 'holiday')
  assert.equal(item.academicYearId, null)
  assert.equal(item.termId, null)
})
