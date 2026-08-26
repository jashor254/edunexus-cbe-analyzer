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
import { correctionKeyNamespace } from './correctionKey'
import { asStudentId } from '@/lib/core/identityTypes'

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

/**
 * Phase E4 — THE AUTHORITATIVE AUTOMATIC CORRECTION RULE.
 *
 * Returns the identity of the ARTIFACT this evidence describes, or `null`
 * when it describes no correctable artifact — in which case the evidence is
 * an INDEPENDENT OBSERVATION and supersedes nothing, ever.
 *
 * There is exactly one such rule. `claimKey()` below no longer decides
 * supersession; it survives for contradiction detection, where "same learner,
 * subject, sub-strand and term" is genuinely the right question to ask.
 *
 * Deliberately NO legacy fallback: if this returns null, `persistEvidenceBatch`
 * does not consult the six-field claim key. A fallback would keep the old
 * defect alive for exactly the producers that have no artifact identity — the
 * observation-only ones the defect hurt most.
 */
function correctionGroupKey(e: Pick<LearnerEvidence, 'learnerId' | 'evidenceSource' | 'correctionKey'>): string | null {
  if (!e.learnerId) return null
  if (!e.correctionKey) return null
  // An unrecognised namespace is never trusted (E1 §13). Producer-side
  // construction already refuses to mint one; this is the persistence-side
  // backstop, and it fails CLOSED — to coexistence, never to the legacy rule.
  if (!correctionKeyNamespace(e.correctionKey)) return null
  return `${e.learnerId}:${e.evidenceSource}:${e.correctionKey}`
}

/**
 * The legacy six-field claim identity.
 *
 * NO LONGER DECIDES SUPERSESSION (Phase E4). Retained because it answers a
 * question that is still worth asking — "do these two rows describe the same
 * learner, subject, sub-strand and term?" — which is precisely the input
 * contradiction detection needs now that independent observations coexist and
 * may legitimately disagree.
 *
 * Exported rather than deleted per E4 §10: it has no supersession caller any
 * more, and the alternative to exporting it was removing it, which would
 * throw away the only expression of "same curriculum claim" the domain has.
 * Any future consumer must treat it as descriptive, never as authority.
 */
export function claimKey(e: Pick<LearnerEvidence, 'learnerId' | 'subject' | 'assessmentType' | 'academicYear' | 'term' | 'evidenceSource' | 'subStrandId'>): string | null {
  if (!e.learnerId) return null
  // Phase C (learner-record-layer-decisions.md Decision 1): teacher remarks
  // must never supersede each other — "quiet learner" in 2026 and
  // "confidence improving" in 2027 are both true, permanently, unlike a
  // re-graded score. Routed through the same `null` path unkeyed evidence
  // already takes (persistEvidenceBatch skips supersession entirely for
  // null claim keys) — no new machinery, one narrow carve-out.
  if (e.evidenceSource === 'teacher_remark') return null

  // Phase 1.5 — Compass session evidence is EVENT evidence, not correction
  // evidence, and is exempted for exactly the reason above.
  //
  // A Compass session produces two claims that are both true at once and
  // neither of which corrects the other:
  //   engagement — "this learner worked for 12 minutes across 8 exchanges"
  //   mastery    — "this learner demonstrated progress on equivalent fractions"
  // "The session happened" and "learning was demonstrated" are not two
  // versions of one statement. Nor is a later session a correction of an
  // earlier one: Tuesday's session and Thursday's session are both
  // permanently true, exactly like two teacher remarks a year apart.
  //
  // Without this, all four of those relationships collapsed into one claim
  // key (`learner:subject:assignment:year:term`), with three real
  // consequences:
  //
  //  1. The mastery claim was inserted with `supersedes` pointing at the
  //     engagement claim from its own session. Confirming mastery then
  //     attempted `pending_review -> superseded` on the engagement row,
  //     which the lifecycle trigger correctly rejected — so a teacher could
  //     not confirm a Compass mastery claim at all unless the engagement
  //     claim had already been confirmed first.
  //  2. Each session's claims superseded the previous session's, so a
  //     learner's Compass history collapsed to its most recent session and
  //     the Behaviour Projector's observation count silently under-counted.
  //  3. `assessment_type = 'assignment'` is shared by eight producers
  //     (assignments, quizzes, formative signals, holiday return, parent
  //     observations, intervention check-ins, topical assessments and
  //     Compass), so a tier-1 AI-inferred Compass claim could take a
  //     supersession pointer at a tier-3 teacher-graded assignment for the
  //     same subject and term — and execute it on confirmation.
  //
  // Scoped to this one source deliberately: no other producer's claim-key
  // behaviour changes, and supersession remains fully available to every
  // source for which it is the right semantics (a re-graded exam, a
  // corrected mark). See docs/architecture/learner-record-layer-decisions.md
  // Decision 1 for the precedent this follows.
  if (e.evidenceSource === 'compass_session') return null

  // Phase 2 (GATE A) — curriculum grain is part of claim identity.
  //
  // "Mary is Level 1 in proportional reasoning" and "Mary is Level 3 in
  // algebraic expressions" are two different claims about two different
  // things. Without `subStrandId` in the key they were one claim
  // (`learner:mathematics:assignment:2026:1`), so the second silently
  // superseded the first and the learner's curriculum-level record
  // collapsed to whichever sub-strand was assessed most recently. That was
  // already live for the two producers that anchor evidence today
  // (lib/assignments/evidence.ts, lib/quiz/quizEvidence.ts) and would get
  // steadily worse as Phase 2 spreads anchoring.
  //
  // `null` is an identity value, not a wildcard: it means "this claim is
  // about the subject as a whole, or its curriculum grain is unknown."
  // Subject-level evidence therefore keys with `null` and continues to
  // supersede other subject-level evidence exactly as before — no existing
  // correction path is broken, and no historical row changes meaning.
  // Anchored and unanchored claims simply stop being confused for each
  // other, which is correct: a term exam over all of Mathematics is not a
  // correction of a proportional-reasoning quiz.
  //
  // Re-grading still works: a corrected mark for the same assessment
  // carries the same `subStrandId` (it comes from the same
  // `assignments.substrand_id`), so it lands on the same key and supersedes
  // as it always did.
  //
  // KNOWN, DELIBERATELY NOT FIXED HERE — see the Phase 2 report, GATE A:
  // two *different* assignments on the same sub-strand in the same term
  // still share a key and still supersede each other, even though they are
  // two observations rather than a correction. Fixing that means moving
  // correction identity onto per-artifact provenance (`rawInputRef`) for
  // the whole assignment family, which changes behaviour for eight
  // producers at once. That is a separate Evidence Domain decision, not a
  // side effect of curriculum anchoring.
  return `${e.learnerId}:${e.subject}:${e.subStrandId ?? 'null'}:${e.assessmentType}:${e.academicYear}:${e.term ?? 'null'}`
}

/**
 * Phase 3-closeout — the narrow idempotency gate `persistEvidenceBatch`
 * needs before deciding to supersede. `correctionGroupKey` already pins
 * identity (same learner, same producer, same artifact — Phase E4); this
 * asks the one remaining question: is the INCOMING observation's content
 * actually different from what's already the current row for that artifact,
 * or is this a retry (double-click, network retry, an idempotent re-POST)
 * of the exact same one?
 *
 * Deliberately compares only the fields that constitute the observation
 * itself — `score`, `cbcLevel`, `subject`, `rawSubject`, `assessmentType`,
 * `academicYear`, `term` — never metadata that can legitimately vary
 * between two writes of an unchanged observation (confidence formula
 * version, extraction method, timestamps, issues, trust tier, purpose).
 * Any one of those meaningful fields differing means this is a real
 * correction, not a retry, and must supersede exactly as before — this
 * function only ever narrows toward "definitely the same," never toward
 * "definitely different," so it can only produce a no-op where the
 * observation is genuinely unchanged.
 */
function isIdenticalObservation(prior: EvidenceRow, next: LearnerEvidence): boolean {
  return (
    prior.score === next.score &&
    prior.cbc_level === next.cbcLevel &&
    prior.subject === next.subject &&
    prior.raw_subject === next.rawSubject &&
    prior.assessment_type === next.assessmentType &&
    prior.academic_year === next.academicYear &&
    prior.term === next.term
  )
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

// IDENTITY-1 write boundary. `learner_evidence.learner_id` is FK'd to
// `students(id)` (20260707_evidence_domain.sql:70) — every Evidence write in
// the platform funnels through this builder, so this is the one place the
// domain has to be asserted.
function toNewEvidenceRow(e: LearnerEvidence, runId: string, supersedes: string | null): NewEvidenceRow {
  return {
    learner_id: e.learnerId === null ? null : asStudentId(e.learnerId),
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
    sub_strand_id: e.subStrandId ?? null,
    knowledge_node_id: e.knowledgeNodeId ?? null,
    school_id: e.schoolId ?? null,
    curriculum_version_id: e.curriculumVersionId ?? null,
    purpose_id: e.purposeId ?? null,
    // Phase E4 — this is now the authoritative correction identity.
    correction_key: e.correctionKey ?? null,
    payload: e.payload ?? null,
  }
}

export type PersistEvidenceResult = {
  inserted: EvidenceRow[]
  confirmedCount: number
  pendingReviewCount: number
  /** Phase 3-closeout — items skipped because they were an identical retry of the current row for their artifact (see {@link isIdenticalObservation}). Not an error; the prior row remains active untouched. */
  noOpCount: number
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
    const key = correctionGroupKey(e)
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
    // Phase E4 — mirrors correctionGroupKey() exactly: same learner, same
    // producer, same artifact. Nothing about curriculum or time.
    const prior = await repos.evidence.findCurrentEvidenceForCorrection({
      learnerId: first.learnerId!,
      evidenceSource: first.evidenceSource,
      correctionKey: first.correctionKey!,
    })
    priorByKey.set(key, prior)
  })

  const inserted: EvidenceRow[] = []
  let noOpCount = 0

  // Fast path: unkeyed evidence and single-item groups go through one bulk insert.
  const bulkRows: NewEvidenceRow[] = unkeyed.map(e => toNewEvidenceRow(e, runId, null))
  for (const [key, group] of groups) {
    if (group.length !== 1) continue
    const prior = priorByKey.get(key) ?? null
    if (prior && isIdenticalObservation(prior, group[0])) {
      // Idempotent retry of the current row for this artifact — the prior
      // row is already correct and active; inserting another one would
      // only produce a redundant supersession pair with no semantic change.
      noOpCount++
      continue
    }
    bulkRows.push(toNewEvidenceRow(group[0], runId, prior?.id ?? null))
  }
  if (bulkRows.length > 0) inserted.push(...await repos.evidence.insertEvidenceBatch(bulkRows))

  // Slow path: multi-item groups (duplicate claim keys within this batch) —
  // inserted sequentially so each item's `supersedes` can reference the
  // real id of the item immediately before it in the chain. The same
  // idempotency gate applies at each step, compared against whichever row
  // (prior DB row, or the previous item just inserted in this same chain)
  // is currently the head of the artifact's history.
  for (const [key, group] of groups) {
    if (group.length <= 1) continue
    let priorRow = priorByKey.get(key) ?? null
    for (const item of group) {
      if (priorRow && isIdenticalObservation(priorRow, item)) {
        noOpCount++
        continue
      }
      const [row] = await repos.evidence.insertEvidenceBatch([toNewEvidenceRow(item, runId, priorRow?.id ?? null)])
      inserted.push(row)
      priorRow = row
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
  return { inserted, confirmedCount, pendingReviewCount: inserted.length - confirmedCount, noOpCount }
}

// ── Review lifecycle ─────────────────────────────────────────────────────────

/**
 * Promotes evidence from `pending_review` to `reviewed_confirmed`.
 *
 * Phase 2 (GATE B) — re-confirming an already-confirmed row is an
 * IDEMPOTENT, METADATA-PRESERVING NO-OP, recorded in the audit log.
 *
 * The lifecycle trigger permits same-state updates (its first branch exists
 * so verification_state-only writes can pass), so a second confirmation
 * previously succeeded at the database level and silently overwrote
 * `reviewed_by`, `reviewed_at` and `review_reason` — replacing the record
 * of who actually made the educational judgement with whoever clicked last.
 * That is the real harm, and it is not what the trigger's same-state
 * allowance was for.
 *
 * Rejected alternatives, and why:
 *  - Hard error (the behaviour the existing test asserted): a double-click
 *    or a retry after a network flake is a normal thing for a teacher's
 *    client to do, and turning it into a failure surfaces alarm for a
 *    harmless action. It also cannot be implemented in the database without
 *    narrowing the same-state branch — a trigger migration whose blast
 *    radius covers every evidence write.
 *  - Full audited re-review (a second reviewer formally re-deciding): a
 *    real workflow, but it needs product decisions this phase has no
 *    mandate for — who may re-review, whether the first verdict is
 *    displaced, what a learner's record shows. Deliberately not invented
 *    here.
 *
 * What is implemented is the intersection: safe to retry, impossible to
 * silently rewrite the original reviewer, and the repeat attempt is
 * visible in `evidence_audit_log` for anyone auditing the decision. No
 * migration; the guarantee lives in this function, which is already the
 * only sanctioned path to `reviewed_confirmed`.
 *
 * Every genuinely illegal transition (`retracted -> reviewed_confirmed`,
 * `reviewed_rejected -> reviewed_confirmed`, …) is still rejected by the
 * trigger, untouched.
 */
export async function confirmReview(evidenceId: string, reviewerId: string, reason: string | null): Promise<EvidenceRow> {
  const before = await repos.evidence.findEvidenceById(evidenceId)

  if (before?.lifecycle_state === 'reviewed_confirmed') {
    await repos.evidence.insertAuditEvents([{
      evidence_id: evidenceId,
      event_type: 'reviewed_confirmed',
      actor: reviewerId,
      reason: reason,
      previous_state: 'reviewed_confirmed',
      new_state: 'reviewed_confirmed',
      metadata: {
        no_op: true,
        repeat_confirmation: true,
        original_reviewer: before.reviewed_by,
        original_reviewed_at: before.reviewed_at,
      },
    }])
    return before
  }

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
