// lib/compass/deliveryBinding.integration.test.ts
//
// Phase 2.6 / G-08 — the teacher-delivered Compass intervention lifecycle,
// against real (synthetic, cleaned-up) rows.
//
// The question being made answerable:
//
//     "Which exact Compass session consumed this teacher intervention?"
//
// Before this, `blueprint_compass_deliveries.status` was permanently
// `available` and `compass_session_id` permanently null, so the nearest
// answer was "any session this learner had in this subject".
//
// The invariant this file exists to defend, above every other assertion:
// COMPLETED IS NOT MASTERED. A delivery reaching `completed` says the
// learner finished the session; it says nothing about whether they learned
// anything, and it must never shortcut the teacher's review of the mastery
// claim.
//
// ⚠️ Creates real (throwaway) auth users, a school, teacher, class, Core
// learner + legacy bridge, deliveries and sessions — deleted in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/deliveryBinding.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { ConflictError } from '@/lib/core/errors'
import { proposeBlueprintAction, approveBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { deliverBlueprintActionToCompass } from '@/lib/learnerBlueprint/actionPlan/delivery/compass'
import { getBlueprintActionReviewSnapshot } from '@/lib/learnerBlueprint/actionPlan/review'
import { getOrCreateSession, endSession } from './session'
import { bindDeliveryToSession, completeDeliveryForSession } from './deliveryBinding'
import { recordCompassSessionEvidence } from './evidence'
import { MASTERY_EXTRACTION_METHOD } from './evidenceClaimTypes'
import { mergeBridgePreservingTeacherIntent } from '@/lib/career/autoReportGenerator'

const SYNTHETIC_MARKER = 'SYNTHETIC_P26_DELIVERY_BINDING_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

let schoolId: string, coreLearnerId: string, legacyStudentId: string, classId: string
let teacherRowId: string, teacherUserId: string, teacherEmail: string
let teacherClient: SupabaseClient
let actionAId: string, actionBId: string
let deliveryAId: string
let boundSessionId: string
const createdActionIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}
async function retryDb<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<{ data: T }> {
  return retryAsync(async () => { const r = await fn(); if (r.error) throw r.error; return r as { data: T } })
}
async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    const { data: { user }, error: ue } = await c.auth.getUser()
    if (ue || !user) throw ue ?? new Error('no user')
  }, 6)
  return c
}

const bridge = async () => {
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  return (ctx?.compass_bridge ?? {}) as Record<string, unknown>
}
const deliveryRow = async (id: string) => (await repos.blueprintCompassDeliveries.findById(id))!

async function makeApprovedAction(title: string, subject = 'mathematics') {
  const proposed = await proposeBlueprintAction(teacherClient, {
    coreLearnerId, context: 'current_term', title,
    rationale: 'Evidence-backed need.', intendedOutcome: 'Improve.',
    successIndicator: 'Next confirmed evidence improves.',
    learnerAction: `Work on ${title}`, proposalSource: 'teacher',
  })
  const approved = await approveBlueprintAction(teacherClient, proposed.id, {})
  createdActionIds.push(approved.id)
  void subject
  return approved.id
}

before(async () => {
  teacherEmail = `${SYNTHETIC_MARKER.toLowerCase()}-teacher-${Date.now()}@example.com`
  const { data: au } = await retryDb(() => db.auth.admin.createUser({ email: teacherEmail, password: PASSWORD, email_confirm: true }))
  teacherUserId = au.user.id

  const school = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherUserId))
  schoolId = school.id
  await retryDb(() => db.from('school_users').insert({ school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true }).select('id').single())

  const { data: tr } = await retryDb(() => db.from('teachers').insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowId = tr!.id

  const { data: cr } = await retryDb(() => db.from('teacher_classes').insert({ teacher_id: teacherRowId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` }).select('id').single())
  classId = cr!.id

  const { data: lr } = await retryDb(() => db.from('learners').insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Mary', last_name: 'Binding' }).select('id').single())
  coreLearnerId = lr!.id

  const { data: sr } = await retryDb(() => db.from('students').insert({
    name: 'Mary Binding', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
    added_by: 'teacher', teacher_id: teacherRowId, external_id: coreLearnerId,
  }).select('id').single())
  legacyStudentId = sr!.id

  await retryDb(() => db.from('class_students').insert({ class_id: classId, student_id: legacyStudentId }).select('class_id').single())
  teacherClient = await signIn(teacherEmail)
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (isUuid(legacyStudentId)) {
    const { data } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
    const ids = (data ?? []).map(r => r.id)
    if (ids.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', ids))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids))
      await safely(() => db.from('learner_evidence').delete().in('id', ids))
    }
    await safely(() => db.from('blueprint_compass_deliveries').update({ compass_session_id: null }).eq('learner_id', coreLearnerId))
    await safely(() => db.from('compass_messages').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', legacyStudentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', legacyStudentId))
  }
  if (isUuid(coreLearnerId)) await safely(() => db.from('blueprint_compass_deliveries').delete().eq('learner_id', coreLearnerId))
  for (const id of createdActionIds) await safely(() => db.from('blueprint_action_item_history').delete().eq('action_item_id', id))
  if (isUuid(coreLearnerId)) await safely(() => db.from('blueprint_action_items').delete().eq('learner_id', coreLearnerId))
  if (isUuid(classId)) await safely(() => db.from('class_students').delete().eq('class_id', classId))
  if (isUuid(legacyStudentId)) await safely(() => db.from('students').delete().eq('id', legacyStudentId))
  if (isUuid(classId)) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (isUuid(coreLearnerId)) await safely(() => db.from('learners').delete().eq('id', coreLearnerId))
  if (isUuid(teacherRowId)) await safely(() => db.from('teachers').delete().eq('id', teacherRowId))
  if (isUuid(schoolId)) {
    await safely(() => db.from('school_users').delete().eq('school_id', schoolId))
    await safely(() => db.from('schools').delete().eq('id', schoolId))
  }
  if (isUuid(teacherUserId)) await safely(() => db.auth.admin.deleteUser(teacherUserId))
})

// ── 1-2. Delivery starts available; the bridge names it ────────────────────

test('1+2. an approved delivery starts as `available` and the bridge carries its exact id', async () => {
  actionAId = await makeApprovedAction('Proportional reasoning intervention')
  const { delivery } = await deliverBlueprintActionToCompass(teacherClient, actionAId, {
    confirmCompassDelivery: true, subject: 'mathematics',
  })
  deliveryAId = delivery.id

  assert.equal(delivery.status, 'available')
  assert.equal(delivery.compass_session_id, null)

  const b = await bridge()
  assert.equal(b.deliveryId, deliveryAId, 'the durable reference is on the bridge')
  assert.equal(b.teacherSuggested, true)
  assert.equal(b.firstSubject, 'mathematics')
})

// ── CB. Legacy career-report generation must not destroy the intervention ──
//
// Deliberately placed HERE, in the at-risk window: the delivery is still
// `available` and `teacherSuggested` is still true. Every test below this
// point therefore runs against a bridge that a legacy class-report
// generation has already written over — so binding, completion, provenance
// and the review snapshot are all proven to survive it, not just the merge.
//
// Before the fix this single call orphaned the delivery permanently:
// deliveryBinding binds only to the delivery the bridge names, by design,
// so once `deliveryId` was erased nothing could ever claim or complete it.

test('CB. a legacy career report written over the bridge does not destroy the queued intervention', async () => {
  const before = await bridge()
  assert.equal(before.deliveryId, deliveryAId, 'precondition: the intervention is queued')
  assert.equal(before.teacherSuggested, true)

  // The REAL production write path from lib/career/autoReportGenerator.ts —
  // read current bridge, merge, single update — with the DeepSeek call
  // replaced by a fixed generated object. Nothing else about it is simulated.
  const generated = {
    sessionGoal: 'Close the gap in essay structure — blocking the humanities pathway',
    firstSubject: 'english',
    firstConcept: 'essay_writing',
    startDifficulty: 2,
    subjectPriorities: [{ subject: 'english', gap: 2 }],
    weeklyMilestones: [{ week: 1, goal: 'Draft one essay', subject: 'english', checkConcept: 'essay_writing' }],
    parentWhatsAppMessage: 'Ask about essay practice this week.',
  }

  const { data: contextRow } = await db
    .from('student_learning_context')
    .select('compass_bridge')
    .eq('student_id', legacyStudentId)
    .maybeSingle()

  const merged = mergeBridgePreservingTeacherIntent(
    (contextRow?.compass_bridge as Record<string, unknown> | null) ?? {},
    generated,
  )

  await db
    .from('student_learning_context')
    .update({
      compass_bridge: merged,
      first_subject: (merged.firstSubject as string | null) ?? generated.firstSubject,
      session_goal: generated.sessionGoal,
      guided_topics: generated.weeklyMilestones.map(m => m.checkConcept),
    })
    .eq('student_id', legacyStudentId)

  const after = await bridge()
  assert.equal(after.deliveryId, deliveryAId, 'the delivery reference survived — the row is not orphaned')
  assert.equal(after.teacherSuggested, true, 'teacher authority survived')
  assert.equal(after.subStrandId, before.subStrandId, 'the curriculum anchor survived')
  assert.equal(after.firstSubject, 'mathematics', 'and the report did not retarget the intervention')

  // Report-owned context did land.
  assert.match(String(after.sessionGoal), /essay structure/)

  // The delivery itself is untouched and still claimable.
  const row = await deliveryRow(deliveryAId)
  assert.equal(row.status, 'available')
  assert.equal(row.compass_session_id, null)
})

// ── 19/22. Second active objective cannot silently overwrite the first ─────

test('19. a SECOND active teacher objective is REJECTED, never silently overwritten', async () => {
  actionBId = await makeApprovedAction('A different intervention')

  await assert.rejects(
    () => deliverBlueprintActionToCompass(teacherClient, actionBId, { confirmCompassDelivery: true, subject: 'english' }),
    ConflictError,
    'policy: REJECTED_SECOND_ACTIVE — silent overwrite is not acceptable',
  )

  // A survives untouched, and the bridge still points at it.
  const a = await deliveryRow(deliveryAId)
  assert.equal(a.status, 'available')
  const b = await bridge()
  assert.equal(b.deliveryId, deliveryAId, 'the first objective was not replaced')
  assert.equal(b.firstSubject, 'mathematics')
})

// ── 6/7/10/11. Nothing may claim it except the right session ───────────────

test('6. a wrong-subject session cannot claim the delivery', async () => {
  const kiswahili = await getOrCreateSession(legacyStudentId, 'kiswahili', 'school')
  const outcome = await bindDeliveryToSession(legacyStudentId, kiswahili.sessionId, 'kiswahili', await bridge())

  assert.equal(outcome.bound, false)
  assert.equal(outcome.bound === false && outcome.reason, 'subject_mismatch')
  assert.equal((await deliveryRow(deliveryAId)).status, 'available', 'a Maths intervention is untouched by a Kiswahili session')

  await endSession(kiswahili.sessionId, legacyStudentId, 'completed', 60, 'kiswahili')
})

test('7. an open, learner-directed session cannot claim the delivery — no heuristic binding', async () => {
  // Same subject as the delivery, but NO teacher direction in play.
  const outcome = await bindDeliveryToSession(legacyStudentId, 'ignored', 'mathematics', { teacherSuggested: false })
  assert.equal(outcome.bound, false)
  assert.equal(outcome.bound === false && outcome.reason, 'no_teacher_direction')
  assert.equal((await deliveryRow(deliveryAId)).status, 'available')
})

test('7b. a session whose bridge names no delivery cannot claim one by proximity', async () => {
  const outcome = await bindDeliveryToSession(legacyStudentId, 'ignored', 'mathematics', { teacherSuggested: true, firstSubject: 'mathematics' })
  assert.equal(outcome.bound === false && outcome.reason, 'no_delivery_id',
    'the newest available delivery must not be adopted by a session that was never sent to it')
})

test('8. a different learner cannot claim this learner\'s delivery', async () => {
  // A real, well-formed session id belonging to nobody in this fixture — the
  // point under test is the LEARNER check, so the id must be valid enough to
  // reach it.
  const outcome = await bindDeliveryToSession(
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'mathematics',
    await bridge(),
  )
  assert.equal(outcome.bound === false && outcome.reason, 'learner_mismatch')
  assert.equal((await deliveryRow(deliveryAId)).status, 'available')
})

// ── 3-5. The right session claims it ───────────────────────────────────────

test('3+4+5. the matching targeted session claims the delivery and is permanently recorded', async () => {
  const session = await getOrCreateSession(legacyStudentId, 'mathematics', 'school')
  boundSessionId = session.sessionId

  const outcome = await bindDeliveryToSession(legacyStudentId, boundSessionId, 'mathematics', await bridge())
  assert.equal(outcome.bound, true)

  const row = await deliveryRow(deliveryAId)
  assert.equal(row.status, 'started')
  assert.equal(row.compass_session_id, boundSessionId, 'the EXACT session, not "a session in this subject"')
})

// ── 9/10. Idempotency ──────────────────────────────────────────────────────

test('9+10. repeated first-message and resume converge on one binding, never re-binding', async () => {
  for (let i = 0; i < 3; i++) {
    const again = await bindDeliveryToSession(legacyStudentId, boundSessionId, 'mathematics', await bridge())
    assert.equal(again.bound, true, 'repeat calls stay bound rather than erroring')
  }

  const resumed = await getOrCreateSession(legacyStudentId, 'mathematics', 'school')
  assert.equal(resumed.sessionId, boundSessionId, 'the session resumed rather than being recreated')

  const row = await deliveryRow(deliveryAId)
  assert.equal(row.status, 'started', 'resume does not reset status')
  assert.equal(row.compass_session_id, boundSessionId, 'nor rebind provenance')

  const { count } = await db.from('blueprint_compass_deliveries')
    .select('*', { count: 'exact', head: true }).eq('compass_session_id', boundSessionId)
  assert.equal(count, 1, 'exactly one delivery is bound to this session')
})

test('10b. a genuinely different session cannot steal a delivery that is already started', async () => {
  // `getOrCreateSession` would RESUME the bound session (same learner, same
  // subject, inside the window), which is the resume path test 9+10 already
  // covers. A distinct row is created directly so this exercises the
  // "already claimed" branch rather than the resume branch.
  const other = await repos.compass.createSession({
    learner_id: legacyStudentId, subject: 'mathematics', mode: 'holiday',
    status: 'active', exchange_count: 0, session_state: {},
  })
  assert.notEqual(other.id, boundSessionId, 'this really is a second, distinct session')

  const outcome = await bindDeliveryToSession(legacyStudentId, other.id, 'mathematics', await bridge())
  assert.equal(outcome.bound === false && outcome.reason, 'not_available')
  assert.equal((await deliveryRow(deliveryAId)).compass_session_id, boundSessionId, 'the original binding stands')

  await endSession(other.id, legacyStudentId, 'abandoned', 10, 'mathematics')
})

// ── 11. Bridge clearing does not destroy provenance ────────────────────────

test('11. clearing the ephemeral bridge does NOT make the intervention untraceable', async () => {
  // Exactly what /api/learn does after the first message.
  await repos.compass.mergeTeacherSuggestedTopic(legacyStudentId, { teacherSuggested: false })

  const b = await bridge()
  assert.equal(b.teacherSuggested, false, 'the handoff slot is spent')

  const row = await deliveryRow(deliveryAId)
  assert.equal(row.status, 'started', 'the durable ledger is unaffected')
  assert.equal(row.compass_session_id, boundSessionId,
    'teacher action -> delivery -> session provenance survives the bridge being cleared')

  const reverse = await repos.blueprintCompassDeliveries.findByCompassSessionId(boundSessionId)
  assert.equal(reverse!.blueprint_action_item_id, actionAId,
    'and resolves all the way back to the teacher action that caused it')
})

// ── 12-15. Completion, and what it does NOT mean ───────────────────────────

test('13. a session that does not own the delivery cannot complete it', async () => {
  const stranger = await getOrCreateSession(legacyStudentId, 'english', 'school')
  const result = await completeDeliveryForSession(stranger.sessionId)
  assert.equal(result, null, 'completion is matched on the bound session id, never on learner+subject+recency')
  assert.equal((await deliveryRow(deliveryAId)).status, 'started')
  await endSession(stranger.sessionId, legacyStudentId, 'completed', 30, 'english')
})

test('12+14. ending the bound session completes the delivery, and a repeat end is a safe no-op', async () => {
  await endSession(boundSessionId, legacyStudentId, 'completed', 600, 'mathematics')
  const completed = await completeDeliveryForSession(boundSessionId)
  assert.ok(completed)
  assert.equal(completed!.status, 'completed')

  const repeat = await completeDeliveryForSession(boundSessionId)
  assert.equal(repeat, null, 'a repeated end neither errors nor transitions twice')
  assert.equal((await deliveryRow(deliveryAId)).status, 'completed')
})

test('15+16. COMPLETED IS NOT MASTERED — the mastery claim is still pending teacher review', async () => {
  await recordCompassSessionEvidence({
    studentId: legacyStudentId, initiatedBy: teacherUserId, sessionId: boundSessionId,
    subject: 'mathematics', sessionAbandoned: false, exchangeCount: 8, durationSeconds: 600,
    genuineProgress: true, masteredConcepts: ['proportional reasoning'],
    endingLevel: 3, academicYear: 2026, term: 1,
  })

  const delivery = await deliveryRow(deliveryAId)
  assert.equal(delivery.status, 'completed', 'the intervention was completed...')

  const { data: rows } = await db.from('learner_evidence')
    .select('lifecycle_state, extraction_method')
    .eq('learner_id', legacyStudentId).eq('evidence_source', 'compass_session')
  const mastery = (rows ?? []).find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)

  assert.ok(mastery, 'a mastery claim was emitted')
  assert.equal(mastery!.lifecycle_state, 'pending_review',
    '...and "she finished the session" did NOT decide "she mastered the skill". ' +
    'A completed delivery must never shortcut the Evidence Domain.')
})

// ── 17/19. Review workspace answers the precise question ───────────────────

test('17+R. the review snapshot now answers "did she do the intervention I sent?"', async () => {
  const snapshot = await getBlueprintActionReviewSnapshot(teacherClient, actionAId)
  assert.equal(snapshot.compass.delivered, true)

  if (snapshot.compass.delivered) {
    assert.equal(snapshot.compass.deliveryStatus, 'completed', 'the intervention\'s own lifecycle')
    assert.equal(snapshot.compass.boundSessionId, boundSessionId, 'bound to the exact session that consumed it')
    // The subject-wide summary is retained as context, not as the answer.
    assert.ok(snapshot.compass.sessionCount >= 1)
  }

  // And the teacher's verdict is still a separate, explicit act.
  assert.equal(snapshot.latestDecision, 'awaiting_review',
    'a completed delivery does not record a review decision — the teacher still concludes')
})

// ── 20. Existing delivery idempotency intact ───────────────────────────────

test('20. re-delivering the same action item is still idempotent', async () => {
  const { delivery, alreadyDelivered } = await deliverBlueprintActionToCompass(teacherClient, actionAId, {
    confirmCompassDelivery: true, subject: 'mathematics',
  })
  assert.equal(alreadyDelivered, true)
  assert.equal(delivery.id, deliveryAId)
  assert.equal(delivery.status, 'completed', 'and returns the real current state, not a reset one')
})
