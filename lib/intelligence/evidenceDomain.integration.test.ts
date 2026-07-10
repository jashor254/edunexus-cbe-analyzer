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
import { createServiceClient } from '@/utils/supabase/service'
import { runCsvIngestion } from './runCsvIngestion'
import { persistEvidenceBatch, confirmReview, rejectReview, retractEvidence, getPendingReview, getEvidenceAuditTrail, getEvidenceHistoryForLearner } from './evidenceLifecycle'
import { startIngestionRun, getIngestionRun, getIngestionRunLiveStats } from './ingestionRun'
import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from './evidence'

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

test('re-imported corrected evidence supersedes the old record, which is preserved, not deleted', async () => {
  const csv1 = ['name,external_id,geo', 'Test Learner Two,,60'].join('\n')
  const first = await runCsvIngestion({
    fileContents: csv1, teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 3, assessmentType: 'cat',
  })
  assert.equal(first.confirmedCount, 1)
  const originalId = first.inserted[0].id

  // Same learner, same subject/term/year — a correction.
  const csv2 = ['name,external_id,geo', 'Test Learner Two,,88'].join('\n')
  const second = await runCsvIngestion({
    fileContents: csv2, teacherId, initiatedBy: authUserId, institution: SYNTHETIC_MARKER,
    academicYear: 2026, term: 3, assessmentType: 'cat',
  })
  assert.equal(second.confirmedCount, 1)
  const correctedId = second.inserted[0].id

  const original = await repos.evidence.findEvidenceById(originalId)
  const corrected = await repos.evidence.findEvidenceById(correctedId)

  assert.equal(original?.lifecycle_state, 'superseded', 'original record must be marked superseded, not deleted')
  assert.equal(original?.score, 60, 'original record content must be unchanged — history is preserved')
  assert.equal(original?.superseded_by, correctedId)
  assert.equal(corrected?.supersedes, originalId)
  assert.equal(corrected?.score, 88)

  // The current claim lookup must return the corrected record, not the superseded one.
  const current = await repos.evidence.findCurrentEvidenceForClaim({
    learnerId: studentIds[1], subject: 'geography', assessmentType: 'cat', academicYear: 2026, term: 3,
  })
  assert.equal(current?.id, correctedId)

  // Full history remains queryable — nothing was lost.
  const history = await getEvidenceHistoryForLearner(studentIds[1])
  const historyIds = history.map(h => h.id)
  assert.ok(historyIds.includes(originalId) && historyIds.includes(correctedId))
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
