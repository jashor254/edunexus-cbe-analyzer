// lib/learnerBlueprint/actionPlan/delivery/compass.integration.test.ts
//
// Phase 2C (docs/architecture/blueprint-compass-delivery-phase2c.md) —
// integration tests against real (synthetic, cleaned-up) rows and real
// authenticated sessions for `deliverBlueprintActionToCompass`. Called
// directly (not over HTTP) — like assignment.integration.test.ts (Phase 2B),
// this only needs a session-bound SupabaseClient, not a running Next.js
// server. The route itself gets its own small HTTP-level test — see
// compass.http.integration.test.ts.
//
// Run with: npx tsx --env-file=.env.local --test lib/learnerBlueprint/actionPlan/delivery/compass.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { UnauthorizedError, ResourceOwnershipError, NotFoundError, ValidationError, ConflictError, IdentityResolutionError } from '@/lib/core/errors'
import { deliverBlueprintActionToCompass, type DeliverBlueprintActionToCompassCommand } from './compass'
import { getNextSubject } from '@/lib/compass/session'
import { EVIDENCE_BASIS_EMPTY } from '../types'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'

const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_COMPASS_PHASE2C_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 400 * attempt))
  }
  throw lastError
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
  })
  return client
}

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

let schoolId: string, otherSchoolId: string
let coreLearnerId: string, legacyStudentId: string
let unbridgedLearnerId: string // Core learner with no legacy students bridge
let classId: string

let adminUserId: string, adminEmail: string
let teacherUserId: string, teacherEmail: string
let unrelatedTeacherUserId: string, unrelatedTeacherEmail: string
let otherSchoolTeacherUserId: string, otherSchoolTeacherEmail: string
let parentUserId: string, parentEmail: string
let learnerSelfUserId: string, learnerSelfEmail: string
let secondLearnerUserId: string, secondLearnerEmail: string
let secondLegacyStudentId: string

const teacherRowIds: string[] = []
const createdDeliveryActionIds: string[] = []

function baseActionFields(overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}) {
  return {
    learner_id: coreLearnerId,
    school_id: schoolId,
    academic_year_id: null,
    term_id: null,
    blueprint_snapshot_id: null,
    context: 'current_term' as const,
    priority: 'medium' as const,
    visibility: 'teacher_only' as const,
    title: 'Build fluency in fractions',
    rationale: 'Recent evidence shows steady development in Mathematics.',
    intended_outcome: 'Reach confident fluency adding and subtracting fractions.',
    learner_action: 'Practice fraction addition with Compass for 15 minutes.',
    teacher_action: null,
    parent_support: 'Ask your child to show you one fractions problem they solved.',
    school_support: null,
    success_indicator: 'Solves 4/5 fraction addition problems correctly in a Compass check.',
    target_capability: 'Grade 7 Mathematics — Fractions',
    sub_strand_id: null,
    review_date: '2026-08-15',
    teacher_notes: 'CONFIDENTIAL: flagged for additional monitoring this term.',
    proposal_source: 'teacher' as const,
    source_generator: null,
    evidence_basis: { ...EVIDENCE_BASIS_EMPTY, confidence: 77, projectorType: 'knowledgeProjector' },
    proposed_by: null,
    ...overrides,
  }
}

async function insertActionWithStatus(status: 'proposed' | 'edited' | 'approved' | 'rejected' | 'deferred', overrides: Partial<Parameters<typeof repos.blueprintActionItems.insert>[0]> = {}): Promise<BlueprintActionItemRow> {
  const row = await repos.blueprintActionItems.insert(baseActionFields(overrides))
  await repos.blueprintActionItemHistory.record({
    action_item_id: row.id, event_type: 'proposed', previous_status: null, resulting_status: row.status, snapshot: row, actor_id: null, reason: null,
  })
  if (status === 'proposed') return row

  if (status === 'edited') {
    const edited = await repos.blueprintActionItems.updateContent(row.id, { status: 'edited' })
    await repos.blueprintActionItemHistory.record({
      action_item_id: row.id, event_type: 'edited', previous_status: 'proposed', resulting_status: 'edited', snapshot: edited, actor_id: null, reason: null,
    })
    return edited
  }

  const decided = await repos.blueprintActionItems.recordDecision(row.id, {
    status,
    reviewed_by: null,
    reviewed_at: new Date().toISOString(),
    decision_reason: status === 'rejected' ? 'Not appropriate at this time.' : status === 'deferred' ? 'Revisit next term.' : null,
    review_date: null,
  })
  await repos.blueprintActionItemHistory.record({
    action_item_id: row.id, event_type: status, previous_status: 'proposed', resulting_status: status, snapshot: decided, actor_id: null, reason: null,
  })
  return decided
}

const validCommand = (overrides: Partial<DeliverBlueprintActionToCompassCommand> = {}): DeliverBlueprintActionToCompassCommand => ({
  confirmCompassDelivery: true,
  subject: 'mathematics',
  ...overrides,
})

before(async () => {
  const mkUser = async (label: string) => {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data } = await retryAsync(async () => {
      const res = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
      if (res.error) throw res.error
      return res
    })
    return { id: data.user.id, email }
  }

  const admin = await mkUser('admin'); adminUserId = admin.id; adminEmail = admin.email
  const teacher = await mkUser('teacher'); teacherUserId = teacher.id; teacherEmail = teacher.email
  const unrelatedTeacher = await mkUser('unrelated-teacher'); unrelatedTeacherUserId = unrelatedTeacher.id; unrelatedTeacherEmail = unrelatedTeacher.email
  const otherSchoolTeacher = await mkUser('other-school-teacher'); otherSchoolTeacherUserId = otherSchoolTeacher.id; otherSchoolTeacherEmail = otherSchoolTeacher.email
  const parent = await mkUser('parent'); parentUserId = parent.id; parentEmail = parent.email
  const learnerSelf = await mkUser('learner-self'); learnerSelfUserId = learnerSelf.id; learnerSelfEmail = learnerSelf.email
  const secondLearner = await mkUser('second-learner'); secondLearnerUserId = secondLearner.id; secondLearnerEmail = secondLearner.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolTeacherUserId)
  otherSchoolId = otherSchool.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: unrelatedTeacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: parentUserId, role: 'parent', is_active: true },
    { school_id: otherSchoolId, user_id: otherSchoolTeacherUserId, role: 'teacher', is_active: true },
  ])

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(teacherRow!.id)

  const { data: unrelatedTeacherRow } = await db.from('teachers')
    .insert({ user_id: unrelatedTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(unrelatedTeacherRow!.id)

  const { data: otherSchoolTeacherRow } = await db.from('teachers')
    .insert({ user_id: otherSchoolTeacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
  teacherRowIds.push(otherSchoolTeacherRow!.id)

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherRow!.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single()
  classId = classRow!.id

  const { data: learnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Amani', last_name: 'Test' })
    .select('id').single()
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await db.from('students')
    .insert({ name: 'Amani Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: coreLearnerId, user_id: learnerSelfUserId })
    .select('id').single()
  legacyStudentId = studentRow!.id
  await db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId })

  // A second, unrelated real learner (with its own bridge) — used to prove
  // cross-learner isolation via the existing, unmodified getNextSubject().
  const { data: secondLearnerRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-002`, first_name: 'Zawadi', last_name: 'Test' })
    .select('id').single()
  const { data: secondStudentRow } = await db.from('students')
    .insert({ name: 'Zawadi Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', external_id: secondLearnerRow!.id, user_id: secondLearnerUserId })
    .select('id').single()
  secondLegacyStudentId = secondStudentRow!.id
  await db.from('class_students').insert({ class_id: classId, student_id: secondLegacyStudentId })

  // A Core learner with NO legacy bridge — proves the "Compass unavailable
  // for learner" precondition.
  const { data: unbridgedRow } = await db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-003`, first_name: 'NoBridge', last_name: 'Test' })
    .select('id').single()
  unbridgedLearnerId = unbridgedRow!.id
})

after(async () => {
  if (createdDeliveryActionIds.length) await db.from('blueprint_compass_deliveries').delete().in('blueprint_action_item_id', createdDeliveryActionIds)
  await db.from('student_learning_context').delete().in('student_id', [legacyStudentId, secondLegacyStudentId])
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().in('id', [legacyStudentId, secondLegacyStudentId])
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('learners').delete().in('id', [coreLearnerId, unbridgedLearnerId])
  await db.from('learners').delete().eq('admission_number', `${SYNTHETIC_MARKER}-002`)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('school_users').delete().in('school_id', [schoolId, otherSchoolId])
  await db.from('schools').delete().in('id', [schoolId, otherSchoolId])
  for (const id of [adminUserId, teacherUserId, unrelatedTeacherUserId, otherSchoolTeacherUserId, parentUserId, learnerSelfUserId, secondLearnerUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

// ── Lifecycle status gates ──────────────────────────────────────────────────

test('a proposed action cannot be delivered to Compass', async () => {
  const action = await insertActionWithStatus('proposed')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ConflictError)
})

test('an edited-but-unapproved action cannot be delivered to Compass', async () => {
  const action = await insertActionWithStatus('edited')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ConflictError)
})

test('a rejected action cannot be delivered to Compass', async () => {
  const action = await insertActionWithStatus('rejected')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ConflictError)
})

test('a deferred action cannot be delivered to Compass', async () => {
  const action = await insertActionWithStatus('deferred')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ConflictError)
})

test('a non-existent action item id is a NotFoundError, not a generic 500', async () => {
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, '00000000-0000-0000-0000-000000000000', validCommand()), NotFoundError)
})

// ── Authorization (pure denial — must fail before any state changes) ───────

test('authorization: unauthenticated caller cannot deliver to Compass', async () => {
  const action = await insertActionWithStatus('approved')
  await assert.rejects(() => deliverBlueprintActionToCompass(anonClient(), action.id, validCommand()), UnauthorizedError)
})

test('authorization: parent cannot create a Compass delivery', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(parentEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: the learner themself cannot create a Compass delivery', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(learnerSelfEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: an unrelated same-school teacher is denied', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(unrelatedTeacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ResourceOwnershipError)
})

test('authorization: a cross-school teacher is denied', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(otherSchoolTeacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), ResourceOwnershipError)
})

// ── Validation (also pure denial, no state change) ──────────────────────────

test('validation: missing Compass-delivery confirmation is rejected', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand({ confirmCompassDelivery: false })), ValidationError)
})

test('validation: a missing subject is rejected', async () => {
  const action = await insertActionWithStatus('approved')
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand({ subject: '' })), ValidationError)
})

test('precondition: a learner with no legacy Compass identity bridge is IdentityResolutionError ("Compass unavailable")', async () => {
  const action = await insertActionWithStatus('approved', { learner_id: unbridgedLearnerId })
  const client = await signInAs(adminEmail) // admin-tier passes canManageLearnerRecordCore's fallback branch even with no bridge
  await assert.rejects(() => deliverBlueprintActionToCompass(client, action.id, validCommand()), IdentityResolutionError)
})

// ── Happy path, provenance, content mapping, idempotency, guardrails ───────

test('an authorized teacher delivers an approved action to Compass as a queued objective', async () => {
  const action = await insertActionWithStatus('approved')
  createdDeliveryActionIds.push(action.id)
  const client = await signInAs(teacherEmail)

  const { delivery, alreadyDelivered } = await deliverBlueprintActionToCompass(client, action.id, validCommand())

  assert.equal(alreadyDelivered, false)
  assert.equal(delivery.learner_id, coreLearnerId)
  assert.equal(delivery.school_id, schoolId)
  assert.equal(delivery.blueprint_action_item_id, action.id)
  assert.equal(delivery.status, 'available')
  assert.equal(delivery.subject, 'mathematics')
  assert.equal(delivery.compass_session_id, null, 'Option A creates no session at delivery time')

  // Deterministic content mapping — present, and none of the private fields leaked.
  assert.ok(delivery.objective.includes(action.learner_action!))
  assert.ok(delivery.learner_instructions.includes(action.success_indicator))
  assert.ok(!delivery.learner_instructions.includes(action.teacher_notes!), 'teacher-private notes must never appear in Compass-bound content')
  assert.ok(!delivery.learner_instructions.includes(action.parent_support!), 'parent-support text must never leak into learner instructions')
  assert.ok(!JSON.stringify(delivery).includes('CONFIDENTIAL'))
  const deliveryKeys = Object.keys(delivery)
  assert.ok(!deliveryKeys.includes('evidence_basis') && !deliveryKeys.includes('evidenceBasis'), 'the delivery row must never carry the raw evidence basis (confidence/freshness) at all')

  // The canonical Compass objective-setter actually ran — compass_bridge reflects it.
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  assert.equal(ctx?.compass_bridge.teacherSuggested, true)
  assert.equal(ctx?.compass_bridge.firstSubject, 'mathematics')
  assert.equal(ctx?.compass_bridge.firstConcept, delivery.objective)

  // The learner's own next Compass pick reflects the delivered objective — proven via the real, unmodified getNextSubject().
  const next = await getNextSubject(legacyStudentId)
  assert.equal(next.reason, 'teacher_recommendation')
  assert.equal(next.subject, 'mathematics')

  // Action history: a 'delivered_to_compass' event was appended, status remains 'approved', original history untouched.
  const history = await repos.blueprintActionItemHistory.listForActionItem(action.id)
  const deliveredEvents = history.filter(h => h.event_type === 'delivered_to_compass')
  assert.equal(deliveredEvents.length, 1)
  assert.equal(deliveredEvents[0].resulting_status, 'approved')
  assert.ok(deliveredEvents[0].reason?.includes(delivery.id))
  const approvedEvent = history.find(h => h.event_type === 'approved')
  assert.ok(approvedEvent, 'the original approval history event must remain untouched')

  const stillAction = await repos.blueprintActionItems.findById(action.id)
  assert.equal(stillAction?.status, 'approved', 'Compass delivery must not change the action item\'s own status')

  // ── No Compass session, no evidence, at delivery time. ──────────────────
  const [{ data: compassSessions }, { data: evidenceRows }] = await Promise.all([
    db.from('compass_sessions').select('id').eq('learner_id', legacyStudentId).gte('created_at', delivery.created_at),
    db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId).gte('created_at', delivery.created_at),
  ])
  assert.equal(compassSessions?.length ?? 0, 0, 'no session may be created merely because delivery occurred')
  assert.equal(evidenceRows?.length ?? 0, 0, 'no evidence may be written merely because delivery occurred')

  // No assignment created by this delivery.
  const { data: assignmentsForAction } = await db.from('assignments').select('id').eq('blueprint_action_item_id', action.id)
  assert.equal(assignmentsForAction?.length ?? 0, 0)

  // ── Idempotency: a second delivery attempt returns the same delivery, no duplicate. ──
  const second = await deliverBlueprintActionToCompass(client, action.id, validCommand({ subject: 'english' }))
  assert.equal(second.alreadyDelivered, true)
  assert.equal(second.delivery.id, delivery.id)
  assert.equal(second.delivery.subject, 'mathematics', 'the second call\'s different subject must never overwrite the first delivery')

  const { data: allForAction } = await db.from('blueprint_compass_deliveries').select('id').eq('blueprint_action_item_id', action.id)
  assert.equal(allForAction?.length, 1, 'exactly one delivery must exist for this action item after two delivery calls')
})

/**
 * Marks any still-unconsumed delivery for the fixture learner as consumed.
 *
 * Phase 2.6 introduced a deliberate policy: a learner may have at most ONE
 * unstarted teacher intervention waiting, because `compass_bridge` is a
 * single per-learner slot and a second delivery would otherwise silently
 * overwrite the first (REJECTED_SECOND_ACTIVE). Tests below that deliver an
 * ADDITIONAL action for the same learner are not testing that policy — they
 * are testing cross-learner isolation and same-action concurrency — so they
 * clear the previous intervention first, exactly as a learner consuming it
 * would. Without this they would trip the new rule and stop exercising what
 * they were written for.
 */
async function consumePriorDeliveries(): Promise<void> {
  await db.from('blueprint_compass_deliveries')
    .update({ status: 'completed' })
    .eq('learner_id', coreLearnerId)
    .eq('status', 'available')
}

test('another learner cannot see or start a delivery meant for a different learner', async () => {
  await consumePriorDeliveries()
  const action = await insertActionWithStatus('approved')
  createdDeliveryActionIds.push(action.id)
  const client = await signInAs(teacherEmail)
  await deliverBlueprintActionToCompass(client, action.id, validCommand({ subject: 'english' }))

  // The unrelated (second) learner's own next-subject pick is completely unaffected.
  const secondLearnerNext = await getNextSubject(secondLegacyStudentId)
  assert.notEqual(secondLearnerNext.reason, 'teacher_recommendation')
})

test('concurrent delivery attempts for the same action create at most one active delivery', async () => {
  await consumePriorDeliveries()
  const action = await insertActionWithStatus('approved')
  createdDeliveryActionIds.push(action.id)
  const client = await signInAs(teacherEmail)

  const [a, b] = await Promise.all([
    deliverBlueprintActionToCompass(client, action.id, validCommand()),
    deliverBlueprintActionToCompass(client, action.id, validCommand()),
  ])

  assert.equal(a.delivery.id, b.delivery.id, 'both concurrent calls must resolve to the same delivery id')

  const { data: allForAction } = await db.from('blueprint_compass_deliveries').select('id').eq('blueprint_action_item_id', action.id)
  assert.equal(allForAction?.length, 1)
})

// ── Static ownership ─────────────────────────────────────────────────────────

test('static: no direct insert into compass_sessions or blueprint_compass_deliveries exists in the delivery adapter or route outside the canonical repository', async () => {
  const fs = await import('node:fs/promises')
  const adapterSource = await fs.readFile('lib/learnerBlueprint/actionPlan/delivery/compass.ts', 'utf8')
  const routeSource = await fs.readFile('app/api/teacher/blueprint/actions/[actionItemId]/deliver-compass/route.ts', 'utf8')
  for (const source of [adapterSource, routeSource]) {
    assert.ok(!source.includes(".from('compass_sessions')"), 'no direct compass_sessions write outside the canonical repository')
    assert.ok(!source.includes(".from('blueprint_compass_deliveries')"), 'no direct table access outside the repository')
    // Checks actual invocation/import syntax, not prose — the adapter's own
    // module comment legitimately says "never invokes DeepSeek" to document
    // this exact guarantee, which a blind substring check would misfire on.
    assert.ok(!source.includes("from '@/lib/ai/deepseek'"), 'no DeepSeek import in the delivery path')
    assert.ok(!source.includes('streamDeepSeek('), 'no DeepSeek invocation in the delivery path')
  }
})

test('static: the ordinary teacher-facing compass-topic route calls the same canonical setTeacherSuggestedTopic function', async () => {
  const fs = await import('node:fs/promises')
  const routeSource = await fs.readFile('app/api/teacher/students/[studentId]/compass-topic/route.ts', 'utf8')
  assert.ok(routeSource.includes('setTeacherSuggestedTopic'))
  assert.ok(!routeSource.includes(".from('student_learning_context')"), 'the route no longer writes the table directly — it goes through the canonical setter')
})
