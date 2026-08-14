// lib/compass/compassClaimIdentity.integration.test.ts
//
// Phase 1.5 — proves Compass engagement and Compass mastery are two
// DISTINCT educational claims, against real (synthetic, cleaned-up) rows.
//
// The defect this locks down: both claims were built with the same
// learner/subject/assessmentType/year/term, so `claimKey()` treated them as
// two versions of one claim. `persistEvidenceBatch` therefore inserted the
// mastery claim with `supersedes` pointing at the engagement claim from its
// own session, and confirming mastery attempted
// `pending_review -> superseded` on engagement — which the lifecycle
// trigger correctly rejected. A teacher could not confirm a Compass mastery
// claim at all unless engagement happened to be confirmed first.
//
// The fix is to claim IDENTITY, not to the lifecycle guard: `compass_session`
// is exempt from claim-key supersession, the same narrow carve-out
// `teacher_remark` already takes. The lifecycle rules are untouched, and
// this file asserts that they still bite everywhere else.
//
// ⚠️ Creates one real (throwaway) auth.users account plus legacy
// teacher/student rows and evidence, all deleted in `after()`, including on
// failure.
//
// Run: npx tsx --env-file=.env.local --test lib/compass/compassClaimIdentity.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import {
  persistEvidenceBatch, confirmReview, rejectReview, retractEvidence,
} from '@/lib/intelligence/evidenceLifecycle'
import { EVIDENCE_SOURCE_TRUST_TIER, type LearnerEvidence } from '@/lib/intelligence/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { recordCompassSessionEvidence } from './evidence'
import { ENGAGEMENT_EXTRACTION_METHOD, MASTERY_EXTRACTION_METHOD } from './evidenceClaimTypes'
import { asStudentId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_P15_CLAIM_IDENTITY_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string          // the main Compass learner
let otherLearnerId: string     // non-Compass supersession control
const extraRunIds: string[] = []

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function mkStudent(name: string): Promise<string> {
  const { data } = await retryAsync(async () => {
    const r = await db.from('students')
      .insert({ name, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: teacherId })
      .select('id').single()
    if (r.error) throw r.error
    return r
  })
  return data!.id
}

async function evidenceFor(learnerId: string) {
  const { data } = await db.from('learner_evidence')
    .select('id, subject, cbc_level, evidence_source, extraction_method, lifecycle_state, supersedes, superseded_by, raw_input_ref, assessment_type, academic_year, term')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: true })
  return data ?? []
}

const compassRows = async (learnerId = studentId) =>
  (await evidenceFor(learnerId)).filter(r => r.evidence_source === 'compass_session')

async function runOneSession(overrides: {
  sessionId?: string
  subject?: string
  genuineProgress?: boolean
  masteredConcepts?: string[]
  endingLevel?: number | null
  term?: number
  abandoned?: boolean
} = {}) {
  await recordCompassSessionEvidence({
    studentId,
    initiatedBy: authUserId,
    sessionId: overrides.sessionId ?? randomUUID(),
    subject: overrides.subject ?? 'mathematics',
    sessionAbandoned: overrides.abandoned ?? false,
    exchangeCount: 8,
    durationSeconds: 720,
    genuineProgress: overrides.genuineProgress ?? true,
    masteredConcepts: overrides.masteredConcepts ?? ['equivalent fractions'],
    endingLevel: overrides.endingLevel === undefined ? 3 : overrides.endingLevel,
    academicYear: 2026,
    term: overrides.term ?? 1,
  })
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

  studentId = await mkStudent('Compass Claim Identity Test')
  otherLearnerId = await mkStudent('Supersession Control Test')
})

after(async () => {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }

  for (const id of [studentId, otherLearnerId].filter(Boolean)) {
    const { data: rows } = await db.from('learner_evidence').select('id, ingestion_run_id').eq('learner_id', id)
    const evidenceIds = (rows ?? []).map(r => r.id)
    const runIds = [...new Set((rows ?? []).map(r => r.ingestion_run_id as string).filter(Boolean))]
    if (evidenceIds.length) {
      await safely(() => db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds))
      await safely(() => db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds))
      // Break supersession links before delete so FK ordering cannot block cleanup.
      await safely(() => db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds))
      await safely(() => db.from('learner_evidence').delete().in('id', evidenceIds))
    }
    await safely(() => db.from('learner_projections').delete().eq('learner_id', id))
    await safely(() => db.from('students').delete().eq('id', id))
    if (runIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', runIds))
  }
  if (extraRunIds.length) await safely(() => db.from('ingestion_runs').delete().in('id', extraRunIds))
  if (teacherId) await safely(() => db.from('teachers').delete().eq('id', teacherId))
  if (authUserId) await safely(() => db.auth.admin.deleteUser(authUserId))
})

// ── 1. Both claims coexist from one session ────────────────────────────────

test('1. one Compass session produces an engagement claim AND a mastery claim simultaneously', async () => {
  await runOneSession({ sessionId: 'session-one' })

  const rows = await compassRows()
  const engagement = rows.filter(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)
  const mastery = rows.filter(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)

  assert.equal(engagement.length, 1, 'exactly one engagement claim')
  assert.equal(mastery.length, 1, 'exactly one mastery claim')
  assert.equal(engagement[0].cbc_level, null, 'engagement is behavioural — it makes no academic claim')
  assert.equal(mastery[0].cbc_level, 3, 'mastery carries the session\'s ending level')
})

// ── 2. Neither supersedes the other ────────────────────────────────────────

test('2. engagement and mastery do not supersede each other', async () => {
  const rows = await compassRows()
  for (const row of rows) {
    assert.equal(row.supersedes, null,
      `${row.extraction_method} must carry no supersession pointer — these are two claims, not two versions of one`)
    assert.equal(row.superseded_by, null)
    assert.notEqual(row.lifecycle_state, 'superseded')
  }
})

test('2b. both claims remain independently traceable to the SAME Compass session', async () => {
  const rows = await compassRows()
  const engagement = rows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!
  const mastery = rows.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!

  assert.ok(engagement.raw_input_ref.startsWith('compass_session:session-one:'))
  assert.ok(mastery.raw_input_ref.startsWith('compass_session:session-one:'))
  assert.notEqual(engagement.raw_input_ref, mastery.raw_input_ref,
    'same session, distinct provenance — traceable together without being the same claim')
  assert.notEqual(engagement.extraction_method, mastery.extraction_method)
})

// ── 3-4. Lifecycle at creation is unchanged ────────────────────────────────

test('3. engagement retains its intended conservative auto-confirm behaviour', async () => {
  const { COMPASS_AUTO_CONFIRM_CONFIG } = await import('@/lib/config/api')
  const rows = await compassRows()
  const engagement = rows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!

  if (COMPASS_AUTO_CONFIRM_CONFIG.isConfigured()) {
    assert.equal(engagement.lifecycle_state, 'reviewed_confirmed',
      'with the system account configured, engagement-only claims are conservatively promoted')
  } else {
    assert.equal(engagement.lifecycle_state, 'pending_review',
      'without the system account, the safe default is "nothing auto-confirms" — degraded, never bypassed')
  }
})

test('4. mastery is pending_review regardless of configuration', async () => {
  const rows = await compassRows()
  const mastery = rows.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!
  assert.equal(mastery.lifecycle_state, 'pending_review',
    'an AI mastery judgement always requires a real teacher review')
})

// ── 5. THE FIX ─────────────────────────────────────────────────────────────

test('5. a teacher can confirm mastery while engagement is still pending_review', async () => {
  const rows = await compassRows()
  const engagement = rows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!
  const mastery = rows.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!

  // The precondition that used to make this impossible. If this environment
  // has auto-confirm configured the precondition cannot be staged, and the
  // remaining assertions still prove the claims are independent.
  const engagementWasPending = engagement.lifecycle_state === 'pending_review'

  const confirmed = await confirmReview(mastery.id, authUserId, `${SYNTHETIC_MARKER}: teacher confirms observed progress`)
  assert.equal(confirmed.lifecycle_state, 'reviewed_confirmed',
    'before Phase 1.5 this threw "Invalid evidence lifecycle transition pending_review -> superseded"')

  if (engagementWasPending) {
    const after = (await compassRows()).find(r => r.id === engagement.id)!
    assert.equal(after.lifecycle_state, 'pending_review',
      'and engagement is untouched — it was never part of the mastery transition')
  }
})

test('6. confirming mastery did not alter the engagement claim at all', async () => {
  const rows = await compassRows()
  const engagement = rows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!
  assert.equal(engagement.supersedes, null)
  assert.equal(engagement.superseded_by, null)
  assert.notEqual(engagement.lifecycle_state, 'superseded')
})

test('7. confirming engagement does not alter the mastery claim', async () => {
  const rows = await compassRows()
  const engagement = rows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!
  const masteryBefore = rows.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!

  if (engagement.lifecycle_state === 'pending_review') {
    await confirmReview(engagement.id, authUserId, `${SYNTHETIC_MARKER}: teacher confirms the session happened`)
  }

  const masteryAfter = (await compassRows()).find(r => r.id === masteryBefore.id)!
  assert.equal(masteryAfter.lifecycle_state, masteryBefore.lifecycle_state, 'mastery is unaffected')
  assert.equal(masteryAfter.superseded_by, null, 'and was not superseded by the engagement confirmation')
})

// ── 8-9. Rejection and retraction ──────────────────────────────────────────

test('8. rejecting a mastery claim leaves its engagement claim intact', async () => {
  await runOneSession({ sessionId: 'session-two', subject: 'english', term: 2 })

  const englishRows = (await compassRows()).filter(r => r.subject === 'english')
  const mastery = englishRows.find(r => r.extraction_method === MASTERY_EXTRACTION_METHOD)!
  const engagement = englishRows.find(r => r.extraction_method === ENGAGEMENT_EXTRACTION_METHOD)!

  const rejected = await rejectReview(mastery.id, authUserId, `${SYNTHETIC_MARKER}: not corroborated in class`)
  assert.equal(rejected.lifecycle_state, 'reviewed_rejected')

  const engagementAfter = (await compassRows()).find(r => r.id === engagement.id)!
  assert.ok(engagementAfter, 'the engagement claim still exists — rejection is not deletion')
  assert.notEqual(engagementAfter.lifecycle_state, 'reviewed_rejected',
    '"they did not demonstrate mastery" does not mean "they did not attend"')
})

test('9. retracting a confirmed mastery claim obeys the existing lifecycle rules', async () => {
  const rows = await compassRows()
  const confirmedMastery = rows.find(
    r => r.extraction_method === MASTERY_EXTRACTION_METHOD && r.lifecycle_state === 'reviewed_confirmed',
  )!
  assert.ok(confirmedMastery, 'test 5 left a confirmed mastery claim to retract')

  const retracted = await retractEvidence(confirmedMastery.id, authUserId, `${SYNTHETIC_MARKER}: retraction test`)
  assert.equal(retracted.lifecycle_state, 'retracted', 'reviewed_confirmed -> retracted is legal and unchanged')

  // And an illegal transition is still illegal — the guard was not weakened.
  await assert.rejects(
    () => confirmReview(confirmedMastery.id, authUserId, 'retracted evidence must not be confirmable'),
    /Invalid evidence lifecycle transition/,
    'retracted -> reviewed_confirmed must still be rejected by the trigger',
  )

  const projection = await recomputeLearnerProjection(studentId)
  const supporting = projection.academic?.supportingEvidenceIds ?? []
  assert.ok(!supporting.includes(confirmedMastery.id), 'retracted evidence leaves Projection')
})

// ── 10-11. Nothing else changed ────────────────────────────────────────────

test('10. [E4-UPDATED] non-Compass corrections still supersede — now via artifact identity', async () => {
  // Phase 1.5 wrote this control asserting that two exam rows sharing the
  // six-field claim key superseded. Phase E4 replaced that rule: a
  // correction is now declared by the producer, not inferred from
  // curriculum similarity. So the control expresses a re-grade the way a
  // re-grade is actually expressed — one artifact, two values.
  const { classAssessmentResultKey } = await import('@/lib/intelligence/correctionKey')
  const examKey = classAssessmentResultKey({
    assessmentId: 'e4e4e4e4-0000-4000-8000-0000000000aa',
    studentId: otherLearnerId, canonicalSubject: 'mathematics', source: 'teacher_upload',
  })
  const mkExam = async (cbcLevel: 1 | 2 | 3 | 4) => {
    const { id: runId } = await repos.evidence.createIngestionRun({
      source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: null,
    })
    extraRunIds.push(runId)
    const evidence: LearnerEvidence = {
      learnerId: otherLearnerId,
      extractedName: '', extractedExternalId: null,
      subject: 'mathematics', rawSubject: 'mathematics',
      score: null, cbcLevel,
      assessmentType: 'term_exam', academicYear: 2026, term: 1,
      evidenceSource: 'teacher_upload',
      trustTier: EVIDENCE_SOURCE_TRUST_TIER.teacher_upload,
      evidenceConfidence: 100,
      extractionMethod: `${SYNTHETIC_MARKER}_exam`,
      reviewStatus: 'auto_confirmed',
      rawInputRef: `${SYNTHETIC_MARKER}:exam:${cbcLevel}`,
      importedAt: new Date().toISOString(),
      issues: [],
      correctionKey: examKey,
    }
    const r = await persistEvidenceBatch([evidence], runId)
    return r.inserted[0]
  }

  const first = await mkExam(2)
  const corrected = await mkExam(3)

  assert.equal(corrected.supersedes, first.id, 'a corrected mark still supersedes the original — unchanged')
  const rows = await evidenceFor(otherLearnerId)
  assert.equal(rows.find(r => r.id === first.id)!.lifecycle_state, 'superseded')

  const projection = await recomputeLearnerProjection(otherLearnerId)
  assert.equal(projection.academic?.value.bySubject.mathematics?.latestLevel, 3,
    'the correction, not the original, is what Projection reads')
})

test('11. the teacher_remark exemption is unchanged', async () => {
  const source = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('../intelligence/evidenceLifecycle.ts', import.meta.url), 'utf8'))
  assert.ok(source.includes("if (e.evidenceSource === 'teacher_remark') return null"),
    'the pre-existing teacher_remark carve-out must remain exactly as it was')
  assert.ok(source.includes("if (e.evidenceSource === 'compass_session') return null"),
    'and the Compass carve-out is expressed the same way, beside it')
})

test('11b. [E4-UPDATED] the Compass exemption still holds, and keyed non-Compass producers still correct', async () => {
  // Post-E4 the Compass exemption is belt-and-braces: Compass declares no
  // correction_key either, so it would coexist regardless. The exemption is
  // deliberately retained (E4 §9) rather than removed as redundant.
  const { data: nonCompass } = await db.from('learner_evidence')
    .select('evidence_source, supersedes')
    .eq('learner_id', otherLearnerId)
    .not('supersedes', 'is', null)
  assert.ok((nonCompass ?? []).length > 0,
    'a keyed non-Compass producer still produces supersession chains (test 10\'s exam correction)')
  assert.ok((nonCompass ?? []).every(r => r.evidence_source !== 'compass_session'))

  const { data: compassChains } = await db.from('learner_evidence')
    .select('id').eq('learner_id', studentId).eq('evidence_source', 'compass_session')
    .not('supersedes', 'is', null)
  assert.equal((compassChains ?? []).length, 0, 'Compass evidence never carries a supersession pointer')
})

// ── 12. Two sessions stay two claims ───────────────────────────────────────

test('12. two Compass sessions do not collapse into one claim', async () => {
  const before = (await compassRows()).filter(r => r.subject === 'kiswahili').length
  assert.equal(before, 0)

  await runOneSession({ sessionId: 'session-three', subject: 'kiswahili', term: 3, masteredConcepts: ['ngeli'] })
  await runOneSession({ sessionId: 'session-four', subject: 'kiswahili', term: 3, masteredConcepts: ['sarufi'] })

  const kiswahili = (await compassRows()).filter(r => r.subject === 'kiswahili')
  assert.equal(kiswahili.length, 4, 'two sessions x two claims = four independent rows')

  for (const row of kiswahili) {
    assert.equal(row.supersedes, null, 'Thursday\'s session does not correct Tuesday\'s — both are permanently true')
    assert.notEqual(row.lifecycle_state, 'superseded')
  }

  // They genuinely share the claim-key fields that used to collide, which is
  // what makes this the real regression test rather than a coincidence.
  const keys = new Set(kiswahili.map(r => `${r.subject}:${r.assessment_type}:${r.academic_year}:${r.term}`))
  assert.equal(keys.size, 1, 'all four rows share the old claim key and are nonetheless kept distinct')
})

test('12b. the Behaviour Projector counts every session, not just the newest', async () => {
  // Under the old behaviour each session superseded the last, so the
  // observation count silently collapsed toward one.
  const confirmed = await repos.evidence.findConfirmedEvidenceForLearner(asStudentId(studentId))
  const confirmedCompass = confirmed.filter(r => r.evidence_source === 'compass_session')

  const projection = await recomputeLearnerProjection(studentId)
  if (confirmedCompass.length === 0) {
    assert.equal(projection.behaviour, null, 'no confirmed Compass evidence yet — a null projection is the honest answer')
    return
  }
  const value = projection.behaviour!.value as { observationCount: number; distinctSources: string[] }
  assert.equal(value.observationCount, confirmedCompass.length,
    'every confirmed Compass observation is counted — none was silently superseded away')
  assert.ok(value.distinctSources.includes('compass_session'))
})
