// lib/compass/learnerContext.integration.test.ts
//
// Phase 1 / P0-A — proves the Compass learner-context convergence against
// real (synthetic, cleaned-up) rows: real evidence, real projections, a
// real student_learning_context row, real Compass sessions.
//
// The pure precedence rules are covered in learnerContext.test.ts. This
// file proves the parts that only a database can:
//
//   - a confirmed evidence change actually moves what Compass would teach
//     to (the loop the whole convergence exists to close);
//   - a stale legacy tier really does lose to canonical state on real rows;
//   - the Clinic's own diagnostic context (root causes, guided topics) is
//     untouched and still enriches the session;
//   - a teacher-delivered objective reaches the real system prompt — the
//     silent-drop path through `isSubtopicCompatible` that had no test;
//   - session lifecycle, rest windows and the sessions-without-improvement
//     counter are all unchanged by the switch.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student/context rows and evidence, all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/learnerContext.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { setTeacherSuggestedTopic } from '@/lib/compass/objective'
import { buildCompassPrompt } from '@/lib/compass/prompt'
import { getNextSubject, getOrCreateSession, endSession } from '@/lib/compass/session'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  readCompassAcademicProjection,
  resolveCompassAcademicLevelFor,
  resolveCompassLearnerContext,
  resolveCompassLearnerIntelligence,
} from './learnerContext'

const SYNTHETIC_MARKER = 'SYNTHETIC_P0A_COMPASS_CONTEXT_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
const ingestionRunIds: string[] = []
const evidenceIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

/**
 * Inserts one auto-confirmed teacher_upload evidence row (tier 3 -> 100
 * confidence -> auto_confirmed) and recomputes the learner's projection so
 * `learner_projections` actually holds it — the adapter reads persisted
 * rows only, exactly as the live Compass path does.
 */
async function addConfirmedEvidence(subject: string, cbcLevel: 1 | 2 | 3 | 4, term: number): Promise<string> {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
  })
  ingestionRunIds.push(runId)

  const evidence: LearnerEvidence = {
    learnerId: studentId,
    extractedName: '', extractedExternalId: null,
    subject, rawSubject: subject,
    score: null, cbcLevel,
    assessmentType: 'term_exam',
    academicYear: 2026, term,
    evidenceSource: 'teacher_upload',
    trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100,
    extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:${subject}:t${term}`,
    importedAt: new Date().toISOString(),
    issues: [],
  }

  const result = await persistEvidenceBatch([evidence], runId)
  const id = result.inserted[0].id
  evidenceIds.push(id)
  await recomputeLearnerProjection(studentId)
  return id
}

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data: authUser } = await retryAsync(async () => {
    const r = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
    if (r.error) throw r.error
    return r
  })
  authUserId = authUser.user.id

  const { data: teacher } = await retryAsync(async () => {
    const r = await db.from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  teacherId = teacher!.id

  const { data: student } = await retryAsync(async () => {
    const r = await db.from('students')
      .insert({ name: 'Mary Context Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId })
      .select('id').single()
    if (r.error) throw r.error
    return r
  })
  studentId = student!.id

  // A realistic STALE Clinic context: tiers that disagree with the evidence
  // added below, plus the Clinic-only diagnostic fields Projection has no
  // equivalent for.
  await retryAsync(async () => {
    const r = await db.from('student_learning_context').upsert({
      student_id: studentId,
      user_id: authUserId,
      grade: 8,
      overall_level: 1,
      subject_tiers: { mathematics: 'remedial', english: 'challenge', kiswahili: 'standard' },
      guided_topics: ['Equivalent fractions', 'Ratio basics'],
      subject_action_steps: { mathematics: ['Revisit equivalent fractions'] },
      knowledge_root_causes: [{
        subject: 'mathematics',
        failing_topic_name: 'Proportional reasoning',
        performance: 1,
        root_causes: [{ name: 'Equivalent fractions', strand: 'Numbers', depth: 2 }],
      }],
      sessions_without_improvement: 2,
    }, { onConflict: 'student_id' })
    if (r.error) throw r.error
    return r
  })
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (studentId) {
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', studentId))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', studentId))
    await safely(() => db.from('evidence_projection_events').delete().eq('learner_id', studentId))
    await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds))
    await safely(() => db.from('learner_evidence').delete().eq('learner_id', studentId))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', studentId))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', studentId))
    await safely(() => db.from('students').delete().eq('id', studentId))
  }
  if (ingestionRunIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', ingestionRunIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await deleteAuthUserOrThrow(db, authUserId)
})

const legacyFromContext = async () => {
  const ctx = await repos.compass.getStudentLearningContext(studentId)
  return {
    subjectTiers: ctx?.subject_tiers ?? {},
    overallLevel: 1,
    sessionLevel: null,
    clientHint: null,
  }
}

// ── Before any evidence: the legacy fallback is genuinely in use ────────────

test('baseline: with no confirmed evidence, Compass still uses the legacy Clinic tier', async () => {
  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  assert.equal(state.source, 'legacy_tier')
  assert.equal(state.level, 1, 'the stale "remedial" tier')
})

// ── 1 + 3. Canonical wins over a conflicting stale tier, on real rows ───────

test('1. once confirmed evidence exists, Compass uses the canonical projection level', async () => {
  await addConfirmedEvidence('mathematics', 3, 1)

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  assert.equal(state.source, 'projection')
  assert.equal(state.level, 3)

  // This is Projection's own confidence in the academic dimension
  // (computeProjectionConfidence — evidence count, diversity, freshness),
  // NOT the per-row evidence confidence. A single row is deliberately low
  // confidence, which is the honest answer and the reason this field is
  // surfaced at all.
  assert.ok(typeof state.confidence === 'number' && state.confidence > 0 && state.confidence <= 100,
    `expected a real projection confidence, got ${state.confidence}`)
  assert.ok(state.confidence! < 100, 'one evidence row must not read as full confidence')
})

test('3. the stale legacy tier (remedial/1) does not override the canonical level (3)', async () => {
  const ctx = await repos.compass.getStudentLearningContext(studentId)
  assert.equal((ctx?.subject_tiers ?? {}).mathematics, 'remedial', 'the legacy tier is genuinely still there and still says remedial')

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  assert.equal(state.level, 3, 'canonical must win on real data, not just in the unit test')
})

// ── 2. An evidence change moves the Compass context ─────────────────────────

test('2. a second, higher confirmed evidence row moves the Compass academic level', async () => {
  const before = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())

  await addConfirmedEvidence('mathematics', 4, 2)

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  assert.equal(state.level, 4, 'the newest confirmed evidence is what Compass now teaches to')
  assert.equal(state.source, 'projection')
  assert.equal(state.trend, 'improving', 'trend comes from Projection and is real, not inferred from a tier')
  assert.ok(state.confidence! > before.confidence!,
    'more evidence must raise Projection\'s confidence — the value tracks the record, it is not a constant')
})

test('2b. retracting evidence moves the Compass context back — the loop closes in both directions', async () => {
  const latest = evidenceIds[evidenceIds.length - 1]
  await retractEvidence(latest, authUserId, `${SYNTHETIC_MARKER}: retraction test`)
  await recomputeLearnerProjection(studentId)

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  assert.equal(state.level, 3, 'with the Level 4 row retracted, Compass falls back to the remaining Level 3 evidence')
  assert.equal(state.source, 'projection')
})

// ── 5. Clinic diagnostic context survives independently ─────────────────────

test('5. Clinic-only diagnostic context is untouched and still available to enrich the session', async () => {
  const ctx = await db.from('student_learning_context')
    .select('knowledge_root_causes, guided_topics, subject_action_steps, subject_tiers, overall_level')
    .eq('student_id', studentId).maybeSingle()

  const row = ctx.data!
  assert.ok(Array.isArray(row.knowledge_root_causes) && row.knowledge_root_causes.length === 1, 'root causes intact')
  assert.deepEqual(row.guided_topics, ['Equivalent fractions', 'Ratio basics'], 'guided topics intact')
  assert.ok(row.subject_action_steps, 'action steps intact')

  // And the thing P0-A must NOT have done: no Projection value was copied
  // back into the legacy table. The tier is still the stale one.
  assert.equal((row.subject_tiers as Record<string, string>).mathematics, 'remedial',
    'Projection must never be synchronized into subject_tiers — one truth, not two copies')
  assert.equal(row.overall_level, 1, 'overall_level must not have been rewritten either')
})

// ── 6. A teacher-delivered objective reaches the real prompt ────────────────

test('6. a teacher-suggested objective survives into the actual Compass system prompt', async () => {
  const OBJECTIVE = 'Practise proportional reasoning with equivalent fractions'
  const STRAND = 'Numbers — Proportional reasoning'

  await setTeacherSuggestedTopic({
    studentId, subject: 'mathematics', concept: OBJECTIVE, strandName: STRAND,
  })

  const next = await getNextSubject(studentId)
  assert.equal(next.reason, 'teacher_recommendation', 'teacher intent outranks canonical ranking — it is authoritative')
  assert.equal(next.subject, 'mathematics')
  assert.equal(next.subtopic, OBJECTIVE, 'the objective text itself must survive the compass_bridge hop')

  // The exact prompt the route builds for a teacher-directed session.
  const prompt = buildCompassPrompt({
    firstName: 'Mary', grade: 8, level: 3, isJunior: true, pathway: null,
    subject: 'mathematics', subtopic: next.subtopic!, gradeTopics: [],
    teacherRecommendation: STRAND, teacherSuggested: true,
    sessionsWithoutImprovement: 0,
    mode: 'school', languageMode: 'english-only', questionMode: 'structured-only',
  })

  assert.ok(prompt.includes(STRAND), 'the teacher instruction must appear in the system prompt')
  assert.ok(prompt.includes('Teacher instruction:'), 'and be labelled as a teacher instruction')
  assert.ok(prompt.includes('your teacher arranged this session') || prompt.includes('Your teacher arranged this session'),
    'a teacher-directed session must open as one')
})

test('6b. teacher intent is NOT overridden by canonical ranking', async () => {
  // english has the strongest tier (challenge) and mathematics the weakest,
  // so a purely ranking-driven answer would never pick a teacher-directed
  // subject if that subject happened to be the learner's strongest.
  const next = await getNextSubject(studentId)
  assert.equal(next.reason, 'teacher_recommendation')
  assert.equal(next.subject, 'mathematics', 'compass_bridge decides the subject while teacherSuggested is set')
})

// ── 7. Learner-directed selection still works ──────────────────────────────

test('7. with no teacher direction, ranking is canonical-first and learner-directed choice remains', async () => {
  await repos.compass.mergeTeacherSuggestedTopic(studentId, { teacherSuggested: false })

  const { ranking } = await resolveCompassLearnerContext({
    learnerId: studentId, subject: 'mathematics', legacy: await legacyFromContext(),
  })

  const maths = ranking.find(r => r.subject === 'mathematics')!
  const kiswahili = ranking.find(r => r.subject === 'kiswahili')!
  assert.equal(maths.source, 'projection', 'mathematics has evidence — canonical')
  assert.equal(maths.level, 3)
  assert.equal(kiswahili.source, 'legacy_tier', 'kiswahili has no evidence — legacy tier, still offered')

  const next = await getNextSubject(studentId)
  assert.ok(next.reason !== 'teacher_recommendation', 'without teacher direction the learner is not locked in')
  assert.ok(ranking.some(r => r.sourceKey === next.subject), 'the picked subject comes from the ranked candidate set')
})

// ── 8-10. Session lifecycle, rest windows, counters are unchanged ───────────

test('8. session create / resume / end still behave exactly as before', async () => {
  const created = await getOrCreateSession(studentId, 'mathematics', 'school')
  assert.equal(created.isNew, true)

  const resumed = await getOrCreateSession(studentId, 'mathematics', 'school')
  assert.equal(resumed.isNew, false, 'a session within the resume window is resumed, not duplicated')
  assert.equal(resumed.sessionId, created.sessionId)

  const ended = await endSession(created.sessionId, studentId, 'completed', 120, 'mathematics')
  assert.equal(ended, true, 'the first end transitions the session')

  const endedAgain = await endSession(created.sessionId, studentId, 'completed', 120, 'mathematics')
  assert.equal(endedAgain, false, 'a repeat end is still a no-op — XP/evidence gating is unchanged')
})

test('9. an active rest window still suppresses the rested subject', async () => {
  const restUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await db.from('student_learning_context')
    .update({ subject_rest_until: restUntil, compass_bridge: { teacherSuggested: false } })
    .eq('student_id', studentId)

  const next = await getNextSubject(studentId)
  assert.ok(next.subject !== 'mathematics', 'mathematics was the last session subject and is being rested')

  await db.from('student_learning_context').update({ subject_rest_until: null }).eq('student_id', studentId)
})

test('10. sessions_without_improvement is untouched by the context switch', async () => {
  const { data } = await db.from('student_learning_context')
    .select('sessions_without_improvement').eq('student_id', studentId).maybeSingle()
  assert.equal(data!.sessions_without_improvement, 2, 'the counter Compass owns is still exactly what was seeded')
})

// ── Read-only guarantee, observed rather than asserted statically ───────────

test('R. reading Compass context writes no projection rows (no recompute side effect)', async () => {
  const before = await db.from('learner_projections').select('id, last_computed').eq('learner_id', studentId)
  const beforeStamps = (before.data ?? []).map(r => r.last_computed).sort()

  await readCompassAcademicProjection(studentId)
  await resolveCompassAcademicLevelFor(studentId, 'mathematics', await legacyFromContext())
  await resolveCompassLearnerContext({ learnerId: studentId, subject: 'mathematics', legacy: await legacyFromContext() })

  const afterRead = await db.from('learner_projections').select('id, last_computed').eq('learner_id', studentId)
  const afterStamps = (afterRead.data ?? []).map(r => r.last_computed).sort()

  assert.deepEqual(afterStamps, beforeStamps,
    'no learner_projections row may be rewritten by a learner reading their own Compass context')
})

test('R2. a learner with no persisted projection degrades to legacy rather than throwing', async () => {
  const state = await resolveCompassAcademicLevelFor(
    '00000000-0000-0000-0000-000000000000',
    'mathematics',
    { subjectTiers: { mathematics: 'standard' }, overallLevel: null, sessionLevel: null, clientHint: null },
  )
  assert.equal(state.source, 'legacy_tier')
  assert.equal(state.level, 3)
})

// ── Phase 4 (Blueprint/Compass Intelligence Convergence): resolveCompassLearnerIntelligence ──
//
// Uses a fresh subject (integrated_science) rather than 'mathematics' —
// by this point in the file, mathematics's evidence history has been
// mutated by tests 1/2/2b (added, then retracted) in ways this section
// does not depend on and should not be coupled to.

test('P4-1. a real declining, below-expectation subject: capabilityLevel/trajectory/riskFactors all reflect the SAME real Projection data', async () => {
  await addConfirmedEvidence('integrated_science', 4, 1)
  await addConfirmedEvidence('integrated_science', 1, 2)

  const { persistent } = await resolveCompassLearnerIntelligence({
    learnerId: studentId,
    subject: 'integrated_science',
    legacy: await legacyFromContext(),
  })

  assert.equal(persistent.capabilityLevel, 'emerging', 'Level 1 latest evidence must map to the emerging capability band')
  assert.equal(persistent.trajectory, 'declining', 'earliest Level 4 -> latest Level 1 is a real decline, from the Growth projector')
  assert.equal(persistent.evidenceSufficiency, 'limited', 'two low-diversity rows must not read as "established"')
  assert.equal(persistent.riskFactors.length, 1, 'riskProjector must flag Below-Expectation-and-declining for this subject')
  assert.match(persistent.riskFactors[0], /Below Expectation in integrated_science and declining from prior evidence/)
})

test('P4-2. a DIFFERENT subject with no evidence at all: evidenceSufficiency "none", no cross-subject leakage of integrated_science\'s risk factor', async () => {
  const { persistent } = await resolveCompassLearnerIntelligence({
    learnerId: studentId,
    subject: 'kiswahili',
    legacy: await legacyFromContext(),
  })
  assert.equal(persistent.capabilityLevel, null)
  assert.equal(persistent.evidenceSufficiency, 'none')
  assert.deepEqual(persistent.riskFactors, [], 'kiswahili must never inherit integrated_science\'s risk flag')
})

test('P4-3. the academic level and persistent intelligence resolve from ONE projection read, not two', async () => {
  const before = await db.from('learner_projections').select('id, last_computed').eq('learner_id', studentId)
  const beforeStamps = (before.data ?? []).map(r => r.last_computed).sort()

  const { academic, persistent } = await resolveCompassLearnerIntelligence({
    learnerId: studentId,
    subject: 'integrated_science',
    legacy: await legacyFromContext(),
  })
  assert.equal(academic.source, 'projection')
  assert.equal(persistent.capabilityLevel, 'emerging')

  const afterRead = await db.from('learner_projections').select('id, last_computed').eq('learner_id', studentId)
  const afterStamps = (afterRead.data ?? []).map(r => r.last_computed).sort()
  assert.deepEqual(afterStamps, beforeStamps, 'resolveCompassLearnerIntelligence must not write any projection row (read-only, same contract as the rest of this module)')
})

test('P4-4. real risk-factor text flows unmodified into the actual Compass system prompt', async () => {
  const { persistent } = await resolveCompassLearnerIntelligence({
    learnerId: studentId,
    subject: 'integrated_science',
    legacy: await legacyFromContext(),
  })
  const prompt = buildCompassPrompt({
    firstName: 'Mary', grade: 8, level: 1, isJunior: true,
    persistentIntelligence: persistent,
    subject: 'integrated_science', subtopic: 'integrated_science',
    gradeTopics: [], sessionsWithoutImprovement: 0,
    mode: 'school', languageMode: 'mixed', questionMode: 'mcq-and-structured',
  })
  assert.match(prompt, /Below Expectation in integrated_science and declining from prior evidence/)
  assert.match(prompt, /trust what they show you now and adjust immediately/)
})
