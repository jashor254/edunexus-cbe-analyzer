// lib/intelligence/evidenceLifecycle.ts
// The domain operations layer for the Evidence Domain
// (docs/architecture/evidence-domain-model.md). This is where
// LearnerEvidence (in-memory, produced by pipeline.ts) becomes persisted,
// audited, lineage-tracked evidence — and where the lifecycle transitions
// (review, retraction, supersession) that the domain model defines actually
// execute. Separate from pipeline.ts (orchestration/transformation) and
// from evidence.repository.ts (raw persistence) by design — this module is
// the only place business rules about *when* supersession happens live.

import { repos } from '@/lib/repositories'
import type { LearnerEvidence } from './evidence'
import type { EvidenceRow, NewEvidenceRow } from '@/lib/repositories/evidence.repository'

const PREFETCH_CONCURRENCY = 20

// A jump of 2+ CBC levels between two independently-confirmed pieces of
// evidence for the exact same claim (learner/subject/assessmentType/term)
// is not a normal one-term improvement — it's a disagreement worth a human
// look, not something the claim-key "latest wins" supersession should
// resolve silently. Uses the schema's existing verification_state field
// (EvidenceRow.verification_state's 'contradicted' value, previously never
// written by any code path) — no new column, no new scoring.
const CONTRADICTION_LEVEL_GAP = 2

function isContradiction(prior: EvidenceRow, next: EvidenceRow): boolean {
  if (prior.cbc_level === null || next.cbc_level === null) return false
  return Math.abs(prior.cbc_level - next.cbc_level) >= CONTRADICTION_LEVEL_GAP
}

async function flagContradictionIfAny(priorRow: EvidenceRow, newRow: EvidenceRow): Promise<void> {
  if (!isContradiction(priorRow, newRow)) return
  await Promise.all([
    repos.evidence.updateVerificationState(priorRow.id, 'contradicted'),
    repos.evidence.updateVerificationState(newRow.id, 'contradicted'),
  ])
  await repos.evidence.insertAuditEvents([
    {
      evidence_id: priorRow.id,
      event_type: 'verification_updated',
      actor: 'system',
      previous_state: priorRow.verification_state,
      new_state: 'contradicted',
      metadata: { conflicts_with: newRow.id, prior_cbc_level: priorRow.cbc_level, new_cbc_level: newRow.cbc_level },
    },
    {
      evidence_id: newRow.id,
      event_type: 'verification_updated',
      actor: 'system',
      previous_state: newRow.verification_state,
      new_state: 'contradicted',
      metadata: { conflicts_with: priorRow.id, prior_cbc_level: priorRow.cbc_level, new_cbc_level: newRow.cbc_level },
    },
  ])
}

function claimKey(e: Pick<LearnerEvidence, 'learnerId' | 'subject' | 'assessmentType' | 'academicYear' | 'term' | 'evidenceSource'>): string | null {
  if (!e.learnerId) return null
  // Phase C (learner-record-layer-decisions.md Decision 1): teacher remarks
  // must never supersede each other — "quiet learner" in 2026 and
  // "confidence improving" in 2027 are both true, permanently, unlike a
  // re-graded score. Routed through the same `null` path unkeyed evidence
  // already takes (persistEvidenceBatch skips supersession entirely for
  // null claim keys) — no new machinery, one narrow carve-out.
  if (e.evidenceSource === 'teacher_remark') return null
  return `${e.learnerId}:${e.subject}:${e.assessmentType}:${e.academicYear}:${e.term ?? 'null'}`
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function toNewEvidenceRow(e: LearnerEvidence, runId: string, supersedes: string | null): NewEvidenceRow {
  return {
    learner_id: e.learnerId,
    extracted_name: e.extractedName,
    extracted_external_id: e.extractedExternalId,
    subject: e.subject,
    raw_subject: e.rawSubject,
    score: e.score,
    cbc_level: e.cbcLevel,
    assessment_type: e.assessmentType,
    academic_year: e.academicYear,
    term: e.term,
    evidence_source: e.evidenceSource,
    extraction_method: e.extractionMethod,
    raw_input_ref: e.rawInputRef,
    ingestion_run_id: runId,
    trust_tier: e.trustTier,
    evidence_confidence: e.evidenceConfidence,
    confidence_formula_version: 'v1',
    issues: e.issues,
    lifecycle_state: e.reviewStatus,
    supersedes,
    strand: e.strand ?? null,
    sub_strand: e.subStrand ?? null,
    knowledge_node_id: e.knowledgeNodeId ?? null,
    school_id: e.schoolId ?? null,
    curriculum_version_id: e.curriculumVersionId ?? null,
    purpose_id: e.purposeId ?? null,
    payload: e.payload ?? null,
  }
}

export type PersistEvidenceResult = {
  inserted: EvidenceRow[]
  confirmedCount: number
  pendingReviewCount: number
}

/**
 * Persists a batch of in-memory LearnerEvidence into the permanent store.
 * Handles claim-key supersession (including duplicate claim keys within the
 * same batch), audit logging, and projection-event emission for anything
 * that reaches confirmed standing immediately (auto_confirmed).
 */
export async function persistEvidenceBatch(evidence: LearnerEvidence[], runId: string): Promise<PersistEvidenceResult> {
  // Group by claim key so intra-batch duplicates chain correctly.
  const groups = new Map<string, LearnerEvidence[]>()
  const unkeyed: LearnerEvidence[] = []
  for (const e of evidence) {
    const key = claimKey(e)
    if (key === null) { unkeyed.push(e); continue }
    const group = groups.get(key) ?? []
    group.push(e)
    groups.set(key, group)
  }

  // Pre-fetch the current DB record for each unique claim key, in parallel.
  const keys = [...groups.keys()]
  const priorByKey = new Map<string, EvidenceRow | null>()
  await mapWithConcurrency(keys, PREFETCH_CONCURRENCY, async key => {
    const first = groups.get(key)![0]
    const prior = await repos.evidence.findCurrentEvidenceForClaim({
      learnerId: first.learnerId!, subject: first.subject, assessmentType: first.assessmentType,
      academicYear: first.academicYear, term: first.term,
    })
    priorByKey.set(key, prior)
  })

  const inserted: EvidenceRow[] = []

  // Fast path: unkeyed evidence and single-item groups go through one bulk insert.
  const bulkRows: NewEvidenceRow[] = unkeyed.map(e => toNewEvidenceRow(e, runId, null))
  const singletonKeys: string[] = []
  for (const [key, group] of groups) {
    if (group.length === 1) {
      bulkRows.push(toNewEvidenceRow(group[0], runId, priorByKey.get(key)?.id ?? null))
      singletonKeys.push(key)
    }
  }
  if (bulkRows.length > 0) inserted.push(...await repos.evidence.insertEvidenceBatch(bulkRows))

  // Slow path: multi-item groups (duplicate claim keys within this batch) —
  // inserted sequentially so each item's `supersedes` can reference the
  // real id of the item immediately before it in the chain.
  for (const [key, group] of groups) {
    if (group.length <= 1) continue
    let priorId = priorByKey.get(key)?.id ?? null
    for (const item of group) {
      const [row] = await repos.evidence.insertEvidenceBatch([toNewEvidenceRow(item, runId, priorId)])
      inserted.push(row)
      priorId = row.id
    }
  }

  // Audit log: one 'created' + one lifecycle-appropriate event per inserted row.
  await repos.evidence.insertAuditEvents(inserted.flatMap(row => ([
    { evidence_id: row.id, event_type: 'created' as const, actor: 'system', new_state: row.lifecycle_state, metadata: { ingestion_run_id: runId } },
    row.lifecycle_state === 'auto_confirmed'
      ? { evidence_id: row.id, event_type: 'auto_confirmed' as const, actor: 'system', previous_state: 'created', new_state: 'auto_confirmed' }
      : { evidence_id: row.id, event_type: 'routed_to_review' as const, actor: 'system', previous_state: 'created', new_state: 'pending_review' },
  ])))

  // Execute supersession + emit projection events for anything already confirmed.
  const projectionEvents: Array<{ evidence_id: string; learner_id: string; event_type: 'evidence_confirmed' | 'evidence_superseded' }> = []
  for (const row of inserted) {
    if (row.lifecycle_state !== 'auto_confirmed') continue
    if (row.supersedes) {
      const priorRow = await repos.evidence.markSuperseded(row.supersedes, row.id)
      await repos.evidence.insertAuditEvents([
        { evidence_id: priorRow.id, event_type: 'superseded', actor: 'system', previous_state: 'auto_confirmed', new_state: 'superseded', metadata: { supersededBy: row.id } },
      ])
      await flagContradictionIfAny(priorRow, row)
      if (priorRow.learner_id) projectionEvents.push({ evidence_id: priorRow.id, learner_id: priorRow.learner_id, event_type: 'evidence_superseded' })
    }
    if (row.learner_id) projectionEvents.push({ evidence_id: row.id, learner_id: row.learner_id, event_type: 'evidence_confirmed' })
  }
  if (projectionEvents.length > 0) await repos.evidence.insertProjectionEvents(projectionEvents)

  const confirmedCount = inserted.filter(r => r.lifecycle_state === 'auto_confirmed').length
  return { inserted, confirmedCount, pendingReviewCount: inserted.length - confirmedCount }
}

// ── Review lifecycle ─────────────────────────────────────────────────────────

export async function confirmReview(evidenceId: string, reviewerId: string, reason: string | null): Promise<EvidenceRow> {
  const before = await repos.evidence.findEvidenceById(evidenceId)
  const updated = await repos.evidence.reviewConfirm(evidenceId, reviewerId, reason)
  await repos.evidence.insertAuditEvents([
    { evidence_id: evidenceId, event_type: 'reviewed_confirmed', actor: reviewerId, reason, previous_state: before?.lifecycle_state ?? null, new_state: 'reviewed_confirmed' },
  ])

  if (updated.supersedes) {
    const priorRow = await repos.evidence.markSuperseded(updated.supersedes, updated.id)
    await repos.evidence.insertAuditEvents([
      { evidence_id: priorRow.id, event_type: 'superseded', actor: 'system', previous_state: 'reviewed_confirmed', new_state: 'superseded', metadata: { supersededBy: updated.id } },
    ])
    await flagContradictionIfAny(priorRow, updated)
    if (priorRow.learner_id) {
      await repos.evidence.insertProjectionEvents([{ evidence_id: priorRow.id, learner_id: priorRow.learner_id, event_type: 'evidence_superseded' }])
    }
  }
  if (updated.learner_id) {
    await repos.evidence.insertProjectionEvents([{ evidence_id: updated.id, learner_id: updated.learner_id, event_type: 'evidence_confirmed' }])
  }
  return updated
}

export async function rejectReview(evidenceId: string, reviewerId: string, reason: string): Promise<EvidenceRow> {
  const before = await repos.evidence.findEvidenceById(evidenceId)
  const updated = await repos.evidence.reviewReject(evidenceId, reviewerId, reason)
  await repos.evidence.insertAuditEvents([
    { evidence_id: evidenceId, event_type: 'reviewed_rejected', actor: reviewerId, reason, previous_state: before?.lifecycle_state ?? null, new_state: 'reviewed_rejected' },
  ])
  // No projection event — rejected evidence never reached confirmed standing.
  return updated
}

export async function retractEvidence(evidenceId: string, actorId: string, reason: string): Promise<EvidenceRow> {
  const before = await repos.evidence.findEvidenceById(evidenceId)
  const updated = await repos.evidence.retract(evidenceId, actorId, reason)
  await repos.evidence.insertAuditEvents([
    { evidence_id: evidenceId, event_type: 'retracted', actor: actorId, reason, previous_state: before?.lifecycle_state ?? null, new_state: 'retracted' },
  ])
  if (updated.learner_id) {
    await repos.evidence.insertProjectionEvents([{ evidence_id: updated.id, learner_id: updated.learner_id, event_type: 'evidence_retracted' }])
  }
  return updated
}

/**
 * Phase -1 (learner-record-layer-signoff.md) — the legally-mandated
 * erasure path. Distinct from retraction: retraction says "this claim is
 * wrong"; erasure says "this identifying data must be removed," and is not
 * conditional on the evidence's review status (the DB lifecycle-transition
 * trigger permits `-> erased` from any non-erased state, unlike every other
 * transition in this file, which follows the reviewed_confirmed/
 * auto_confirmed-gated state machine). The row, its id, and its position in
 * any supersession/audit chain are preserved — only `extracted_name` /
 * `extracted_external_id` / `score` are purged, per the DB trigger's own
 * enforcement (`enforce_evidence_immutability`'s `is_erasure` exception) —
 * this function cannot widen that scope even if it tried.
 *
 * Reuses the `evidence_retracted` projection-event type rather than adding
 * a new one: `evidence_projection_events.event_type`'s CHECK constraint
 * was not part of Phase -1's ratified schema changes, and the *effect* on
 * Projection is identical either way — erased evidence, like retracted
 * evidence, falls outside `findConfirmedEvidenceForLearner`'s
 * auto_confirmed/reviewed_confirmed filter, so Projection must recompute
 * without it.
 */
export async function eraseEvidence(evidenceId: string, actorId: string, reason: string): Promise<EvidenceRow> {
  const before = await repos.evidence.findEvidenceById(evidenceId)
  const updated = await repos.evidence.erase(evidenceId, actorId, reason)
  await repos.evidence.insertAuditEvents([
    { evidence_id: evidenceId, event_type: 'erased', actor: actorId, reason, previous_state: before?.lifecycle_state ?? null, new_state: 'erased' },
  ])
  if (updated.learner_id) {
    await repos.evidence.insertProjectionEvents([{ evidence_id: updated.id, learner_id: updated.learner_id, event_type: 'evidence_retracted' }])
  }
  return updated
}

// ── Lookup passthroughs (domain-shaped, not raw table access) ───────────────

export async function getPendingReview(filters: { ingestionRunId?: string; learnerId?: string } = {}): Promise<EvidenceRow[]> {
  return repos.evidence.findPendingReview(filters)
}

export async function getEvidenceHistoryForLearner(learnerId: string): Promise<EvidenceRow[]> {
  return repos.evidence.findByLearner(learnerId)
}

export async function getEvidenceAuditTrail(evidenceId: string) {
  return repos.evidence.findAuditLog(evidenceId)
}
