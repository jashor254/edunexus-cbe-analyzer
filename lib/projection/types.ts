// lib/projection/types.ts
// The shared Projection<T> shape every projector returns. Per the
// Projection Engine mission: every projection carries current value,
// supporting evidence, confidence, coverage, freshness, and a version —
// nothing else. No projection may exist without supporting evidence
// (see engine.ts — projectors return null, not a fabricated Projection,
// when there's nothing to project from).

export type EvidenceCoverage = {
  evidenceCount: number
  /** Count of distinct evidence_source values among the supporting evidence. */
  evidenceDiversity: number
  latestEvidenceAt: string | null
  oldestEvidenceAt: string | null
  /** Days between now and the latest supporting evidence — freshness, not a value judgment. */
  freshnessDays: number | null
}

export type Projection<T> = {
  value: T
  supportingEvidenceIds: string[]
  /** 0-100. Derived from the confidence and coverage of the supporting evidence — see confidenceAggregation.ts. */
  confidence: number
  coverage: EvidenceCoverage
  lastComputed: string
  /** Versioned rule-set identifier, e.g. "academic-v1" — changing projection logic bumps this. */
  projectionVersion: string
}

export type ProjectorType =
  | 'academic' | 'capability' | 'knowledge' | 'behaviour' | 'growth' | 'risk' | 'completeness'
  | 'capabilityV2' | 'trendV2' | 'knowledgeV2'

// 'mixed' (Phase 4B.1, comparable-context growth correction) — the only
// honest label when two or more comparable contexts (subjects) have
// genuinely opposing valid trends (one improving, one declining). Adding
// this rather than forcing 'improving'/'declining' on conflicting evidence
// is required by the comparable-context invariant: an overall trend must
// never assert a direction that isn't actually true across the learner's
// real per-context evidence. See docs/architecture/comparable-context-
// growth-correction-phase4b1.md.
export type Trend = 'improving' | 'declining' | 'stable' | 'insufficient_data' | 'mixed'

export type CapabilityLevel = 'emerging' | 'developing' | 'capable' | 'strong' | 'exceptional'

// ── Per-projector value shapes ───────────────────────────────────────────────

export type SubjectPerformance = {
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  trend: Trend
  history: Array<{ level: 1 | 2 | 3 | 4; score: number | null; at: string; evidenceId: string }>
}

/**
 * ADR-0024 Phase 2 — additive. Only exists for a sub-strand when at least
 * one confirmed evidence row carries a real, resolved `sub_strand_id`
 * (Sprint A/B/C's canonical curriculum identity). The ABSENCE of a
 * sub-strand here is not a claim of "not ready" — it means Projection has
 * no strand-level evidence for it yet, and any caller should read
 * `bySubject` instead. Projection never gates on sufficiency (no minimum
 * evidence count, no confidence threshold) — that judgment belongs to ARDS
 * (ADR-0023) alone. Same "latest confirmed evidence wins" selection logic
 * as SubjectPerformance, deliberately not a new algorithm.
 */
export type SubStrandPerformance = {
  subStrandId: string
  /** The canonically-resolved title at evidence-creation time (Sprint B/C) — display-only, never re-resolved here. */
  subStrandTitle: string | null
  strandTitle: string | null
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  trend: Trend
  history: Array<{ level: 1 | 2 | 3 | 4; score: number | null; at: string; evidenceId: string }>
}

export type AcademicValue = {
  bySubject: Record<string, SubjectPerformance>
  /** ADR-0024 Phase 2, additive — see SubStrandPerformance's own doc comment for the graceful-fallback contract. */
  bySubStrand: Record<string, SubStrandPerformance>
}

export type CapabilityValue = {
  overallLevel: CapabilityLevel
  overallScore: number   // 0-1, normalized
  bySubject: Record<string, { level: CapabilityLevel; score: number }>
}

export type KnowledgeValue = {
  bySubject: Record<string, { currentLevel: 1 | 2 | 3 | 4; asOf: string }>
  /** ADR-0024 Phase 2, additive — same graceful-fallback contract as AcademicValue.bySubStrand; see SubStrandPerformance's doc comment. */
  bySubStrand: Record<string, { subStrandId: string; subStrandTitle: string | null; strandTitle: string | null; subject: string; currentLevel: 1 | 2 | 3 | 4; asOf: string }>
}

export type BehaviourValue = {
  observationCount: number
  distinctSources: string[]
}

/** One comparable context's (subject's) own trend — never compared against a different context's raw score. */
export type GrowthContextTrend = {
  trend: Trend
  earliestScore: number | null
  latestScore: number | null
  delta: number | null
  windowStart: string | null
  windowEnd: string | null
}

export type GrowthValue = {
  trend: Trend
  /**
   * Only populated when `trend` is directly traceable to exactly one
   * comparable context's own trend (the "one subject has a valid trend"
   * case) — the subject key into `bySubject` that `trend`/`earliestScore`/
   * `latestScore`/`delta`/`windowStart`/`windowEnd` were copied from. Null
   * whenever `trend` is an aggregate across 2+ contexts (nothing single to
   * point at) or `insufficient_data`.
   */
  sourceSubject: string | null
  /**
   * Null whenever the overall trend is derived by aggregating 2+ contexts —
   * a single scalar score/delta across genuinely different subjects would
   * itself be the same cross-subject-pooling error this correction removes.
   * Populated (copied from the one qualifying context) only in the
   * single-valid-context case.
   */
  earliestScore: number | null
  latestScore: number | null
  delta: number | null
  windowStart: string | null
  windowEnd: string | null
  /** Per-subject trend, computed independently within each subject — never compared across subjects. Comparable-context correction, Phase 4B.1. */
  bySubject: Record<string, GrowthContextTrend>
}

export type RiskFlag = {
  subject: string | null
  reason: string
  severity: 'watch' | 'at_risk' | 'critical'
  evidenceIds: string[]
}
export type RiskValue = { flags: RiskFlag[]; overallRiskLevel: 'normal' | 'watch' | 'at_risk' | 'critical' }

export type CompletenessValue = {
  subjectsCovered: string[]
  totalEvidenceCount: number
  sourceDiversity: number
  completenessScore: number   // 0-100
}

// ── Projection V2 additions (additive only — see capabilityV2Projector.ts
// and trendProjector.ts). V1's `capability` and `growth` projections are
// unchanged; these are new, separate projections alongside them. ──────────

/**
 * The subset of Projection V2's named capability dimensions that have a
 * defensible link to real subject-score evidence. Leadership, Collaboration,
 * Self Regulation, and Persistence are deliberately NOT included — they'd
 * need behavioural evidence (session cadence, retry behaviour, etc.) that
 * doesn't exist in Evidence today (see docs/architecture/migration-ledger.md,
 * Projection V2 Behaviour Projector entry). Adding them via a subject-score
 * proxy would violate "no inferred knowledge without evidence."
 */
export type CapabilityV2Dimension =
  | 'analytical_thinking' | 'creative_thinking' | 'communication' | 'research'
  | 'scientific_inquiry' | 'problem_solving' | 'numerical_fluency'
  | 'digital_literacy' | 'systems_thinking'

export type CapabilityV2Score = {
  dimension: CapabilityV2Dimension
  score: number   // 0-1, normalized
  level: CapabilityLevel
  trend: Trend
  contributingSubjects: string[]
  evidenceIds: string[]
  confidence: number   // 0-100, same formula as computeProjectionConfidence, scoped to this dimension's evidence
}

// Only dimensions with at least one contributing subject's evidence are
// present — a dimension with zero supporting evidence is omitted, never
// fabricated with a placeholder score.
export type CapabilityV2Value = { dimensions: Partial<Record<CapabilityV2Dimension, CapabilityV2Score>> }

export type TrendPattern =
  | 'improving' | 'declining' | 'stable' | 'insufficient_data'
  | 'recovering' | 'accelerating' | 'plateau' | 'regression' | 'momentum'

export type TrendV2Value = {
  overall: TrendPattern
  bySubject: Record<string, { pattern: TrendPattern; evidenceIds: string[] }>
}

// Substrand-level knowledge (Projection V2, Sprint 8) — only possible now
// that learner_evidence carries strand/sub_strand (Sprint 7). Additive:
// V1's `knowledge` projection (subject-level current-state snapshot) is
// unchanged and still populated alongside this.
export type KnowledgeV2Substrand = {
  subject: string
  strand: string
  subStrand: string
  averageMastery: number   // 0-1, normalized — mean across ALL contributing evidence, not latest-only
  confidence: number       // 0-100
  coverage: EvidenceCoverage
  latestEvidenceAt: string
  evidenceIds: string[]
}

export type KnowledgeV2Value = {
  bySubject: Record<string, {
    strands: Record<string, {
      substrands: Record<string, KnowledgeV2Substrand>
    }>
  }>
}

export type LearnerIntelligenceProjection = {
  learnerId: string
  academic: Projection<AcademicValue> | null
  capability: Projection<CapabilityValue> | null
  knowledge: Projection<KnowledgeValue> | null
  behaviour: Projection<BehaviourValue> | null
  growth: Projection<GrowthValue> | null
  risk: Projection<RiskValue> | null
  completeness: Projection<CompletenessValue> | null
  /** Projection V2 — optional so existing literals/mocks built against V1's shape remain valid. */
  capabilityV2?: Projection<CapabilityV2Value> | null
  trendV2?: Projection<TrendV2Value> | null
  knowledgeV2?: Projection<KnowledgeV2Value> | null
}
