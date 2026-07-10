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

export type Trend = 'improving' | 'declining' | 'stable' | 'insufficient_data'

export type CapabilityLevel = 'emerging' | 'developing' | 'capable' | 'strong' | 'exceptional'

// ── Per-projector value shapes ───────────────────────────────────────────────

export type SubjectPerformance = {
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  trend: Trend
  history: Array<{ level: 1 | 2 | 3 | 4; score: number | null; at: string; evidenceId: string }>
}
export type AcademicValue = { bySubject: Record<string, SubjectPerformance> }

export type CapabilityValue = {
  overallLevel: CapabilityLevel
  overallScore: number   // 0-1, normalized
  bySubject: Record<string, { level: CapabilityLevel; score: number }>
}

export type KnowledgeValue = { bySubject: Record<string, { currentLevel: 1 | 2 | 3 | 4; asOf: string }> }

export type BehaviourValue = {
  observationCount: number
  distinctSources: string[]
}

export type GrowthValue = {
  trend: Trend
  earliestScore: number | null
  latestScore: number | null
  delta: number | null
  windowStart: string | null
  windowEnd: string | null
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
