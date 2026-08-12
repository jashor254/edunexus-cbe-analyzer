import { BaseRepository } from './base'

// Data access for the Evidence Domain (docs/architecture/evidence-domain-model.md).
// This repository exposes domain-shaped operations over 4 tables
// (ingestion_runs, learner_evidence, evidence_audit_log,
// evidence_projection_events) — callers never see table names or raw
// column shapes beyond what's defined in these return types. Two invariants
// (fact-column immutability, valid lifecycle transitions) are enforced by
// database triggers, not by this repository — a bug here cannot corrupt
// evidence integrity, only fail loudly.

const EVIDENCE_COLS =
  'id, created_at, learner_id, extracted_name, extracted_external_id, subject, raw_subject, score, ' +
  'cbc_level, assessment_type, academic_year, term, evidence_source, extraction_method, raw_input_ref, ' +
  'ingestion_run_id, trust_tier, evidence_confidence, confidence_formula_version, issues, lifecycle_state, ' +
  'reviewed_by, reviewed_at, review_reason, retracted_by, retracted_at, retraction_reason, supersedes, ' +
  'superseded_by, verification_state, updated_at, strand, sub_strand, sub_strand_id, knowledge_node_id, ' +
  'school_id, curriculum_version_id, erased_by, erased_at, erasure_reason, purpose_id, payload, correction_key'

export type EvidenceRow = {
  id: string
  created_at: string
  learner_id: string | null
  extracted_name: string
  extracted_external_id: string | null
  subject: string
  raw_subject: string
  score: number | null
  cbc_level: 1 | 2 | 3 | 4 | null
  assessment_type: 'term_exam' | 'cat' | 'assignment'
  academic_year: number
  term: number | null
  evidence_source: string
  extraction_method: string
  raw_input_ref: string
  ingestion_run_id: string
  trust_tier: 1 | 2 | 3
  evidence_confidence: number
  confidence_formula_version: string
  issues: string[]
  lifecycle_state: 'auto_confirmed' | 'pending_review' | 'reviewed_confirmed' | 'reviewed_rejected' | 'superseded' | 'retracted' | 'erased'
  reviewed_by: string | null
  reviewed_at: string | null
  review_reason: string | null
  retracted_by: string | null
  retracted_at: string | null
  retraction_reason: string | null
  supersedes: string | null
  superseded_by: string | null
  verification_state: 'unverified' | 'corroborated' | 'contradicted' | 'externally_verified'
  updated_at: string
  /** Projection V2.1, additive — null on every row created before this sprint and on any source that doesn't know curriculum context. */
  strand: string | null
  sub_strand: string | null
  /** ADR-0024 Sprint B, additive — a real sow_substrands.id, only when the producer resolved one from a canonical picker. Null on every row created before this sprint. */
  sub_strand_id: string | null
  knowledge_node_id: string | null
  /** Phase -1 (learner-record-layer-signoff.md) — captured at write time; null on every row created before this phase, and on any writer not yet updated to resolve them. */
  school_id: string | null
  curriculum_version_id: string | null
  /** Phase -1 — populated only by `erase()`, the one documented exception to fact immutability. */
  erased_by: string | null
  erased_at: string | null
  erasure_reason: string | null
  /** Phase G (learner-record-layer-decisions.md Decision 2) — educational meaning independent of the surface assessment-type label; null on any writer not yet updated to resolve it. */
  purpose_id: string | null
  /** Phase E2 — immutable artifact identity; NULL = independent observation. Not yet read for supersession. */
  correction_key: string | null
  /** Phase C (learner-record-layer-decisions.md Decision 1) — shape-specific content for narrative/non-scored evidence (e.g. a teacher remark's body), keyed by evidence_source. Null for measured (scored) evidence. */
  payload: Record<string, unknown> | null
}

export type NewEvidenceRow = Omit<
  EvidenceRow,
  'id' | 'created_at' | 'reviewed_by' | 'reviewed_at' | 'review_reason' |
  'retracted_by' | 'retracted_at' | 'retraction_reason' | 'supersedes' | 'superseded_by' |
  'verification_state' | 'updated_at' | 'erased_by' | 'erased_at' | 'erasure_reason'
> & { supersedes?: string | null }

export type IngestionRun = {
  id: string
  source: string
  initiated_by: string
  teacher_id: string | null
  institution: string | null
  status: 'processing' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  processing_duration_ms: number | null
  record_count: number
  confirmed_count: number
  pending_review_count: number
  rejected_count: number
  failure_reason: string | null
}

export type EvidenceAuditEvent = {
  evidence_id: string
  event_type: 'created' | 'auto_confirmed' | 'routed_to_review' | 'reviewed_confirmed' |
              'reviewed_rejected' | 'superseded' | 'retracted' | 'verification_updated' | 'erased'
  actor: string
  reason?: string | null
  previous_state?: string | null
  new_state: string
  metadata?: Record<string, unknown>
}

export type ProjectionEvent = {
  evidence_id: string
  learner_id: string
  event_type: 'evidence_confirmed' | 'evidence_retracted' | 'evidence_superseded'
  metadata?: Record<string, unknown>
}

const CHUNK_SIZE = 500

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export class EvidenceRepository extends BaseRepository {
  // ── Ingestion runs ────────────────────────────────────────────────────────

  async createIngestionRun(input: {
    source: string
    initiatedBy: string
    teacherId: string | null
    institution: string | null
  }): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('ingestion_runs')
      .insert({
        source: input.source,
        initiated_by: input.initiatedBy,
        teacher_id: input.teacherId,
        institution: input.institution,
      })
      .select('id')
      .single()
    if (error) throw new Error(`createIngestionRun: ${error.message}`)
    return data
  }

  async completeIngestionRun(
    runId: string,
    stats: { recordCount: number; confirmedCount: number; pendingReviewCount: number; rejectedCount: number; processingDurationMs: number },
  ): Promise<void> {
    const { error } = await this.db
      .from('ingestion_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        record_count: stats.recordCount,
        confirmed_count: stats.confirmedCount,
        pending_review_count: stats.pendingReviewCount,
        rejected_count: stats.rejectedCount,
        processing_duration_ms: stats.processingDurationMs,
      })
      .eq('id', runId)
    if (error) throw new Error(`completeIngestionRun: ${error.message}`)
  }

  async failIngestionRun(runId: string, reason: string): Promise<void> {
    const { error } = await this.db
      .from('ingestion_runs')
      .update({ status: 'failed', failure_reason: reason, completed_at: new Date().toISOString() })
      .eq('id', runId)
    if (error) throw new Error(`failIngestionRun: ${error.message}`)
  }

  async findIngestionRun(runId: string): Promise<IngestionRun | null> {
    const { data, error } = await this.db
      .from('ingestion_runs')
      .select('id, source, initiated_by, teacher_id, institution, status, started_at, completed_at, processing_duration_ms, record_count, confirmed_count, pending_review_count, rejected_count, failure_reason')
      .eq('id', runId)
      .maybeSingle()
    if (error) throw new Error(`findIngestionRun: ${error.message}`)
    return data
  }

  /** Live counts by lifecycle_state — distinct from the frozen at-completion snapshot on the run itself. */
  async getLiveBatchStats(runId: string): Promise<Record<string, number>> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .select('lifecycle_state')
      .eq('ingestion_run_id', runId)
    if (error) throw new Error(`getLiveBatchStats: ${error.message}`)
    const stats: Record<string, number> = {}
    for (const row of data ?? []) stats[row.lifecycle_state] = (stats[row.lifecycle_state] ?? 0) + 1
    return stats
  }

  // ── Evidence — insert ────────────────────────────────────────────────────

  /** Bulk insert, chunked to keep individual payloads bounded regardless of import size. */
  async insertEvidenceBatch(rows: NewEvidenceRow[]): Promise<EvidenceRow[]> {
    const inserted: EvidenceRow[] = []
    for (const batch of chunk(rows, CHUNK_SIZE)) {
      const { data, error } = await this.db
        .from('learner_evidence')
        .insert(batch)
        .select(EVIDENCE_COLS)
      if (error) throw new Error(`insertEvidenceBatch: ${error.message}`)
      inserted.push(...(data as unknown as EvidenceRow[]))
    }
    return inserted
  }

  // ── Evidence — lookup ────────────────────────────────────────────────────

  async findEvidenceById(id: string): Promise<EvidenceRow | null> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .select(EVIDENCE_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`findEvidenceById: ${error.message}`)
    return data as unknown as EvidenceRow | null
  }

  /** The current (non-superseded/retracted/rejected) record for a claim key, if one exists. */
  /**
   * The standing row a CORRECTION would replace — Phase E4's authoritative
   * lookup.
   *
   * Scope is `(learner_id, evidence_source, correction_key)` and nothing
   * else. Each part earns its place:
   *   - learner: obvious.
   *   - evidence_source: the trust boundary. A producer can never reach
   *     another producer's artifact even if it somehow emitted that
   *     artifact's key string, so a tier-1 parent observation cannot
   *     supersede a tier-3 teacher mark.
   *   - correction_key: the artifact itself.
   *
   * Subject, sub-strand, assessment type, year and term are deliberately
   * ABSENT. Those describe the curriculum area, not the artifact, and
   * matching on them was exactly the defect this replaces: of 55
   * supersession chains in production, ~32 were independent observations
   * that happened to share a curriculum area. A correction may also
   * legitimately fix a mis-entered subject, which a subject match would
   * block.
   *
   * A null/empty key never reaches here — `persistEvidenceBatch` treats
   * unkeyed evidence as an independent observation and does not look for a
   * prior at all.
   */
  async findCurrentEvidenceForCorrection(claim: {
    learnerId: string; evidenceSource: string; correctionKey: string
  }): Promise<EvidenceRow | null> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .select(EVIDENCE_COLS)
      .eq('learner_id', claim.learnerId)
      .eq('evidence_source', claim.evidenceSource)
      .eq('correction_key', claim.correctionKey)
      .in('lifecycle_state', ['auto_confirmed', 'pending_review', 'reviewed_confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findCurrentEvidenceForCorrection: ${error.message}`)
    return data as unknown as EvidenceRow | null
  }

  async findPendingReview(filters: { ingestionRunId?: string; learnerId?: string } = {}): Promise<EvidenceRow[]> {
    let query = this.db.from('learner_evidence').select(EVIDENCE_COLS).eq('lifecycle_state', 'pending_review')
    if (filters.ingestionRunId) query = query.eq('ingestion_run_id', filters.ingestionRunId)
    if (filters.learnerId) query = query.eq('learner_id', filters.learnerId)
    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) throw new Error(`findPendingReview: ${error.message}`)
    return data as unknown as EvidenceRow[]
  }

  /**
   * The exact input the Projection Engine consumes: currently-standing
   * confirmed evidence only (auto_confirmed or reviewed_confirmed) —
   * excludes pending_review, reviewed_rejected, superseded, and retracted.
   * This is "all confirmed educational evidence available today."
   */
  /**
   * The Projection Engine's one read of a learner's confirmed evidence.
   *
   * `created_at` alone is NOT a unique sort key. Evidence rows carry no
   * explicit `created_at` — it defaults to `now()`, which in Postgres is the
   * TRANSACTION timestamp, so every row written by one `persistEvidenceBatch`
   * call shares an identical value. Ties are therefore structural, not
   * incidental: production currently holds 447 confirmed rows across 52 tied
   * groups.
   *
   * Postgres does not guarantee ordering among equal sort keys, so two
   * identical recomputations could return the same rows in different orders.
   * Measured before this tiebreaker: 1 in 25 paired recomputations differed,
   * and every differing path was a `supportingEvidenceIds[n]` entry.
   *
   * `id` is the tiebreaker: the primary key, always present, and immutable
   * (the fact-immutability trigger forbids changing it). It is deliberately
   * only a TIEBREAKER — `created_at ASC` remains the primary sort, so real
   * chronology can never be reordered. Because ids are random uuids, the
   * winner within a tied group is arbitrary but now STABLE; there is no
   * insertion-order column to recover a truer answer from, and the previous
   * behaviour was equally arbitrary while also being unstable.
   */
  async findConfirmedEvidenceForLearner(learnerId: string): Promise<EvidenceRow[]> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .select(EVIDENCE_COLS)
      .eq('learner_id', learnerId)
      .in('lifecycle_state', ['auto_confirmed', 'reviewed_confirmed'])
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(`findConfirmedEvidenceForLearner: ${error.message}`)
    return data as unknown as EvidenceRow[]
  }

  async findByIngestionRun(runId: string): Promise<EvidenceRow[]> {
    const { data, error } = await this.db.from('learner_evidence').select(EVIDENCE_COLS).eq('ingestion_run_id', runId)
    if (error) throw new Error(`findByIngestionRun: ${error.message}`)
    return data as unknown as EvidenceRow[]
  }

  async findByLearner(learnerId: string): Promise<EvidenceRow[]> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .select(EVIDENCE_COLS)
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`findByLearner: ${error.message}`)
    return data as unknown as EvidenceRow[]
  }

  // ── Evidence — lifecycle transitions (validity enforced by DB trigger) ──

  async reviewConfirm(id: string, reviewedBy: string, reason: string | null): Promise<EvidenceRow> {
    return this.transition(id, { lifecycle_state: 'reviewed_confirmed', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_reason: reason })
  }

  async reviewReject(id: string, reviewedBy: string, reason: string): Promise<EvidenceRow> {
    return this.transition(id, { lifecycle_state: 'reviewed_rejected', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(), review_reason: reason })
  }

  async retract(id: string, retractedBy: string, reason: string): Promise<EvidenceRow> {
    return this.transition(id, { lifecycle_state: 'retracted', retracted_by: retractedBy, retracted_at: new Date().toISOString(), retraction_reason: reason })
  }

  async markSuperseded(id: string, supersededByEvidenceId: string): Promise<EvidenceRow> {
    return this.transition(id, { lifecycle_state: 'superseded', superseded_by: supersededByEvidenceId })
  }

  /**
   * The one documented exception to fact immutability (Phase -1). Nulls
   * `extracted_name` / `extracted_external_id` / `score` / `payload` and
   * transitions to `erased`; every other fact column, including
   * `learner_id`, is left untouched — this purges identifying and
   * sensitive content, it does not delete the row or unlink it from the
   * learner. `payload` is included (added in Phase C) because a teacher
   * remark's actual content lives there, not in `extracted_name` — erasure
   * that skipped it would purge an empty field while leaving the real
   * content intact. Enforced at the DB trigger level
   * (`enforce_evidence_immutability`), not just here — a bug in this method
   * cannot widen what erasure is allowed to change.
   */
  async erase(id: string, erasedBy: string, reason: string): Promise<EvidenceRow> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .update({
        lifecycle_state: 'erased',
        erased_by: erasedBy,
        erased_at: new Date().toISOString(),
        erasure_reason: reason,
        extracted_name: '[erased]',
        extracted_external_id: null,
        score: null,
        payload: null,
      })
      .eq('id', id)
      .select(EVIDENCE_COLS)
      .single()
    if (error) throw new Error(`erase: ${error.message}`)
    return data as unknown as EvidenceRow
  }

  async updateVerificationState(id: string, state: EvidenceRow['verification_state']): Promise<EvidenceRow> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .update({ verification_state: state })
      .eq('id', id)
      .select(EVIDENCE_COLS)
      .single()
    if (error) throw new Error(`updateVerificationState: ${error.message}`)
    return data as unknown as EvidenceRow
  }

  private async transition(id: string, patch: Record<string, unknown>): Promise<EvidenceRow> {
    const { data, error } = await this.db
      .from('learner_evidence')
      .update(patch)
      .eq('id', id)
      .select(EVIDENCE_COLS)
      .single()
    if (error) throw new Error(`evidence lifecycle transition failed: ${error.message}`)
    return data as unknown as EvidenceRow
  }

  // ── Audit log (append-only) ──────────────────────────────────────────────

  async insertAuditEvents(events: EvidenceAuditEvent[]): Promise<void> {
    // PostgREST bulk-insert determines a batch's columns from the request
    // shape; if some objects in one array omit an optional key while others
    // include it, rows missing the key get an explicit NULL rather than the
    // column default. Normalizing every optional field here, once, protects
    // every call site rather than requiring each caller to remember this.
    const normalized = events.map(e => ({
      evidence_id: e.evidence_id,
      event_type: e.event_type,
      actor: e.actor,
      reason: e.reason ?? null,
      previous_state: e.previous_state ?? null,
      new_state: e.new_state,
      metadata: e.metadata ?? {},
    }))
    for (const batch of chunk(normalized, CHUNK_SIZE)) {
      const { error } = await this.db.from('evidence_audit_log').insert(batch)
      if (error) throw new Error(`insertAuditEvents: ${error.message}`)
    }
  }

  async findAuditLog(evidenceId: string): Promise<Array<EvidenceAuditEvent & { id: string; occurred_at: string }>> {
    const { data, error } = await this.db
      .from('evidence_audit_log')
      .select('id, evidence_id, event_type, actor, occurred_at, reason, previous_state, new_state, metadata')
      .eq('evidence_id', evidenceId)
      .order('occurred_at', { ascending: true })
    if (error) throw new Error(`findAuditLog: ${error.message}`)
    return data
  }

  // ── Projection events (outbox — no consumer yet) ─────────────────────────

  async insertProjectionEvents(events: ProjectionEvent[]): Promise<void> {
    const normalized = events.map(e => ({
      evidence_id: e.evidence_id,
      learner_id: e.learner_id,
      event_type: e.event_type,
      metadata: e.metadata ?? {},
    }))
    for (const batch of chunk(normalized, CHUNK_SIZE)) {
      const { error } = await this.db.from('evidence_projection_events').insert(batch)
      if (error) throw new Error(`insertProjectionEvents: ${error.message}`)
    }
  }

  async findUnprocessedProjectionEvents(limit = 100): Promise<Array<ProjectionEvent & { id: string; occurred_at: string }>> {
    const { data, error } = await this.db
      .from('evidence_projection_events')
      .select('id, evidence_id, learner_id, event_type, occurred_at, metadata')
      .is('processed_at', null)
      .order('occurred_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error(`findUnprocessedProjectionEvents: ${error.message}`)
    return data
  }

  async markProjectionEventProcessed(id: string): Promise<void> {
    const { error } = await this.db.from('evidence_projection_events').update({ processed_at: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(`markProjectionEventProcessed: ${error.message}`)
  }
}
