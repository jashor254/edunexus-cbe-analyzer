// lib/testing/maryFullCircuit.integration.test.ts
//
// Phase 1 — the full-circuit acceptance test. One synthetic learner (Mary,
// Grade 8, Mathematics) driven through every hop of the intended learner-
// intelligence loop, against real rows and a real authenticated teacher:
//
//   confirmed evidence
//     -> Projection identifies the weakness
//       -> Teacher Attention contains Mary
//         -> the attention link reaches Mary's canonical Blueprint
//           -> teacher generates and approves an action
//             -> the action is delivered to Compass
//               -> Compass context uses canonical Projection
//                 -> the teacher's objective reaches the real prompt
//                   -> a Compass session emits Evidence
//                     -> the mastery claim stays pending_review
//                       -> the teacher confirms it
//                         -> Projection changes
//                           -> Blueprint reflects the change
//
// Before Phase 1 this circuit was broken in two places: the attention link
// pointed at a route that does not exist, and Compass read its academic
// level from `student_learning_context` rather than from the learner's own
// evidence. Both hops are asserted here rather than assumed.
//
// ⚠️ PHASE 2 TRIPWIRES. The last section asserts what this circuit still
// CANNOT do. Those assertions are deliberately written to FAIL the day
// curriculum anchoring (G-04/G-06) lands, so that the limitation is
// reviewed and removed on purpose rather than silently outgrown. They are
// not bugs and must not be "fixed" by relaxing them.
//
// ⚠️ Creates real (throwaway) auth users, a school, a teacher, a class, a
// Core learner and its legacy bridge, evidence and a Compass session — all
// deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/testing/maryFullCircuit.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch, confirmReview } from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { classifyGroup, decideAdaptive } from '@/lib/adaptiveLearning/recommend'
import { generateAdaptiveVariants, resolveTiersForClass, type RoutedCompletionFn } from '@/lib/assignments/variantGeneration'
import { approveVariant, findVariantById, findVariantsForQuestion } from '@/lib/assignments/variants'
import { buildAdaptiveProvenance } from '@/lib/assignments/adaptiveProvenance'
import { replaceQuestions, findQuestionsForTeacher, gradeAndSubmitQuiz } from '@/lib/quiz/quiz'
import { resolveServedVariantsForStudent, findServedQuestionsForStudent } from '@/lib/quiz/quizDelivery'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'
import type { AIResponse } from '@/lib/ai-orchestration/types'
import { buildTeacherPanel } from '@/lib/attentionFeed/panel'
import { getEilsItems } from '@/lib/attentionFeed/sources'
import { generateActionCandidate } from '@/lib/learnerBlueprint/actionPlan/candidateGeneration'
import { proposeBlueprintAction, approveBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { deliverBlueprintActionToCompass } from '@/lib/learnerBlueprint/actionPlan/delivery/compass'
import { deliverBlueprintActionAsAssignment } from '@/lib/learnerBlueprint/actionPlan/delivery/assignment'
import { recordAssignmentMarkEvidence } from '@/lib/assignments/evidence'
import { reviewBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/review'
import { recordBlueprintActionReviewEvidence, isInstructionalJudgement, REVIEW_EXTRACTION_METHOD } from '@/lib/learnerBlueprint/actionPlan/reviewEvidence'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import { getNextSubject, getOrCreateSession, endSession } from '@/lib/compass/session'
import { resolveCompassAcademicLevelFor } from '@/lib/compass/learnerContext'
import { buildCompassPrompt } from '@/lib/compass/prompt'
import { recordCompassSessionEvidence } from '@/lib/compass/evidence'
import { MASTERY_EXTRACTION_METHOD, ENGAGEMENT_EXTRACTION_METHOD } from '@/lib/compass/evidenceClaimTypes'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_MARY_FULL_CIRCUIT_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

let schoolId: string
let coreLearnerId: string
let legacyStudentId: string
let classId: string
let teacherRowId: string
let teacherUserId: string
let teacherEmail: string
let teacherClient: SupabaseClient

let actionItemId: string
let compassSessionId: string
// Two REAL, distinct sow_substrands ids. `targetSubStrandId` stands in for
// "proportional reasoning"; `otherSubStrandId` is an unrelated Mathematics
// sub-strand used to prove identity collision does not occur.
let targetSubStrandId: string
let otherSubStrandId: string
let assignmentActionItemId: string
let teacherAuthoredActionItemId: string
let deliveredAssignmentId: string
let teacherAuthoredAssignmentId: string
// Adaptive Remediation Phase 1 — the closed-ring (Stage 8) and
// first-assessment/topical-refinement (Stage 9) fixtures.
let refinementWeakSubStrandId: string
let refinementStrongSubStrandId: string
let kofiCoreLearnerId: string
let kofiStudentId: string
let ringQuizOneId: string
let ringQuizTwoId: string
let ringQuestionOneId: string
let ringQuestionTwoId: string
const ingestionRunIds: string[] = []

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
    const r = await fn()
    if (r.error) throw r.error
    return r as { data: T }
  })
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('signInAs: no user after sign-in')
  }, 6)
  return client
}

/**
 * One auto-confirmed teacher_upload Mathematics claim, then persist the
 * projection. `subStrandId` anchors it to a real curriculum sub-strand
 * (Phase 2); omitting it produces the subject-level evidence Phase 1 used.
 */
async function addMathsEvidence(cbcLevel: 1 | 2 | 3 | 4, term: number, subStrandId?: string | null): Promise<string> {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: teacherUserId, teacherId: teacherRowId, institution: null,
  })
  ingestionRunIds.push(runId)

  const evidence: LearnerEvidence = {
    learnerId: legacyStudentId,
    extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics',
    score: null, cbcLevel,
    assessmentType: 'term_exam', academicYear: 2026, term,
    evidenceSource: 'teacher_upload',
    trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100,
    extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:mathematics:t${term}:${subStrandId ?? 'subject'}`,
    importedAt: new Date().toISOString(),
    issues: [],
    subStrandId: subStrandId ?? null,
  }

  const result = await persistEvidenceBatch([evidence], runId)
  await recomputeLearnerProjection(legacyStudentId)
  return result.inserted[0].id
}

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-teacher-${Date.now()}@example.com`
  const { data: authUser } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
  teacherUserId = authUser.user.id
  teacherEmail = email

  const school = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, teacherUserId))
  schoolId = school.id

  await retryDb(() => db.from('school_users')
    .insert({ school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true }).select('id').single())

  const { data: teacherRow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  teacherRowId = teacherRow!.id

  const { data: classRow } = await retryDb(() => db.from('teacher_classes')
    .insert({ teacher_id: teacherRowId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-${Date.now()}` })
    .select('id').single())
  classId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Mary', last_name: 'Wanjiku' })
    .select('id').single())
  coreLearnerId = learnerRow!.id

  const { data: studentRow } = await retryDb(() => db.from('students')
    .insert({
      name: 'Mary Wanjiku', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', teacher_id: teacherRowId, external_id: coreLearnerId,
    })
    .select('id').single())
  legacyStudentId = studentRow!.id

  await retryDb(() => db.from('class_students')
    .insert({ class_id: classId, student_id: legacyStudentId }).select('class_id').single())

  // The legacy learner-model row the Monday/EILS panel enumerates a class by.
  await retryDb(() => db.from('learner_profiles')
    .insert({ student_id: legacyStudentId }).select('id').single())

  // A STALE Clinic context, exactly the situation Phase 1 exists to correct:
  // it says Mary is doing fine in Mathematics ('challenge' -> level 4) while
  // her actual evidence will say Level 1 and declining.
  await retryDb(() => db.from('student_learning_context').upsert({
    student_id: legacyStudentId,
    user_id: teacherUserId,
    grade: 8,
    overall_level: 4,
    subject_tiers: { mathematics: 'challenge', english: 'standard' },
  }, { onConflict: 'student_id' }).select('student_id').single())

  // Real curriculum anchors from the live catalogue — never invented ids.
  const { data: substrands } = await retryDb(() => db
    .from('sow_substrands').select('id, title').order('id').limit(4))
  assert.ok((substrands?.length ?? 0) >= 4, 'this fixture needs four real sow_substrands rows')
  targetSubStrandId = substrands![0].id
  otherSubStrandId = substrands![1].id
  refinementWeakSubStrandId = substrands![2].id
  refinementStrongSubStrandId = substrands![3].id

  // ── A SECOND, DELIBERATELY EMPTY LEARNER (Stage 9) ─────────────────────
  // Kofi exists to prove the first-assessment commitment on a learner with
  // genuinely no history — something Mary, who is seeded with a full
  // evidence arc, structurally cannot demonstrate.
  const { data: kofiLearner } = await retryDb(() => db.from('learners')
    .insert({ school_id: schoolId, admission_number: `${SYNTHETIC_MARKER}-002`, first_name: 'Kofi', last_name: 'Otieno' })
    .select('id').single())
  kofiCoreLearnerId = kofiLearner!.id

  const { data: kofiStudent } = await retryDb(() => db.from('students')
    .insert({
      name: 'Kofi Otieno', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER,
      added_by: 'teacher', teacher_id: teacherRowId, external_id: kofiCoreLearnerId,
    })
    .select('id').single())
  kofiStudentId = kofiStudent!.id

  await retryDb(() => db.from('learner_profiles')
    .insert({ student_id: kofiStudentId }).select('id').single())

  teacherClient = await signInAs(teacherEmail)
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }

  if (isUuid(legacyStudentId)) {
    const { data: rows } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
    const ids = (rows ?? []).map(r => r.id)
    if (ids.length) await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
    await safely(() => db.from('compass_messages').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('evidence_projection_events').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('learner_evidence').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', legacyStudentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', legacyStudentId))
  }
  if (isUuid(coreLearnerId)) {
    await safely(() => db.from('blueprint_compass_deliveries').delete().eq('learner_id', coreLearnerId))
    if (isUuid(actionItemId)) {
      await safely(() => db.from('blueprint_action_item_history').delete().eq('action_item_id', actionItemId))
      await safely(() => db.from('blueprint_action_reviews').delete().eq('action_item_id', actionItemId))
    }
    for (const id of [assignmentActionItemId, teacherAuthoredActionItemId].filter(Boolean)) {
      await safely(() => db.from('blueprint_action_item_history').delete().eq('action_item_id', id))
    }
    for (const id of [deliveredAssignmentId, teacherAuthoredAssignmentId].filter(Boolean)) {
      await safely(() => db.from('assignments').delete().eq('id', id))
    }
  }
  // Adaptive ring fixtures — variants first (FK to questions), then the
  // quizzes, whose own cascade takes the questions and submissions.
  for (const qid of [ringQuestionOneId, ringQuestionTwoId].filter(Boolean)) {
    await safely(() => db.from('assignment_question_variants').delete().eq('question_id', qid))
  }
  for (const id of [ringQuizOneId, ringQuizTwoId].filter(Boolean)) {
    await safely(() => db.from('assignment_submissions').delete().eq('assignment_id', id))
    await safely(() => db.from('assignments').delete().eq('id', id))
  }
  if (isUuid(kofiStudentId)) {
    const { data: kofiRows } = await db.from('learner_evidence').select('id').eq('learner_id', kofiStudentId)
    const kofiIds = (kofiRows ?? []).map(r => r.id)
    if (kofiIds.length) await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', kofiIds))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', kofiStudentId))
    await safely(() => db.from('evidence_projection_events').delete().eq('learner_id', kofiStudentId))
    await safely(() => db.from('learner_evidence').delete().eq('learner_id', kofiStudentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', kofiStudentId))
    await safely(() => db.from('students').delete().eq('id', kofiStudentId))
  }
  if (isUuid(kofiCoreLearnerId)) {
    await safely(() => db.from('learners').delete().eq('id', kofiCoreLearnerId))
  }
  if (isUuid(coreLearnerId)) {
    await safely(() => db.from('blueprint_action_items').delete().eq('learner_id', coreLearnerId))
  }
  if (isUuid(classId)) await safely(() => db.from('class_students').delete().eq('class_id', classId))
  if (isUuid(legacyStudentId)) await safely(() => db.from('students').delete().eq('id', legacyStudentId))
  if (isUuid(classId)) await safely(() => db.from('teacher_classes').delete().eq('id', classId))
  if (isUuid(coreLearnerId)) await safely(() => db.from('learners').delete().eq('id', coreLearnerId))
  if (ingestionRunIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', ingestionRunIds))
  if (isUuid(teacherRowId)) await safely(() => db.from('teachers').delete().eq('id', teacherRowId))
  if (isUuid(schoolId)) {
    await safely(() => db.from('school_users').delete().eq('school_id', schoolId))
    await safely(() => db.from('schools').delete().eq('id', schoolId))
  }
  if (isUuid(teacherUserId)) await safely(() => db.auth.admin.deleteUser(teacherUserId))
})

// ── 1. Confirmed evidence -> Projection identifies the weakness ─────────────

test('1. Mary\'s confirmed Mathematics evidence produces a declining, at-risk projection', async () => {
  // An unrelated Mathematics sub-strand the learner is doing fine in. Exists
  // so the tests below can prove targeted work does not disturb it. Inserted
  // FIRST so it is not the newest subject-level row — `bySubject` is "latest
  // confirmed evidence wins", and the point of this fixture is that the
  // subject-level picture is driven by the weakness.
  await addMathsEvidence(4, 2, otherSubStrandId)
  // Anchored to the target sub-strand — the Phase 2 change.
  await addMathsEvidence(3, 1, targetSubStrandId)   // Term 1: meeting expectation
  await addMathsEvidence(1, 2, targetSubStrandId)   // Term 2: below expectation

  const projection = await recomputeLearnerProjection(legacyStudentId)

  assert.equal(projection.academic?.value.bySubject.mathematics?.latestLevel, 1)
  assert.equal(projection.risk?.value.overallRiskLevel, 'critical')
  assert.equal(classifyGroup(projection, 'mathematics'), 'critical_gap',
    'the one shared classifier names this a critical gap')

  // 1 + 2. Evidence carries the anchor, and Projection resolves it at grain.
  const target = projection.academic!.value.bySubStrand[targetSubStrandId]
  const other = projection.academic!.value.bySubStrand[otherSubStrandId]
  assert.ok(target, 'the targeted sub-strand must appear in academic.bySubStrand')
  assert.equal(target.latestLevel, 1, 'the specific weakness, not just "Mathematics"')
  assert.equal(target.trend, 'declining')
  assert.ok(other, 'the unrelated sub-strand must ALSO exist — not superseded away')
  assert.equal(other.latestLevel, 4, 'and be untouched by the weak one (GATE A: no identity collision)')
})

// ── 2. Teacher Attention contains Mary, and the link reaches her ───────────

test('2. the teacher\'s attention panel surfaces Mary with a real reason', async () => {
  const panel = await buildTeacherPanel(classId, teacherRowId)
  const mary = panel.students_needing_attention.find(s => s.student_id === legacyStudentId)

  assert.ok(mary, 'Mary must appear in the attention list')
  assert.equal(mary!.risk_level, 'critical')
  assert.ok(/mathematics/i.test(mary!.reason), `the reason must name the subject, got: ${mary!.reason}`)
  assert.ok(mary!.suggested_action.length > 0)
})

test('3. the attention item links to a destination that resolves to Mary\'s canonical Blueprint', async () => {
  const items = await getEilsItems(teacherRowId, [classId])
  const maryItem = items.find(i => i.studentId === legacyStudentId)

  assert.ok(maryItem, 'Mary must have a per-learner attention item')
  assert.equal(maryItem!.actionLink, `/teacher/reports/blueprint/${legacyStudentId}`,
    'the link must be the canonical destination, not the route that never existed')

  // And that destination genuinely resolves for this learner: the same
  // legacy -> Core hop the page performs.
  const [row] = await repos.teachers.findExternalIdsByStudentIds([legacyStudentId])
  assert.equal(row?.external_id, coreLearnerId)
})

// ── 4-5. Teacher generates and approves an evidence-backed action ───────────

test('4. the teacher generates an evidence-backed action candidate for Mathematics', async () => {
  const candidate = await generateActionCandidate(asLearnerId(coreLearnerId), schoolId, 'mathematics')

  assert.ok(candidate, 'a candidate must be generated from real projection data')
  assert.equal(candidate!.priority, 'high', 'a critical gap is high priority')
  assert.ok(candidate!.evidenceBasis.supportingEvidenceIds.length >= 2,
    'the candidate must cite the evidence it came from')
  assert.ok(/Mary/.test(candidate!.rationale) || /Level 1/.test(candidate!.rationale),
    `the rationale must be about this learner's real state, got: ${candidate!.rationale}`)

  // 4. The candidate carries the SAME curriculum identity the evidence had.
  assert.equal(candidate!.subStrandId, targetSubStrandId,
    'the candidate must target the weakest ANCHORED sub-strand, by id')
  assert.notEqual(candidate!.targetCapability, 'mathematics',
    'targetCapability is now the human-readable curriculum target, not the bare subject')
  assert.ok(candidate!.targetCapability!.includes('—'), 'it reads "Strand — Sub-Strand"')
})

test('5. the teacher proposes and approves the action', async () => {
  const candidate = (await generateActionCandidate(asLearnerId(coreLearnerId), schoolId, 'mathematics'))!

  const proposed = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(coreLearnerId),
    context: 'current_term',
    title: candidate.title,
    rationale: candidate.rationale,
    intendedOutcome: candidate.intendedOutcome,
    teacherAction: candidate.teacherAction,
    learnerAction: 'Work through proportional reasoning with Compass this week.',
    successIndicator: candidate.successIndicator,
    targetCapability: candidate.targetCapability,
    subStrandId: candidate.subStrandId,
    priority: candidate.priority,
    proposalSource: 'system',
    sourceGenerator: candidate.sourceGenerator,
    evidenceBasis: candidate.evidenceBasis,
  })
  assert.equal(proposed.status, 'proposed')

  // 5. The PERSISTED action item carries it — this is what Migration A added.
  assert.equal(proposed.subStrandId, targetSubStrandId, 'the anchor survives persistence')

  const approved = await approveBlueprintAction(teacherClient, proposed.id, {})
  assert.equal(approved.status, 'approved')
  assert.equal(approved.subStrandId, targetSubStrandId, 'and survives approval')
  actionItemId = approved.id
})

// ── 6. Delivered to Compass ────────────────────────────────────────────────

test('6. the approved action is delivered to Compass with teacher confirmation', async () => {
  const { delivery, alreadyDelivered } = await deliverBlueprintActionToCompass(teacherClient, actionItemId, {
    confirmCompassDelivery: true,
    subject: 'mathematics',
  })

  assert.equal(alreadyDelivered, false)
  assert.equal(delivery.subject, 'mathematics')
  assert.equal(delivery.status, 'available')
  assert.ok(delivery.objective.length > 0, 'the delivery carries a real learner-facing objective')

  // 7. The curriculum target reaches Compass's own channel.
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  const bridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
  assert.equal(bridge.subStrandId, targetSubStrandId,
    'the stable anchor travels on compass_bridge alongside the human-readable reference')
  assert.equal(bridge.firstSubject, 'mathematics')
})

// ── 7-8. Compass uses canonical Projection, and gets the objective ─────────

test('7. Compass\'s academic context comes from Projection, not the stale Clinic tier', async () => {
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  assert.equal((ctx?.subject_tiers ?? {}).mathematics, 'challenge',
    'the stale Clinic tier is genuinely still there, and still says Mary is doing well')

  const state = await resolveCompassAcademicLevelFor(legacyStudentId, 'mathematics', {
    subjectTiers: ctx?.subject_tiers ?? {},
    overallLevel: 4,
    sessionLevel: null,
    clientHint: null,
  })

  assert.equal(state.source, 'projection')
  assert.equal(state.level, 1, 'Compass now teaches to Mary\'s real evidence (Level 1), not the tier (Level 4)')
  assert.equal(state.trend, 'declining')
})

test('8. the teacher\'s objective reaches the real Compass system prompt', async () => {
  const next = await getNextSubject(legacyStudentId)
  assert.equal(next.reason, 'teacher_recommendation', 'the delivery steered the next session')
  assert.equal(next.subject, 'mathematics')
  assert.ok(next.subtopic && next.subtopic.length > 0, 'the objective survived the compass_bridge hop')

  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  const strandName = (ctx?.compass_bridge ?? {}).strandName as string | null

  const prompt = buildCompassPrompt({
    firstName: 'Mary', grade: 8, level: 1, isJunior: true, pathway: null,
    subject: 'mathematics', subtopic: next.subtopic!, gradeTopics: [],
    teacherRecommendation: strandName ?? undefined, teacherSuggested: true,
    sessionsWithoutImprovement: 0,
    mode: 'school', languageMode: 'mixed', questionMode: 'mcq-and-structured',
  })

  assert.ok(prompt.includes(next.subtopic!), 'the delivered objective must appear in the prompt Compass actually sends')
  assert.ok(prompt.includes('Level 1/4 (BE)'), 'the prompt states the canonical level')
})

// ── 9-11. Session -> Evidence -> review gate -> Projection ─────────────────

test('9. a completed Compass session emits Evidence, with mastery held for review', async () => {
  const session = await getOrCreateSession(legacyStudentId, 'mathematics', 'school')
  compassSessionId = session.sessionId
  await db.from('compass_sessions').update({ exchange_count: 8 }).eq('id', compassSessionId)
  await endSession(compassSessionId, legacyStudentId, 'completed', 900, 'mathematics')

  await recordCompassSessionEvidence({
    studentId: legacyStudentId,
    initiatedBy: teacherUserId,
    sessionId: compassSessionId,
    subject: 'mathematics',
    sessionAbandoned: false,
    exchangeCount: 8,
    durationSeconds: 900,
    genuineProgress: true,
    masteredConcepts: ['proportional reasoning'],
    endingLevel: 3,
    academicYear: 2026,
    term: 3,
    // Exactly what app/api/learn/end/route.ts now resolves from
    // compass_bridge for a targeted session in this subject.
    targetSubStrandId: targetSubStrandId,
  })

  const { data: rows } = await db.from('learner_evidence')
    .select('id, extraction_method, lifecycle_state, cbc_level, trust_tier, sub_strand_id')
    .eq('learner_id', legacyStudentId)
    .eq('evidence_source', 'compass_session')

  const mastery = (rows ?? []).find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)
  const engagement = (rows ?? []).find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)

  assert.ok(engagement, 'an engagement claim must be emitted')
  assert.ok(mastery, 'a mastery claim must be emitted for a session that reported genuine progress')
  assert.equal(mastery!.lifecycle_state, 'pending_review',
    'an AI mastery judgement must NEVER auto-confirm — this rule is unchanged by Phase 1')
  assert.equal(mastery!.trust_tier, 1)

  // 9 + 10. Mastery returns curriculum-anchored; engagement never does.
  assert.equal(mastery!.sub_strand_id, targetSubStrandId,
    'a TARGETED session returns mastery evidence with the same curriculum identity')
  assert.equal(engagement!.sub_strand_id, null,
    'engagement stays behavioural — "she attended" must never masquerade as sub-strand mastery')
})

test('10. the mastery claim only reaches Projection after the teacher confirms it', async () => {
  const { data: rows } = await db.from('learner_evidence')
    .select('id, extraction_method, lifecycle_state')
    .eq('learner_id', legacyStudentId)
    .eq('evidence_source', 'compass_session')
  const masteryId = rows!.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!.id
  const engagementRow = rows!.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!

  // Phase 1.5 — the mastery claim is confirmed WITHOUT first confirming the
  // engagement claim, deliberately. Before Phase 1.5 both claims shared a
  // claim key, so the mastery row carried a `supersedes` pointer at the
  // engagement row from its own session and this exact call threw
  // "Invalid evidence lifecycle transition pending_review -> superseded".
  // The circuit could only be completed by confirming engagement first,
  // which is a workaround, not the product. It now works as intended.
  const engagementStateBefore = engagementRow.lifecycle_state

  const before = await recomputeLearnerProjection(legacyStudentId)
  assert.equal(before.academic?.value.bySubject.mathematics?.latestLevel, 1,
    'while pending, the Compass claim changes nothing')

  await confirmReview(masteryId, teacherUserId, `${SYNTHETIC_MARKER}: teacher confirms observed progress`)

  const after = await recomputeLearnerProjection(legacyStudentId)
  assert.equal(after.academic?.value.bySubject.mathematics?.latestLevel, 3,
    'the teacher\'s confirmation — and only that — moves canonical state')
  // Subject-level trend is now 'declining' (4 on the other sub-strand, then
  // 3, 1, 3 on the targeted one) — the honest aggregate across two different
  // sub-strands, and precisely why subject grain was never enough to answer
  // "did the weakness we worked on change?". The round trip is asserted where
  // it is actually meaningful: on the targeted sub-strand, below and in P2-3.
  assert.equal(after.academic?.value.bySubject.mathematics?.trend, 'declining',
    'the subject-level aggregate mixes two different sub-strands')

  // Phase 1.5 — the engagement claim was never part of that transition.
  const { data: afterRows } = await db.from('learner_evidence')
    .select('id, lifecycle_state, supersedes, superseded_by')
    .eq('learner_id', legacyStudentId)
    .eq('evidence_source', 'compass_session')
  const engagementAfter = afterRows!.find(r => r.id === engagementRow.id)!
  assert.equal(engagementAfter.lifecycle_state, engagementStateBefore,
    'confirming mastery must not touch the engagement claim')
  assert.equal(engagementAfter.superseded_by, null)

  // 13 + 15. The targeted sub-strand recomputes; the unrelated one does not.
  const target = after.academic!.value.bySubStrand[targetSubStrandId]
  const other = after.academic!.value.bySubStrand[otherSubStrandId]
  assert.equal(target.latestLevel, 3, 'the specific weakness moved 1 -> 3')
  assert.equal(target.trend, 'stable', 'Level 3 (t1) -> Level 1 (t2) -> Level 3 (t3) on THIS sub-strand')
  assert.equal(other.latestLevel, 4,
    'the unrelated Mathematics sub-strand is unchanged — no identity collision')
})

test('11. Compass now teaches to the improved canonical level', async () => {
  const ctx = await repos.compass.getStudentLearningContext(legacyStudentId)
  const state = await resolveCompassAcademicLevelFor(legacyStudentId, 'mathematics', {
    subjectTiers: ctx?.subject_tiers ?? {}, overallLevel: 4, sessionLevel: null, clientHint: null,
  })
  assert.equal(state.level, 3, 'the loop closed: the learner\'s own work changed what Compass does next')
  assert.equal(state.source, 'projection')
})

// ── 12. Blueprint reflects the change ──────────────────────────────────────

test('12. Mary\'s canonical Blueprint reflects the changed Mathematics state', async () => {
  const { blueprint } = await composeBlueprint({
    actorUserId: teacherUserId, coreLearnerId: asLearnerId(coreLearnerId), schoolId,
  })

  const academic = blueprint.academicRecord
  assert.equal(academic.status, 'available', `academic record should be available, got ${academic.status}`)

  const maths = academic.data?.bySubject?.find(s => /math/i.test(s.subject))
  assert.ok(maths, 'Mathematics must appear in the Blueprint academic record')
  assert.equal(maths!.latestLevel, 3, 'Blueprint shows the post-confirmation level')
  assert.ok(maths!.evidenceCount >= 3, 'and cites the confirmed evidence behind it')
})

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 TRIPWIRES — assertions of what this circuit still cannot do.
//
// These document real, known limitations (G-04 / G-06: curriculum
// anchoring). They are expected to FAIL when that work lands, which is the
// point: the limitation gets reviewed and removed deliberately.
// Do not relax them to make them pass.
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — positive assertions replacing the Phase 1 tripwires.
//
// The three tripwires here asserted what the circuit COULD NOT do:
// sub_strand_id was always null, targetCapability was always the bare
// subject, and bySubStrand was always empty. They were written to fail when
// curriculum anchoring landed. It has landed, so they are replaced by the
// positive statements they were holding a place for.
// ════════════════════════════════════════════════════════════════════════════

test('P2-1 (was TRIPWIRE 1). curriculum identity survives the whole circuit, and only where it should', async () => {
  const { data: rows } = await db.from('learner_evidence')
    .select('sub_strand_id, evidence_source, extraction_method, cbc_level')
    .eq('learner_id', legacyStudentId)

  const anchored = (rows ?? []).filter(r => r.sub_strand_id !== null)
  assert.ok(anchored.length >= 3, 'the assessment evidence and the targeted mastery claim are all anchored')

  // Anchored where the producer genuinely knew the target...
  const compassMastery = (rows ?? []).find(
    r => r.evidence_source === 'compass_session' && r.extraction_method === MASTERY_EXTRACTION_METHOD)
  assert.equal(compassMastery!.sub_strand_id, targetSubStrandId)

  // ...and honestly null where it did not.
  const compassEngagement = (rows ?? []).find(
    r => r.evidence_source === 'compass_session' && r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)
  assert.equal(compassEngagement!.sub_strand_id, null, 'never fabricated for a behavioural claim')
})

test('P2-2 (was TRIPWIRE 2). the action candidate carries stable curriculum identity, not just text', async () => {
  const candidate = (await generateActionCandidate(asLearnerId(coreLearnerId), schoolId, 'mathematics'))!

  assert.equal(candidate.subStrandId, targetSubStrandId, 'a real sow_substrands.id')
  assert.notEqual(candidate.targetCapability, 'mathematics')
  assert.ok(candidate.targetCapability!.includes('—'),
    'targetCapability is human-readable meaning; subStrandId is the identity')

  // And the persisted row holds it (Migration A).
  const persisted = await repos.blueprintActionItems.findById(actionItemId)
  assert.equal(persisted!.sub_strand_id, targetSubStrandId)
})

test('P2-3 (was TRIPWIRE 3). Blueprint can now answer "did THIS weakness change?"', async () => {
  const projection = await recomputeLearnerProjection(legacyStudentId)
  const target = projection.academic!.value.bySubStrand[targetSubStrandId]

  assert.ok(target, 'the specific learning target has its own record')
  assert.ok(target.history.length >= 3, 'with a real chronological history at curriculum grain')
  assert.equal(target.history[0].level, 3)
  assert.equal(target.history[1].level, 1)
  assert.equal(target.history[target.history.length - 1].level, 3,
    'the question "was the proportional-reasoning weakness resolved?" is now answerable from evidence')

  // Blueprint still composes, and still reflects the subject-level picture.
  const { blueprint } = await composeBlueprint({ actorUserId: teacherUserId, coreLearnerId: asLearnerId(coreLearnerId), schoolId })
  assert.equal(blueprint.academicRecord.status, 'available')
})

test('P2-4. Career Intelligence still composes over the anchored record (no regression)', async () => {
  // Phase 2 must not disturb Career Intelligence's canonical inputs. It reads
  // academic.bySubject, which anchoring does not change.
  const { buildCareerIntelligence } = await import('@/lib/learnerIntelligence/careerIntelligence')
  const career = await buildCareerIntelligence(legacyStudentId)
  assert.equal(career.studentId, legacyStudentId)
  assert.ok(career.mode === 'exploration', 'Grade 8 stays in broad-exploration mode — the grade gate is untouched')
  assert.ok(career.disclaimer.length > 0)
})

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 §26 — THE ADAPTIVE ASSIGNMENT PATH
//
// The same identified need, delivered the other way. Proves Teacher
// Intelligence can choose Compass OR an adaptive assignment for one learner
// need, and that curriculum identity survives either route. Compass is not
// involved below.
// ════════════════════════════════════════════════════════════════════════════

test('AA1. a second approved action for the same need is delivered as a targeted, adaptive assignment', async () => {
  const candidate = (await generateActionCandidate(asLearnerId(coreLearnerId), schoolId, 'mathematics'))!
  assert.equal(candidate.subStrandId, targetSubStrandId)

  const proposed = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(coreLearnerId),
    context: 'current_term',
    title: 'Mathematics: reinforcement work',
    rationale: candidate.rationale,
    intendedOutcome: candidate.intendedOutcome,
    teacherAction: candidate.teacherAction,
    learnerAction: 'Complete the targeted practice set.',
    successIndicator: candidate.successIndicator,
    targetCapability: candidate.targetCapability,
    subStrandId: candidate.subStrandId,
    priority: candidate.priority,
    proposalSource: 'system',
    sourceGenerator: candidate.sourceGenerator,
    evidenceBasis: candidate.evidenceBasis,
  })
  const approved = await approveBlueprintAction(teacherClient, proposed.id, {})
  assignmentActionItemId = approved.id

  const { assignment } = await deliverBlueprintActionAsAssignment(teacherClient, approved.id, {
    confirmClassWideDelivery: true,
    classId,
    subject: 'mathematics',
    topic: candidate.targetCapability!,
    type: 'practice',
    maxScore: 20,
    isQuiz: false,
    dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  })
  deliveredAssignmentId = assignment.id

  // The two fields Phase 1 found hardcoded to null/false on this path.
  assert.equal(assignment.substrand_id, targetSubStrandId,
    'the assignment inherits the action\'s curriculum anchor')
  assert.equal(assignment.is_adaptive, true,
    'a system-proposed, sub-strand-targeted action genuinely IS adaptive work')
})

test('AA2. a teacher-authored, subject-level action is NOT labelled adaptive', async () => {
  const proposed = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(coreLearnerId),
    context: 'current_term',
    title: 'General Mathematics revision',
    rationale: 'Teacher judgement after a parents evening.',
    intendedOutcome: 'Broad revision before the exam.',
    successIndicator: 'Completes the revision pack.',
    proposalSource: 'teacher',
  })
  const approved = await approveBlueprintAction(teacherClient, proposed.id, {})
  teacherAuthoredActionItemId = approved.id

  const { assignment } = await deliverBlueprintActionAsAssignment(teacherClient, approved.id, {
    confirmClassWideDelivery: true,
    classId,
    subject: 'mathematics',
    topic: 'Revision',
    type: 'practice',
    maxScore: 20,
    isQuiz: false,
    dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  })
  teacherAuthoredAssignmentId = assignment.id

  assert.equal(assignment.substrand_id, null, 'no anchor to inherit — and none invented')
  assert.equal(assignment.is_adaptive, false,
    'ordinary teacher work must not be pushed into the adaptive variant pipeline')
})

test('AA3. completing the targeted assignment returns evidence with the SAME curriculum identity', async () => {
  await recordAssignmentMarkEvidence({
    studentId: legacyStudentId,
    assignmentId: deliveredAssignmentId,
    subject: 'mathematics',
    topic: 'Targeted practice',
    substrandId: targetSubStrandId,
    score: 16,
    maxScore: 20,
    teacherId: teacherRowId,
    teacherUserId,
    academicYear: 2026,
    term: 3,
    markedAt: new Date().toISOString(),
  })

  const { data: rows } = await db.from('learner_evidence')
    .select('id, sub_strand_id, cbc_level, lifecycle_state, evidence_source, raw_input_ref')
    .eq('learner_id', legacyStudentId)
    .eq('evidence_source', 'teacher_upload')
    .like('raw_input_ref', `assignment:${deliveredAssignmentId}%`)

  assert.ok(rows && rows.length > 0, 'the completed assignment produced evidence')
  const anchored = rows!.find(r => r.sub_strand_id === targetSubStrandId)
  assert.ok(anchored, 'and it carries the anchor the action started with — action -> assignment -> evidence')

  // 26. Projection recomputes THAT sub-strand, and nothing else moves.
  const projection = await recomputeLearnerProjection(legacyStudentId)
  const target = projection.academic!.value.bySubStrand[targetSubStrandId]
  const other = projection.academic!.value.bySubStrand[otherSubStrandId]
  // The precise claim: this specific evidence row is in the targeted
  // sub-strand's chronological record — action -> assignment -> evidence ->
  // projection, all on one identity.
  assert.ok(
    target.history.some(h => h.evidenceId === anchored!.id),
    `the assignment's evidence must appear in the targeted sub-strand's history ` +
    `(history has ${target.history.length} entries: ${target.history.map(h => h.level).join(',')})`,
  )
  assert.equal(other.latestLevel, 4, 'the unrelated sub-strand is still untouched')
})

// ════════════════════════════════════════════════════════════════════════════
// ADAPTIVE REMEDIATION PHASE 1 — STAGE 8: THE CLOSED RING
//
// The audit's headline testing gap: the two halves of the adaptive loop were
// each well covered and had never been tested JOINED. Nothing anywhere
// proved that a learner served one instructional tier, whose outcome changes
// their evidence, is served a DIFFERENT tier next time.
//
// This section proves exactly that, against real rows at every hop:
//
//   evidence -> decision A -> variant A -> binding -> differentiated content
//     -> submission -> variant-keyed grading -> evidence (with provenance)
//       -> projection -> decision B (different) -> variant B (different tier)
//         -> Blueprint reflects the change
//
// Only the AI generation call is substituted, via the pipeline's own
// dependency-injection parameter (`callAI`) — the established test
// architecture for this module. DB persistence, evidence, projection and
// served-variant binding are all real.
// ════════════════════════════════════════════════════════════════════════════

function ringAiResponse(text: string): AIResponse {
  return {
    text, provider: 'deepseek', model: 'test',
    prompt_tokens: 1, completion_tokens: 1, total_tokens: 2,
    latency_ms: 1, cost_units: 0, fallback_used: false,
  }
}

/** Deterministic, tier-labelled generation + an always-passing verification. */
const ringAI: RoutedCompletionFn = async request => {
  if (request.feature === 'adaptive_variant.generate') {
    const tier = /Target instructional tier: (\w+)/.exec(request.prompt)?.[1] ?? 'unknown'
    return ringAiResponse(JSON.stringify({
      questionText: `[${tier}] What is 3/8 + 2/8?`,
      choices: ['5/8', '5/16', '1', '6/8'],
      correctIndex: 0,
      cognitiveIntent: `${tier} intent`,
      difficultyRationale: `${tier} rationale`,
      expectedMisconceptions: ['adds denominators'],
      teacherExplanation: 'Same denominator: add numerators only.',
      learnerExplanation: 'The bottom number stays the same.',
    }))
  }
  return ringAiResponse(JSON.stringify({ valid: true, reason: 'single unambiguous correct answer' }))
}

async function createRingQuiz(title: string, subStrandId: string): Promise<{ assignmentId: string; questionId: string }> {
  const { data: assignment } = await retryDb(() => db.from('assignments').insert({
    class_id: classId, teacher_id: teacherRowId, title,
    subject: 'mathematics', topic: 'Adaptive ring', instructions: 'Answer the question.',
    due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    max_score: 10, is_quiz: true, substrand_id: subStrandId,
  }).select('id').single())

  // The real POST route pre-creates one pending submission per enrolled
  // learner; mirrored here because this fixture inserts the row directly.
  await retryDb(() => db.from('assignment_submissions')
    .insert({ assignment_id: assignment!.id, student_id: legacyStudentId, class_id: classId, status: 'pending' })
    .select('id').single())

  await replaceQuestions(assignment!.id, [
    { questionText: 'Calculate: 3/8 + 2/8', choices: ['5/8', '5/16', '1', '6/8'], correctIndex: 0 },
  ])
  const [question] = await findQuestionsForTeacher(assignment!.id)
  return { assignmentId: assignment!.id, questionId: question.id }
}

const ringLearners = () => [{ learnerId: legacyStudentId, learnerName: 'Mary' }]

test('AR1. DECISION A — Mary is on_track in this sub-strand, and only the tier she needs is generated', async () => {
  const projection = await recomputeLearnerProjection(legacyStudentId)
  const decision = decideAdaptive(projection, 'mathematics', otherSubStrandId)

  assert.equal(decision.groupType, 'on_track', 'state A')
  assert.equal(decision.grain, 'subStrand', 'decided at curriculum grain, not subject grain')
  assert.equal(decision.observationCount, 1)
  assert.equal(decision.evidenceState, 'initial')
  assert.equal(decision.provisional, true, 'one observation adapts, and says it is provisional')

  const created = await createRingQuiz('Adaptive Ring — Quiz 1', otherSubStrandId)
  ringQuizOneId = created.assignmentId
  ringQuestionOneId = created.questionId

  // Cost discipline, unchanged: exactly the tiers a real learner in this
  // class is currently classified into — never all three speculatively.
  const tiers = await resolveTiersForClass(ringLearners(), 'mathematics', otherSubStrandId)
  assert.deepEqual([...tiers.keys()], ['extension'], 'only the tier Mary actually needs')
})

test('AR2. VARIANT A — generated as a draft, approved by the teacher, then permanently bound', async () => {
  const result = await generateAdaptiveVariants({
    questionId: ringQuestionOneId, learners: ringLearners(), subject: 'mathematics',
    subStrandId: otherSubStrandId, callAI: ringAI,
  })
  assert.equal(result.failed.length, 0, JSON.stringify(result.failed))
  assert.equal(result.created.length, 1)
  assert.equal(result.created[0].variant_type, 'extension')
  assert.equal(result.created[0].status, 'draft', 'AI content never reaches a learner unapproved')

  const approved = await approveVariant(result.created[0].id)
  assert.equal(approved.status, 'approved')

  const map = await resolveServedVariantsForStudent({
    assignmentId: ringQuizOneId, studentId: legacyStudentId, learnerName: 'Mary',
  })
  assert.equal(map[ringQuestionOneId], approved.id, 'the extension variant is bound to Mary')

  // And she genuinely receives different content, not a relabelled original.
  const served = await findServedQuestionsForStudent({
    assignmentId: ringQuizOneId, studentId: legacyStudentId, learnerName: 'Mary',
  })
  assert.match(served[0].question_text, /\[extension\]/)
  assert.notEqual(served[0].question_text, 'Calculate: 3/8 + 2/8')
})

test('AR3. OUTCOME — graded against the VARIANT key, and the evidence records which tier produced it', async () => {
  const { grade } = await gradeAndSubmitQuiz({
    assignmentId: ringQuizOneId, studentId: legacyStudentId, classId,
    maxScore: 10,
    answers: [{ questionId: ringQuestionOneId, selectedIndex: 1 }],  // wrong
  })
  assert.equal(grade.score, 0)

  // The same two-step the real route performs: resolve provenance from the
  // already-persisted binding, then emit evidence carrying it.
  const provenance = await buildAdaptiveProvenance({ assignmentId: ringQuizOneId, studentId: legacyStudentId })
  assert.ok(provenance)
  assert.equal(provenance!.servedTier, 'extension', 'provenance names the support actually given')
  assert.equal(provenance!.questionsServedVariant, 1)
  assert.equal(provenance!.questionsServedCanonical, 0)

  await recordQuizAutoGradeEvidence({
    studentId: legacyStudentId, initiatedBy: teacherUserId,
    assignmentId: ringQuizOneId, subject: 'mathematics', topic: 'Adaptive ring',
    substrandId: otherSubStrandId, score: 0, maxScore: 10,
    academicYear: 2026, term: 3,
    adaptiveDelivery: provenance,
  })

  // STAGE 1's central claim, proven end to end: the platform can now answer
  // "what instructional support produced this outcome?" from a persisted row.
  const { data: rows } = await db.from('learner_evidence')
    .select('id, payload, cbc_level, sub_strand_id, evidence_source, lifecycle_state')
    .eq('learner_id', legacyStudentId)
    .like('raw_input_ref', `assignment:${ringQuizOneId}%`)
  assert.equal(rows!.length, 1)
  const payload = rows![0].payload as Record<string, unknown> | null
  assert.ok(payload, 'provenance survived persistence')
  assert.equal(payload!.kind, 'adaptive_delivery')
  assert.equal(payload!.payloadVersion, 1)
  assert.equal(payload!.servedTier, 'extension')
  assert.equal(rows![0].sub_strand_id, otherSubStrandId, 'and it is attached to the right learning target')
  assert.equal(rows![0].lifecycle_state, 'auto_confirmed', 'quiz_auto_grade is tier 2 — it reaches Projection without a gate')
})

test('AR4. DECISION B — projection moved, and the adaptive decision moved with it', async () => {
  const projection = await recomputeLearnerProjection(legacyStudentId)

  const subStrand = projection.academic!.value.bySubStrand[otherSubStrandId]
  assert.equal(subStrand.history.length, 2, 'the outcome joined this sub-strand\'s own record')
  assert.equal(subStrand.latestLevel, 1)

  const decision = decideAdaptive(projection, 'mathematics', otherSubStrandId)
  assert.notEqual(decision.groupType, 'on_track', 'THE RING CLOSED: state A is no longer state B')
  assert.equal(decision.groupType, 'critical_gap', 'state B')
  assert.equal(decision.evidenceState, 'developing', 'two observations now corroborate')
  assert.equal(decision.provisional, false)

  // Point 16 — Blueprint consumes the same updated projection.
  const { blueprint } = await composeBlueprint({ actorUserId: teacherUserId, coreLearnerId: asLearnerId(coreLearnerId), schoolId })
  assert.equal(blueprint.academicRecord.status, 'available')
  const maths = blueprint.academicRecord.data?.bySubject?.find(s => /math/i.test(s.subject))
  assert.equal(maths!.latestLevel, 1, 'Blueprint shows the post-outcome level')
})

test('AR5. VARIANT B — the next assignment resolves a genuinely DIFFERENT tier', async () => {
  const created = await createRingQuiz('Adaptive Ring — Quiz 2', otherSubStrandId)
  ringQuizTwoId = created.assignmentId
  ringQuestionTwoId = created.questionId

  const tiers = await resolveTiersForClass(ringLearners(), 'mathematics', otherSubStrandId)
  assert.deepEqual([...tiers.keys()], ['foundation'], 'the tier Mary needs NOW, not the one she needed before')

  const result = await generateAdaptiveVariants({
    questionId: ringQuestionTwoId, learners: ringLearners(), subject: 'mathematics',
    subStrandId: otherSubStrandId, callAI: ringAI,
  })
  assert.equal(result.created.length, 1)
  await approveVariant(result.created[0].id)

  const map = await resolveServedVariantsForStudent({
    assignmentId: ringQuizTwoId, studentId: legacyStudentId, learnerName: 'Mary',
  })
  const bound = await findVariantById(map[ringQuestionTwoId]!)
  assert.equal(bound!.variant_type, 'foundation')
  assert.notEqual(bound!.variant_type, 'extension',
    'the learner\'s own work changed the instructional support she is served next')
})

test('AR6 (Stage 7). a newly-needed tier can be added later without regenerating what is already in review', async () => {
  // Quiz 1's question already holds an approved `extension`. Mary is now
  // classified `critical_gap` -> `foundation`, a tier that did not exist
  // when quiz 1 was generated. Before Stage 7 this could never be filled.
  const before = await findVariantsForQuestion(ringQuestionOneId)
  const beforeTypes = new Set(before.filter(v => v.status !== 'archived').map(v => v.variant_type))
  assert.ok(beforeTypes.has('extension'))
  assert.ok(!beforeTypes.has('foundation'))

  const result = await generateAdaptiveVariants({
    questionId: ringQuestionOneId, learners: ringLearners(), subject: 'mathematics',
    subStrandId: otherSubStrandId, callAI: ringAI,
  })

  assert.deepEqual(result.tiersConsidered, ['foundation'], 'only the genuinely missing tier')
  assert.equal(result.created.length, 1)
  assert.equal(result.created[0].variant_type, 'foundation')
  assert.equal(result.created[0].status, 'draft', 'still a draft — Stage 7 never bypasses teacher approval')

  const after = await findVariantsForQuestion(ringQuestionOneId)
  const extensionRows = after.filter(v => v.variant_type === 'extension' && v.status !== 'archived')
  assert.equal(extensionRows.length, 1, 'the already-approved extension was not regenerated or duplicated')
  assert.equal(extensionRows[0].status, 'approved')
})

test('AR7 (Stage 6). an already-bound variant is NEVER silently changed by later approvals', async () => {
  // Quiz 1 now has a newly-approved foundation variant AND Mary is now
  // classified into foundation. Her binding must not move: she has already
  // been served, and re-resolving would change a question underneath a
  // learner mid-attempt and grade her against a key she never saw.
  const drafts = await findVariantsForQuestion(ringQuestionOneId)
  const foundationDraft = drafts.find(v => v.variant_type === 'foundation' && v.status === 'draft')
  await approveVariant(foundationDraft!.id)

  const map = await resolveServedVariantsForStudent({
    assignmentId: ringQuizOneId, studentId: legacyStudentId, learnerName: 'Mary',
  })
  const bound = await findVariantById(map[ringQuestionOneId]!)
  assert.equal(bound!.variant_type, 'extension',
    'the immutability invariant holds: what was served stays served')
})

// ════════════════════════════════════════════════════════════════════════════
// ADAPTIVE REMEDIATION PHASE 1 — STAGE 9: ASSESSMENT STARTS UNDERSTANDING,
// TOPICAL EVIDENCE DEEPENS IT
//
// The sprint's governing educational principle, made executable on a learner
// with genuinely no history. EduNexus must be useful from the FIRST valid
// assessment; more evidence must make it more certain and more granular, not
// switch it on.
// ════════════════════════════════════════════════════════════════════════════

async function addKofiEvidence(cbcLevel: 1 | 2 | 3 | 4, subStrandId: string | null, tag: string): Promise<void> {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: teacherUserId, teacherId: teacherRowId, institution: null,
  })
  ingestionRunIds.push(runId)

  await persistEvidenceBatch([{
    learnerId: kofiStudentId,
    extractedName: '', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'mathematics',
    score: null, cbcLevel,
    assessmentType: subStrandId ? 'cat' : 'term_exam',
    academicYear: 2026, term: 1,
    evidenceSource: 'teacher_upload',
    trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100,
    extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:kofi:${tag}`,
    importedAt: new Date().toISOString(),
    issues: [],
    subStrandId,
  }], runId)

  await recomputeLearnerProjection(kofiStudentId)
}

test('TR1. a learner with ZERO evidence is the only real insufficient_data case', async () => {
  const projection = await recomputeLearnerProjection(kofiStudentId)
  assert.equal(projection.academic, null, 'nothing to project from yet')

  const decision = decideAdaptive(projection, 'mathematics')
  assert.equal(decision.groupType, 'insufficient_data')
  assert.equal(decision.evidenceState, 'no_evidence')
})

test('TR2. ONE main assessment establishes a usable picture and adaptation may begin', async () => {
  await addKofiEvidence(3, null, 'main-exam')

  const projection = await recomputeLearnerProjection(kofiStudentId)
  assert.ok(projection.academic, 'a single valid assessment produces a real projection')
  assert.equal(projection.academic!.value.bySubject.mathematics.latestLevel, 3)

  const decision = decideAdaptive(projection, 'mathematics')

  // THE NON-NEGOTIABLE ASSERTION OF THIS SPRINT.
  assert.notEqual(decision.groupType, 'insufficient_data',
    'one trustworthy assessment must never be reported as "not enough evidence"')
  assert.equal(decision.groupType, 'concept_confusion', 'real, usable adaptive support from assessment one')
  assert.equal(decision.evidenceState, 'initial')
  assert.equal(decision.observationCount, 1)

  // ...and it is honest about its own grain and its own provisionality.
  assert.equal(decision.grain, 'subject', 'a subject-level assessment produces a subject-level decision, declared as such')
  assert.equal(decision.provisional, true)
  assert.match(decision.rationale, /not yet enough to call this a persistent pattern/)
})

test('TR3. topical evidence sharpens understanding to sub-strand grain', async () => {
  await addKofiEvidence(2, refinementWeakSubStrandId, 'topical-weak')
  await addKofiEvidence(4, refinementStrongSubStrandId, 'topical-strong')

  const projection = await recomputeLearnerProjection(kofiStudentId)
  const weak = projection.academic!.value.bySubStrand[refinementWeakSubStrandId]
  const strong = projection.academic!.value.bySubStrand[refinementStrongSubStrandId]

  assert.ok(weak, 'the topical assessment created a sub-strand record that did not exist before')
  assert.equal(weak.latestLevel, 2)
  assert.equal(strong.latestLevel, 4)

  // The subject picture and the sub-strand picture now genuinely differ —
  // which is the entire point of topical assessment.
  assert.equal(projection.academic!.value.bySubject.mathematics.latestLevel, 4)
  assert.notEqual(weak.latestLevel, projection.academic!.value.bySubject.mathematics.latestLevel)
})

test('TR4. a targeted assignment uses the sub-strand picture, and does not disturb the others', async () => {
  const projection = await recomputeLearnerProjection(kofiStudentId)

  const weakDecision = decideAdaptive(projection, 'mathematics', refinementWeakSubStrandId)
  assert.equal(weakDecision.grain, 'subStrand')
  assert.equal(weakDecision.groupType, 'prerequisite_gap',
    'the specific weakness is acted on even though the subject-level picture looks strong')

  const strongDecision = decideAdaptive(projection, 'mathematics', refinementStrongSubStrandId)
  assert.equal(strongDecision.groupType, 'on_track', 'the unrelated sub-strand is not reclassified')

  const subjectDecision = decideAdaptive(projection, 'mathematics')
  assert.equal(subjectDecision.grain, 'subject')
  assert.equal(subjectDecision.groupType, 'on_track')

  // Blueprint composes over the refined record without claiming precision
  // the evidence does not support — it still reports at subject grain, and
  // says so, rather than silently presenting a sub-strand level as global.
  const { blueprint } = await composeBlueprint({
    actorUserId: teacherUserId, coreLearnerId: asLearnerId(kofiCoreLearnerId), schoolId,
  })
  assert.equal(blueprint.academicRecord.status, 'available')
  const maths = blueprint.academicRecord.data?.bySubject?.find(s => /math/i.test(s.subject))
  assert.equal(maths!.latestLevel, 4, 'the subject-level claim stays the subject-level claim')
})

// ════════════════════════════════════════════════════════════════════════════
// ADAPTIVE REMEDIATION PHASE 1 — STAGE 4: THE TEACHER'S VERDICT AS EVIDENCE
//
// The audit found the highest-trust signal in the platform — a teacher's
// professional judgement on whether an intervention worked — was recorded
// where no projector could ever see it.
//
// These tests prove three things at once:
//   1. a real instructional judgement now becomes real learner Evidence;
//   2. workflow clicks do NOT;
//   3. "completed" is never allowed to become "mastered".
// ════════════════════════════════════════════════════════════════════════════

async function reviewEvidenceRowsForMary() {
  const { data } = await db.from('learner_evidence')
    .select('id, cbc_level, score, subject, sub_strand_id, extraction_method, evidence_source, raw_input_ref, trust_tier')
    .eq('learner_id', legacyStudentId)
    .eq('extraction_method', REVIEW_EXTRACTION_METHOD)
  return data ?? []
}

test('TV1. workflow-only decisions never become educational evidence', async () => {
  const before = await reviewEvidenceRowsForMary()

  for (const decision of ['reopen', 'defer', 'no_decision'] as const) {
    assert.equal(isInstructionalJudgement(decision), false, `${decision} is workflow, not judgement`)

    const wrote = await recordBlueprintActionReviewEvidence({
      actionItemId:     assignmentActionItemId,
      coreLearnerId: asLearnerId(coreLearnerId),
      decision,
      notes:            'test',
      reviewId:         '00000000-0000-0000-0000-000000000000',
      reviewedByUserId: teacherUserId,
      teacherId:        teacherRowId,
      academicYear:     2026,
      term:             3,
    })
    assert.equal(wrote, false, `${decision} must not write evidence`)
  }

  assert.equal((await reviewEvidenceRowsForMary()).length, before.length, 'not one row was written')
})

test('TV2. a real verdict on a delivered intervention becomes Evidence — through the route\'s path, not the service\'s', async () => {
  const academicBefore = (await recomputeLearnerProjection(legacyStudentId)).academic!.value.bySubject.mathematics.latestLevel

  // The real service call the API route makes first...
  const { review } = await reviewBlueprintAction(teacherClient, assignmentActionItemId, {
    decision: 'complete',
    notes: `${SYNTHETIC_MARKER}: she completed the targeted practice and I am satisfied with it.`,
  })
  assert.equal(review.decision, 'complete')

  // ...and the guardrail still holds: the service itself wrote no Evidence.
  assert.equal((await reviewEvidenceRowsForMary()).length, 0,
    'reviewBlueprintAction must never write evidence itself (ADR-0031)')

  // ...then the orchestration-layer producer the route calls after it.
  const wrote = await recordBlueprintActionReviewEvidence({
    actionItemId:     assignmentActionItemId,
    coreLearnerId: asLearnerId(coreLearnerId),
    decision:         review.decision,
    notes:            review.notes,
    reviewId:         review.id,
    reviewedByUserId: teacherUserId,
    teacherId:        teacherRowId,
    academicYear:     2026,
    term:             3,
  })
  assert.equal(wrote, true)

  const rows = await reviewEvidenceRowsForMary()
  assert.equal(rows.length, 1)
  const row = rows[0]

  // THE CENTRAL DISTINCTION: "completed" is not "mastered".
  assert.equal(row.cbc_level, null, 'a verdict on an intervention is never a measurement of the learner')
  assert.equal(row.score, null)

  // It is nonetheless real, attributed, curriculum-anchored evidence.
  assert.equal(row.evidence_source, 'classroom_observation')
  assert.equal(row.trust_tier, 2, 'a teacher attesting to work they reviewed, not administered')
  assert.equal(row.subject, 'mathematics', 'subject came from the real delivery, never guessed')
  assert.equal(row.sub_strand_id, targetSubStrandId, 'anchored to the learning target the action aimed at')
  assert.match(row.raw_input_ref, /decision=complete/)

  // And it demonstrably cannot move an academic level.
  const academicAfter = (await recomputeLearnerProjection(legacyStudentId)).academic!.value.bySubject.mathematics.latestLevel
  assert.equal(academicAfter, academicBefore,
    'a workflow verdict must not shift the learner\'s academic picture by a single level')
})

test('TV3. a NEGATIVE verdict is recorded just as faithfully as a positive one', async () => {
  const wrote = await recordBlueprintActionReviewEvidence({
    actionItemId:     assignmentActionItemId,
    coreLearnerId: asLearnerId(coreLearnerId),
    decision:         'needs_revision',
    notes:            `${SYNTHETIC_MARKER}: the approach did not work, we need a different one.`,
    reviewId:         '11111111-1111-1111-1111-111111111111',
    reviewedByUserId: teacherUserId,
    teacherId:        teacherRowId,
    academicYear:     2026,
    term:             3,
  })
  assert.equal(wrote, true, 'a record that only ever captured successes would be a biased learner record')

  const rows = await reviewEvidenceRowsForMary()
  assert.equal(rows.length, 2)
  assert.ok(rows.some(r => /decision=needs_revision/.test(r.raw_input_ref)))
  assert.ok(rows.every(r => r.cbc_level === null), 'neither verdict claims a level')
})

test('TV4. an action that never reached the learner produces no verdict evidence', async () => {
  // teacherAuthoredActionItemId WAS delivered as an assignment (AA2), so the
  // undelivered case is constructed explicitly. A merely PROPOSED action is
  // the cleanest such case — it has, by definition, never reached the
  // learner, and so has no delivery to source a real subject from.
  const proposed = await proposeBlueprintAction(teacherClient, {
    coreLearnerId: asLearnerId(coreLearnerId),
    context: 'current_term',
    title: 'Never delivered',
    rationale: 'Teacher judgement after a corridor conversation.',
    intendedOutcome: 'Mary revises independently before the end of term.',
    successIndicator: 'Mary scores at least Level 3 on the next Mathematics topical check.',
    proposalSource: 'teacher',
  })

  const wrote = await recordBlueprintActionReviewEvidence({
    actionItemId:     proposed.id,
    coreLearnerId: asLearnerId(coreLearnerId),
    decision:         'complete',
    notes:            null,
    reviewId:         '22222222-2222-2222-2222-222222222222',
    reviewedByUserId: teacherUserId,
    teacherId:        teacherRowId,
    academicYear:     2026,
    term:             3,
  })
  assert.equal(wrote, false, 'no delivery means no instructional outcome to observe — and no guessed subject')
})
