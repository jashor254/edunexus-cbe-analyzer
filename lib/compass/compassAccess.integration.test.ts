// lib/compass/compassAccess.integration.test.ts
//
// Phase 2.5 / G-05 — Compass access no longer requires an Academic Clinic
// row. Real (synthetic, cleaned-up) rows.
//
// Before this, `/api/learn/student` bailed out the instant
// `student_learning_context` was missing, so a Clinic assessment was the one
// key that opened Compass. Measured against production at the time: 480
// learners had a canonical academic projection, 83 had a Clinic row, and 4
// had both — so the gate excluded roughly 476 evidence-rich learners from a
// tool their own evidence had already earned them.
//
// Access is now decided by whether the platform can actually offer the
// learner something to work on (the union of canonical Projection subjects
// and legacy Clinic tiers), not by which table the knowledge came from.
//
// These tests exercise the access DECISION directly — the union that the
// route gates on — rather than over HTTP, for the same reason the other
// integration suites here do: the decision is the thing that can regress,
// and it is testable without a running server.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student rows and evidence, all deleted in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/compassAccess.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { readCompassAcademicProjection, resolveCompassSubjectRanking, resolveCompassAcademicLevelFor } from './learnerContext'
import { getOrCreateSession, getNextSubject } from './session'
import { setTeacherSuggestedTopic } from './objective'
import { resolveCompassStudentAccess } from './ownership'

const SYNTHETIC_MARKER = 'SYNTHETIC_P25_COMPASS_ACCESS_TEST'
const db = createServiceClient()

let authUserId: string
let otherAuthUserId: string
let teacherId: string
/** Case A — canonical evidence, NO student_learning_context row. */
let evidenceOnlyId: string
/** Case B — Clinic context, no confirmed evidence. */
let clinicOnlyId: string
/** Case C — both. */
let bothId: string
/** Case D — neither. */
let emptyId: string
const runIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try { return await fn() } catch (e) { lastError = e }
    await new Promise(r => setTimeout(r, 500 * i))
  }
  throw lastError
}

async function mkStudent(name: string, ownerUserId = authUserId): Promise<string> {
  const { data } = await retryAsync(async () => {
    const r = await db.from('students')
      .insert({ name, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId, user_id: ownerUserId })
      .select('id').single()
    if (r.error) throw r.error
    return r
  })
  return data!.id
}

async function addEvidence(learnerId: string, subject: string, cbcLevel: 1 | 2 | 3 | 4) {
  const { id: runId } = await repos.evidence.createIngestionRun({
    source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
  })
  runIds.push(runId)
  const e: LearnerEvidence = {
    learnerId, extractedName: '', extractedExternalId: null,
    subject, rawSubject: subject, score: null, cbcLevel,
    assessmentType: 'term_exam', academicYear: 2026, term: 1,
    evidenceSource: 'teacher_upload', trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
    evidenceConfidence: 100, extractionMethod: `${SYNTHETIC_MARKER}_v1`,
    reviewStatus: 'auto_confirmed',
    rawInputRef: `${SYNTHETIC_MARKER}:${learnerId}:${subject}`,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null,
  }
  await persistEvidenceBatch([e], runId)
  await recomputeLearnerProjection(learnerId)
}

/**
 * The exact decision `/api/learn/student` now makes: the union of canonical
 * Projection subjects and legacy Clinic tiers. Non-empty = Compass opens.
 */
async function accessDecision(learnerId: string) {
  const ctx = await repos.compass.getStudentLearningContext(learnerId)
  const { academic } = await readCompassAcademicProjection(learnerId)
  const ranking = resolveCompassSubjectRanking({ academic, subjectTiers: ctx?.subject_tiers ?? {} })
  return { ranking, available: ranking.length > 0, hasClinicRow: ctx !== null }
}

before(async () => {
  const mk = async (label: string) => {
    const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
    const { data } = await retryAsync(async () => {
      const r = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
      if (r.error) throw r.error
      return r
    })
    return data.user.id
  }
  authUserId = await mk('owner')
  otherAuthUserId = await mk('stranger')

  const { data: t } = await retryAsync(async () => {
    const r = await db.from('teachers').insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single()
    if (r.error) throw r.error
    return r
  })
  teacherId = t!.id

  evidenceOnlyId = await mkStudent('Evidence Only (Case A)')
  clinicOnlyId = await mkStudent('Clinic Only (Case B)')
  bothId = await mkStudent('Both (Case C)')
  emptyId = await mkStudent('Neither (Case D)')

  // Case A + C: real confirmed evidence.
  await addEvidence(evidenceOnlyId, 'mathematics', 2)
  await addEvidence(evidenceOnlyId, 'english', 4)
  await addEvidence(bothId, 'mathematics', 3)

  // Case B + C: a Clinic row. Case C's tier deliberately DISAGREES with its
  // evidence so the precedence assertion has something to bite on.
  for (const [id, tiers] of [
    [clinicOnlyId, { kiswahili: 'remedial', english: 'standard' }],
    [bothId, { mathematics: 'remedial', kiswahili: 'standard' }],
  ] as const) {
    await retryAsync(async () => {
      const r = await db.from('student_learning_context').upsert({
        student_id: id, user_id: authUserId, grade: 8, overall_level: 2,
        subject_tiers: tiers,
        guided_topics: ['Diagnostic topic'],
        knowledge_root_causes: [{ subject: 'mathematics', failing_topic_name: 'X', performance: 1, root_causes: [{ name: 'Y', strand: 'Numbers', depth: 1 }] }],
      }, { onConflict: 'student_id' }).select('student_id').single()
      if (r.error) throw r.error
      return r
    })
  }
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  for (const id of [evidenceOnlyId, clinicOnlyId, bothId, emptyId].filter(Boolean)) {
    const { data } = await db.from('learner_evidence').select('id').eq('learner_id', id)
    const ids = (data ?? []).map(r => r.id)
    if (ids.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', ids))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', ids))
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', ids))
      await safely(() => db.from('learner_evidence').delete().in('id', ids))
    }
    await safely(() => db.from('compass_sessions').delete().eq('learner_id', id))
    await safely(() => db.from('learner_projections').delete().eq('learner_id', id))
    await safely(() => db.from('student_learning_context').delete().eq('student_id', id))
    await safely(() => db.from('learner_profiles').delete().eq('student_id', id))
    await safely(() => db.from('students').delete().eq('id', id))
  }
  if (runIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', runIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  for (const u of [authUserId, otherAuthUserId].filter(Boolean)) await safely(() => db.auth.admin.deleteUser(u))
})

// ── 1. CASE A — the whole point of G-05 ────────────────────────────────────

test('1. a learner with canonical evidence and NO Clinic row can reach Compass', async () => {
  const decision = await accessDecision(evidenceOnlyId)

  assert.equal(decision.hasClinicRow, false, 'this learner genuinely has no student_learning_context row')
  assert.equal(decision.available, true, 'and Compass is available anyway — this is G-05')
  assert.deepEqual(
    decision.ranking.map(r => r.subject).sort(),
    ['english', 'mathematics'],
    'their subjects come from their own evidence',
  )
  assert.ok(decision.ranking.every(r => r.source === 'projection'))
  assert.equal(decision.ranking[0].subject, 'mathematics', 'and are still ordered weakest-first')
})

test('1b. that learner gets a real, canonical academic level — not a default', async () => {
  const state = await resolveCompassAcademicLevelFor(evidenceOnlyId, 'mathematics', {
    subjectTiers: {}, overallLevel: null, sessionLevel: null, clientHint: null,
  })
  assert.equal(state.source, 'projection')
  assert.equal(state.level, 2)
})

test('13. granting access creates NO student_learning_context row', async () => {
  // The fix must not quietly manufacture the legacy row it stopped requiring.
  await accessDecision(evidenceOnlyId)
  await getNextSubject(evidenceOnlyId)
  const { data } = await db.from('student_learning_context').select('student_id').eq('student_id', evidenceOnlyId).maybeSingle()
  assert.equal(data, null, 'no legacy row may be created as a side effect of access')
})

// ── 2/3. CASES B and C ─────────────────────────────────────────────────────

test('3. CASE B — a learner with only a Clinic row still reaches Compass (legacy fallback intact)', async () => {
  const decision = await accessDecision(clinicOnlyId)
  assert.equal(decision.available, true)
  assert.ok(decision.ranking.every(r => r.source === 'legacy_tier'), 'served entirely by the legacy fallback')
  assert.equal(decision.ranking[0].subject, 'kiswahili', 'weakest tier first')
})

test('2. CASE C — with both, Projection controls the level and Clinic enriches', async () => {
  const decision = await accessDecision(bothId)
  assert.equal(decision.available, true)

  const maths = decision.ranking.find(r => r.subject === 'mathematics')!
  assert.equal(maths.source, 'projection', 'the anchored subject is Projection-sourced')
  assert.equal(maths.level, 3, 'canonical Level 3 beats the Clinic tier that says remedial (1)')

  const kiswahili = decision.ranking.find(r => r.subject === 'kiswahili')!
  assert.equal(kiswahili.source, 'legacy_tier', 'a subject with no evidence still comes from the Clinic')

  // Clinic diagnostics remain available to enrich the session.
  const ctx = await repos.compass.getStudentLearningContext(bothId)
  assert.ok(ctx, 'the Clinic row is untouched')
  const { data: full } = await db.from('student_learning_context')
    .select('knowledge_root_causes, guided_topics').eq('student_id', bothId).maybeSingle()
  assert.ok(Array.isArray(full!.knowledge_root_causes) && full!.knowledge_root_causes.length > 0,
    'root-cause diagnostics survive — Clinic enriches, it just no longer gates')
})

// ── 4. CASE D — the honest remaining gate ──────────────────────────────────

test('4. CASE D — with neither evidence nor Clinic context, access is still withheld', async () => {
  const decision = await accessDecision(emptyId)
  assert.equal(decision.available, false)
  assert.equal(decision.ranking.length, 0,
    'there is genuinely no subject to offer and no level to teach to — asking for a diagnostic is the honest answer')
})

test('4b. Case D is decided by absence of CONTENT, not absence of a Clinic row', async () => {
  // The distinction that makes G-05 a real fix rather than a moved goalpost:
  // Case A also has no Clinic row, and it IS available.
  const caseA = await accessDecision(evidenceOnlyId)
  const caseD = await accessDecision(emptyId)
  assert.equal(caseA.hasClinicRow, false)
  assert.equal(caseD.hasClinicRow, false)
  assert.equal(caseA.available, true)
  assert.equal(caseD.available, false)
})

// ── 5-7. Learner and teacher direction still work ──────────────────────────

test('5. learner-directed subject choice remains possible without a Clinic row', async () => {
  const next = await getNextSubject(evidenceOnlyId)
  assert.notEqual(next.reason, 'teacher_recommendation', 'no teacher direction here')
  const decision = await accessDecision(evidenceOnlyId)
  assert.ok(decision.ranking.some(r => r.sourceKey === next.subject),
    'the pick comes from the learner\'s own available subjects')
})

test('6. teacher-directed Compass still works for a learner with no Clinic row', async () => {
  // setTeacherSuggestedTopic upserts compass_bridge; that legitimately
  // creates the row, because a teacher deliberately queued something — which
  // is different from creating one merely to grant access (test 13).
  await setTeacherSuggestedTopic({
    studentId: evidenceOnlyId, subject: 'mathematics',
    concept: 'Work through equivalent fractions', strandName: 'Numbers — Fractions',
  })
  const next = await getNextSubject(evidenceOnlyId)
  assert.equal(next.reason, 'teacher_recommendation')
  assert.equal(next.subject, 'mathematics')
  assert.equal(next.subtopic, 'Work through equivalent fractions')
})

test('7. a targeted session still carries its curriculum anchor for such a learner', async () => {
  await setTeacherSuggestedTopic({
    studentId: evidenceOnlyId, subject: 'mathematics',
    concept: 'Proportional reasoning practice', strandName: 'Numbers — Proportional reasoning',
    subStrandId: '00000000-0000-0000-0000-000000000000',
  })
  const ctx = await repos.compass.getStudentLearningContext(evidenceOnlyId)
  const bridge = (ctx?.compass_bridge ?? {}) as Record<string, unknown>
  assert.equal(bridge.subStrandId, '00000000-0000-0000-0000-000000000000',
    'the anchor travels regardless of whether the learner ever saw the Clinic')
})

// ── 8-9. Authorization is untouched ────────────────────────────────────────

test('8+9. authorization is unchanged — an unrelated user is still denied', async () => {
  const owner = await resolveCompassStudentAccess(authUserId, evidenceOnlyId)
  assert.equal(owner.allowed, true, 'the teacher of record still gets in')

  const stranger = await resolveCompassStudentAccess(otherAuthUserId, evidenceOnlyId)
  assert.equal(stranger.allowed, false,
    'G-05 relaxed a PEDAGOGICAL readiness gate — it must not have touched authorization')
})

// ── 11-12. Session mechanics unchanged ─────────────────────────────────────

test('11+12. session create and resume still behave identically without a Clinic row', async () => {
  const created = await getOrCreateSession(evidenceOnlyId, 'mathematics', 'school')
  assert.equal(created.isNew, true)
  const resumed = await getOrCreateSession(evidenceOnlyId, 'mathematics', 'school')
  assert.equal(resumed.isNew, false)
  assert.equal(resumed.sessionId, created.sessionId)
})
