// lib/intelligence/evidenceDomain.integration.test.ts
//
// Full Evidence Domain integration proof, against real (synthetic, cleaned
// up) data — verifying immutability, lifecycle transitions, supersession,
// lineage, audit trail, and projection events all behave per
// docs/architecture/evidence-domain-model.md, not just per this code's own
// assumptions about itself.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/intelligence/evidenceDomain.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { runCsvIngestion } from './runCsvIngestion'
import { persistEvidenceBatch, confirmReview, rejectReview, retractEvidence, eraseEvidence, getPendingReview, getEvidenceAuditTrail, getEvidenceHistoryForLearner } from './evidenceLifecycle'
import { startIngestionRun, getIngestionRun, getIngestionRunLiveStats } from './ingestionRun'
import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from './evidence'
import { asStudentId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_EVIDENCE_DOMAIN_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentIds: string[] = []

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `evidence-domain-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  for (const name of ['Test Learner One', 'Test Learner Two']) {
    const { data: student, error } = await db
      .from('students')
      .insert({ teacher_id: teacherId, name, grade: 8, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
      .select('id')
      .single()
    if (error) throw error
    studentIds.push(student.id)
  }
})

after(async () => {
  // Evidence Domain tables cascade-clean via ingestion_runs -> teacher_id,
  // but FKs don't cascade-delete here by design (evidence is permanent) —
  // so we delete test rows explicitly, in dependency order.
  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId)
  const runIds = (runs ?? []).map(r => r.id)
  if (runIds.length > 0) {
    const { data: ev } = await db.from('learner_evidence').select('id').in('ingestion_run_id', runIds)
    const evidenceIds = (ev ?? []).map(e => e.id)
    if (evidenceIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      // Clear self-referencing FKs before deleting the rows themselves.
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('ingestion_runs').delete().in('id', runIds)
  }
  // Confirmed-evidence recomputation can indirectly persist a
  // learner_projections row for these fixture students (H1D-3 finding —
  // learner_projections.learner_id -> students.id has no ON DELETE CASCADE,
  // so leaving this out silently fails the students delete for exactly the
  // rows that got a projection, without the client code surfacing an error).
  await db.from('learner_projections').delete().in('learner_id', studentIds)
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(authUserId)
  console.log('[cleanup] synthetic evidence-domain fixtures removed')
})

// ── Batch creation + lineage ─────────────────────────────────────────────────

test('an ingestion run is created, tracked, and completed with accurate stats', async () => {
  const csv = [
    'name,external_id,Mathematics',
    'Test Learner One,,85',
    'Nonexistent Learner,,90',
  ].join('\n')

  const result = await runCsvIngestion({
    fileContents: csv, teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 1, assessmentType: 'cat',
  })

  const run = await getIngestionRun(result.ingestionRunId)
  assert.ok(run)
  assert.equal(run!.status, 'completed')
  assert.equal(run!.source, 'csv_export')
  assert.equal(run!.record_count, 2)
  assert.ok(run!.processing_duration_ms !== null && run!.processing_duration_ms >= 0)

  // Lineage: every inserted evidence row references this exact run.
  for (const row of result.inserted) assert.equal(row.ingestion_run_id, result.ingestionRunId)
})

// ── Pending review persistence ───────────────────────────────────────────────

test('unresolved-identity evidence persists to pending_review and is queryable later, not lost', async () => {
  const csv = ['name,Mathematics', 'Totally Unknown Person,70'].join('\n')
  const result = await runCsvIngestion({
    fileContents: csv, teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 1, assessmentType: 'cat',
  })
  assert.equal(result.confirmedCount, 0)
  assert.equal(result.pendingReviewCount, 1)

  // Simulate "later, without re-importing the file" — a fresh query.
  const pending = await getPendingReview({ ingestionRunId: result.ingestionRunId })
  assert.equal(pending.length, 1)
  assert.equal(pending[0].extracted_name, 'Totally Unknown Person')
  assert.equal(pending[0].lifecycle_state, 'pending_review')
})

// ── Immutability ──────────────────────────────────────────────────────────────

test('factual columns cannot be modified after creation — the database rejects it', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Test Learner One', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 80, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:immutability', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const row = inserted[0]

  await assert.rejects(
    async () => { await db.from('learner_evidence').update({ score: 999 }).eq('id', row.id).throwOnError() },
    /immutable/i,
    'expected the immutability trigger to reject a factual-column update',
  )
})

// ── Lifecycle transition validity ────────────────────────────────────────────

test('an invalid lifecycle transition is rejected by the database', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Test Learner One', extractedExternalId: null,
    subject: 'english', rawSubject: 'English', score: 70, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 2, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:transition', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const row = inserted[0]
  assert.equal(row.lifecycle_state, 'auto_confirmed')

  // auto_confirmed -> reviewed_confirmed is not a domain-valid transition (§2).
  await assert.rejects(
    async () => { await db.from('learner_evidence').update({ lifecycle_state: 'reviewed_confirmed' }).eq('id', row.id).throwOnError() },
    /Invalid evidence lifecycle transition/i,
  )
})

// ── Supersession / version chains ────────────────────────────────────────────

test('a keyed correction supersedes its prior record, which is preserved, not deleted', async () => {
  // Phase E4 rewrote this test's PREMISE, deliberately.
  //
  // It previously proved supersession by re-running a CSV import twice: two
  // csv_export rows sharing learner/subject/type/year/term superseded each
  // other under the legacy six-field claim key. After E4 that no longer
  // happens, because supersession now follows producer-declared ARTIFACT
  // identity and the dev-only `csv_export` path declares none (E3.5 §21 —
  // it has no product caller, so nothing real regresses).
  //
  // So the supersession MACHINERY is now proven the way it is actually
  // reached: through a correction key. The assertions about preservation,
  // chain linkage and queryable history are unchanged.
  const { persistEvidenceBatch } = await import('./evidenceLifecycle')
  const { classAssessmentResultKey } = await import('./correctionKey')

  const correctionKey = classAssessmentResultKey({
    assessmentId: '9f9f9f9f-0000-4000-8000-00000000e4e4',
    studentId: studentIds[1],
    canonicalSubject: 'geography',
    source: 'teacher_upload',
  })

  const base = {
    learnerId: studentIds[1], extractedName: 'Test Learner Two', extractedExternalId: null,
    subject: 'geography', rawSubject: 'geo', cbcLevel: 2 as const,
    assessmentType: 'cat' as const, academicYear: 2026, term: 3,
    evidenceSource: 'teacher_upload' as const, trustTier: 3 as const, evidenceConfidence: 100,
    extractionMethod: 'e4_supersession_test', reviewStatus: 'auto_confirmed' as const,
    importedAt: new Date().toISOString(), issues: [], subStrandId: null, correctionKey,
  }

  const run1 = await startIngestionRun({ source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const first = await persistEvidenceBatch([{ ...base, score: 60, rawInputRef: 'e4:original' }], run1.id)
  const originalId = first.inserted[0].id

  const run2 = await startIngestionRun({ source: 'teacher_upload', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const second = await persistEvidenceBatch([{ ...base, score: 88, rawInputRef: 'e4:corrected' }], run2.id)
  const correctedId = second.inserted[0].id

  const original = await repos.evidence.findEvidenceById(originalId)
  const corrected = await repos.evidence.findEvidenceById(correctedId)

  assert.equal(original?.lifecycle_state, 'superseded', 'original record must be marked superseded, not deleted')
  assert.equal(original?.score, 60, 'original record content must be unchanged — history is preserved')
  assert.equal(original?.superseded_by, correctedId)
  assert.equal(corrected?.supersedes, originalId)
  assert.equal(corrected?.score, 88)

  // The correction lookup must return the corrected record, not the superseded one.
  const current = await repos.evidence.findCurrentEvidenceForCorrection({
    learnerId: studentIds[1], evidenceSource: 'teacher_upload', correctionKey,
  })
  assert.equal(current?.id, correctedId)

  // Full history remains queryable — nothing was lost.
  const history = await getEvidenceHistoryForLearner(studentIds[1])
  const historyIds = history.map(h => h.id)
  assert.ok(historyIds.includes(originalId) && historyIds.includes(correctedId))
})

test('E4: an UNKEYED producer re-import now coexists instead of superseding', async () => {
  // The other half of the premise change above. Two csv_export imports of
  // the same learner/subject/term used to supersede; they are now two
  // independent observations, because csv_export declares no artifact.
  const mk = (score: string) => runCsvIngestion({
    fileContents: ['name,external_id,geo', `Coexist Learner,,${score}`].join('\n'),
    teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 2, assessmentType: 'cat',
  })

  const first = await mk('55')
  const second = await mk('70')
  const a = await repos.evidence.findEvidenceById(first.inserted[0].id)
  const b = await repos.evidence.findEvidenceById(second.inserted[0].id)

  assert.equal(a?.correction_key, null, 'csv_export declares no correctable artifact')
  assert.equal(b?.supersedes, null, 'so the second import corrects nothing')
  assert.notEqual(a?.lifecycle_state, 'superseded', 'and the first observation survives')
})

// ── Audit metadata ───────────────────────────────────────────────────────────

test('every lifecycle event is captured in the audit trail, in order', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: null, extractedName: 'Audit Test Person', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 40, cbcLevel: 2,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 30, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'pending_review', rawInputRef: 'test:audit', importedAt: new Date().toISOString(),
    issues: ['identity unresolved'],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  await confirmReview(evidenceId, authUserId, 'Manually verified against the register')

  const trail = await getEvidenceAuditTrail(evidenceId)
  const eventTypes = trail.map(t => t.event_type)
  assert.deepEqual(eventTypes, ['created', 'routed_to_review', 'reviewed_confirmed'])
  assert.equal(trail[2].actor, authUserId)
  assert.equal(trail[2].reason, 'Manually verified against the register')
})

// ── Review lifecycle: reject ─────────────────────────────────────────────────

test('rejected evidence is preserved with reviewer and reason, and produces no projection event', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: null, extractedName: 'Reject Test Person', extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 55, cbcLevel: 2,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 20, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'pending_review', rawInputRef: 'test:reject', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  const rejected = await rejectReview(evidenceId, authUserId, 'No such learner in this class')
  assert.equal(rejected.lifecycle_state, 'reviewed_rejected')

  const stillThere = await repos.evidence.findEvidenceById(evidenceId)
  assert.ok(stillThere, 'rejected evidence must not be deleted')
  assert.equal(stillThere!.review_reason, 'No such learner in this class')
})

// ── Retraction + projection events ───────────────────────────────────────────

test('retracting confirmed evidence emits a projection event and preserves the record', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Test Learner One', extractedExternalId: null,
    subject: 'kiswahili', rawSubject: 'Kiswahili', score: 65, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:retract', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  const retracted = await retractEvidence(evidenceId, authUserId, 'Data entry error reported by the school')
  assert.equal(retracted.lifecycle_state, 'retracted')
  assert.equal(retracted.retraction_reason, 'Data entry error reported by the school')

  const { data: events, error } = await db
    .from('evidence_projection_events')
    .select('event_type, processed_at')
    .eq('evidence_id', evidenceId)
  if (error) throw error
  assert.ok(events!.some(e => e.event_type === 'evidence_retracted'))
  assert.ok(events!.every(e => e.processed_at === null), 'projection events are hooks only — nothing consumes them yet in this phase')
})

// ── Repository correctness / batch stats ─────────────────────────────────────

test('live batch stats reflect lifecycle state accurately, distinct from the frozen completion snapshot', async () => {
  const csv = [
    'name,external_id,Mathematics',
    'Test Learner One,,80',
    'Unresolved Person,,80',
  ].join('\n')
  const result = await runCsvIngestion({
    fileContents: csv, teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 2, assessmentType: 'cat',
  })

  const liveStats = await getIngestionRunLiveStats(result.ingestionRunId)
  assert.equal(liveStats.auto_confirmed, 1)
  assert.equal(liveStats.pending_review, 1)

  // Now confirm the pending one via review — live stats must change; the frozen run snapshot must not.
  const pendingRow = result.inserted.find(r => r.lifecycle_state === 'pending_review')!
  await confirmReview(pendingRow.id, authUserId, 'Confirmed manually')

  const liveStatsAfter = await getIngestionRunLiveStats(result.ingestionRunId)
  assert.equal(liveStatsAfter.auto_confirmed, 1)
  assert.equal(liveStatsAfter.reviewed_confirmed, 1)
  assert.equal(liveStatsAfter.pending_review ?? 0, 0)

  const runSnapshot = await getIngestionRun(result.ingestionRunId)
  assert.equal(runSnapshot!.pending_review_count, 1, 'the frozen at-completion snapshot must not retroactively change')
})

// ── Phase -1: erasure lifecycle (learner-record-layer-signoff.md) ───────────

test('erasure purges identifying fields, preserves the row, and is reachable from any non-erased state', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Erasure Test Person', extractedExternalId: 'ext-123',
    subject: 'science', rawSubject: 'Science', score: 72, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:erasure', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  const erased = await eraseEvidence(evidenceId, authUserId, 'Right-to-erasure request, ref #TEST-1')
  assert.equal(erased.lifecycle_state, 'erased')
  assert.equal(erased.erased_by, authUserId)
  assert.equal(erased.erasure_reason, 'Right-to-erasure request, ref #TEST-1')
  assert.notEqual(erased.extracted_name, 'Erasure Test Person', 'identifying name must be purged')
  assert.equal(erased.extracted_external_id, null)
  assert.equal(erased.score, null)

  // The row itself, and its non-PII facts, survive — this is erasure, not deletion.
  const stillThere = await repos.evidence.findEvidenceById(evidenceId)
  assert.ok(stillThere, 'erased evidence must not be deleted')
  assert.equal(stillThere!.subject, 'science', 'non-identifying facts are untouched by erasure')
  assert.equal(stillThere!.learner_id, studentIds[0], 'erasure purges identifying text, not the learner link itself')

  // Erased evidence must fall out of what Projection would read as confirmed,
  // and must emit a projection event so any existing computed state gets recomputed.
  const confirmed = await repos.evidence.findConfirmedEvidenceForLearner(asStudentId(studentIds[0]))
  assert.ok(!confirmed.some(r => r.id === evidenceId), 'erased evidence must not count as confirmed')
  const { data: events, error } = await db
    .from('evidence_projection_events')
    .select('event_type')
    .eq('evidence_id', evidenceId)
  if (error) throw error
  assert.ok(events!.some(e => e.event_type === 'evidence_retracted'))

  // The audit trail records the erasure as its own event, not silently.
  const trail = await getEvidenceAuditTrail(evidenceId)
  assert.ok(trail.some(t => t.event_type === 'erased' && t.reason === 'Right-to-erasure request, ref #TEST-1'))
})

test('erasing an already-erased row is rejected, and erasure cannot be used to change other facts', async () => {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Double Erasure Test', extractedExternalId: null,
    subject: 'social studies', rawSubject: 'Social Studies', score: 60, cbcLevel: 2,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 90, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:double-erasure', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  // ── First erasure: must work exactly as it always has ─────────────────
  await eraseEvidence(evidenceId, authUserId, 'First request')

  const { data: afterFirst } = await db.from('learner_evidence')
    .select('lifecycle_state, extracted_name, extracted_external_id, score, erased_by, erased_at, erasure_reason')
    .eq('id', evidenceId).single()

  assert.equal(afterFirst!.lifecycle_state, 'erased')
  assert.equal(afterFirst!.extracted_name, '[erased]', 'identifying fields are still purged')
  assert.equal(afterFirst!.extracted_external_id, null)
  assert.equal(afterFirst!.score, null)
  assert.equal(afterFirst!.erased_by, authUserId)
  assert.equal(afterFirst!.erasure_reason, 'First request')
  assert.ok(afterFirst!.erased_at)

  // ── Second erasure by a DIFFERENT actor ───────────────────────────────
  //
  // A different actor is essential. Re-erasing as the same user would leave
  // `erased_by` coincidentally unchanged, so the assertion below would pass
  // even against the broken function — the defect this test exists to catch
  // would slip through. Actor B makes an overwrite unmistakable.
  const { data: actorB, error: actorBErr } = await db.auth.admin.createUser({
    email: `${SYNTHETIC_MARKER.toLowerCase()}-erasure-actor-b-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 12)}`,
    email_confirm: true,
  })
  if (actorBErr) throw actorBErr
  const actorBId = actorB.user.id

  try {
    await assert.rejects(
      async () => { await eraseEvidence(evidenceId, actorBId, 'Second request') },
      /already erased/i,
      'erasure is terminal — a second erase request must be rejected',
    )

    // THE ACTUAL INVARIANT. Rejection alone is not enough: a guard that
    // raised only AFTER the attribution had been overwritten would satisfy
    // the assertion above while still destroying the audit answer to
    // "who erased this, when, and why".
    const { data: afterSecond } = await db.from('learner_evidence')
      .select('lifecycle_state, erased_by, erased_at, erasure_reason')
      .eq('id', evidenceId).single()

    assert.equal(afterSecond!.erased_by, afterFirst!.erased_by,
      'erased_by must survive a second erase attempt unchanged')
    assert.equal(afterSecond!.erased_at, afterFirst!.erased_at,
      'erased_at must survive a second erase attempt unchanged')
    assert.equal(afterSecond!.erasure_reason, afterFirst!.erasure_reason,
      'erasure_reason must survive a second erase attempt unchanged')
    assert.notEqual(afterSecond!.erased_by, actorBId,
      'the second actor must not have taken credit for the first actor\'s erasure')
    assert.equal(afterSecond!.lifecycle_state, 'erased')
  } finally {
    await db.auth.admin.deleteUser(actorBId)
  }

  // The immutability trigger's erasure exception is scoped to exactly
  // extracted_name/extracted_external_id/score — it must not become a
  // side door for changing subject, cbc_level, or any other fact.
  await assert.rejects(
    async () => { await db.from('learner_evidence').update({ subject: 'tampered' }).eq('id', evidenceId).throwOnError() },
    /immutable/i,
    'erasure must not widen the immutability exception to non-PII fact columns',
  )
})

test('an unrelated update to an already-erased row is NOT newly rejected', async () => {
  // The attribution guard must be scoped to erasure attribution, not
  // "any update of an erased row". This pins that scoping: without it, a
  // future tightening of the guard would silently freeze erased rows
  // against every other legitimate write, and nothing would catch it.
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const evidence: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Erased Row Unrelated Update', extractedExternalId: null,
    subject: 'social studies', rawSubject: 'Social Studies', score: 61, cbcLevel: 2,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 90, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:erased-unrelated-update', importedAt: new Date().toISOString(), issues: [],
  }
  const { inserted } = await persistEvidenceBatch([evidence], run.id)
  const evidenceId = inserted[0].id

  await eraseEvidence(evidenceId, authUserId, 'Erasure before unrelated update')

  // verification_state is not a fact column and not erasure attribution —
  // updating it on an erased row must behave exactly as it did before.
  const { error } = await db.from('learner_evidence')
    .update({ verification_state: 'contradicted' })
    .eq('id', evidenceId)
  assert.equal(error, null, 'a non-attribution update to an erased row must still be allowed')

  const { data: row } = await db.from('learner_evidence')
    .select('verification_state, erased_by, erasure_reason')
    .eq('id', evidenceId).single()
  assert.equal(row!.verification_state, 'contradicted')
  assert.equal(row!.erased_by, authUserId, 'and it must not disturb the erasure attribution')
  assert.equal(row!.erasure_reason, 'Erasure before unrelated update')
})

// ── Phase -1: school_id / curriculum_version_id (additive, optional) ────────

test('school_id and curriculum_version_id round-trip when a producer supplies them, and default to null otherwise', async () => {
  const { data: curriculumVersion, error: cvError } = await db
    .from('curriculum_versions')
    .select('id')
    .eq('code', 'ke-cbc-2017')
    .single()
  if (cvError) throw cvError

  const { data: school, error: schoolError } = await db
    .from('schools')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (schoolError) throw schoolError

  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: authUserId, teacherId, institution: SYNTHETIC_MARKER })
  const withContext: LearnerEvidence = {
    learnerId: studentIds[0], extractedName: 'Test Learner One', extractedExternalId: null,
    subject: 'agriculture', rawSubject: 'Agriculture', score: 77, cbcLevel: 3,
    assessmentType: 'cat', academicYear: 2026, term: 1, evidenceSource: 'csv_export',
    trustTier: 2, evidenceConfidence: 95, extractionMethod: 'csv_parser_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test:curriculum-context', importedAt: new Date().toISOString(), issues: [],
    curriculumVersionId: curriculumVersion.id,
    schoolId: school?.id ?? null,
  }
  const withoutContext: LearnerEvidence = {
    ...withContext, subject: 'pre-technical studies', rawSubject: 'Pre-Technical Studies',
    rawInputRef: 'test:no-curriculum-context', curriculumVersionId: undefined, schoolId: undefined,
  }
  const { inserted } = await persistEvidenceBatch([withContext, withoutContext], run.id)

  const withRow = inserted.find(r => r.subject === 'agriculture')!
  const withoutRow = inserted.find(r => r.subject === 'pre-technical studies')!
  assert.equal(withRow.curriculum_version_id, curriculumVersion.id)
  if (school) assert.equal(withRow.school_id, school.id)
  assert.equal(withoutRow.curriculum_version_id, null, 'omitting curriculum context must default to null, never a guessed value')
  assert.equal(withoutRow.school_id, null, 'omitting school context must default to null, never a guessed value')
})
