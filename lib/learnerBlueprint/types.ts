// lib/learnerBlueprint/types.ts
//
// The one canonical Blueprint type, per ADR-0005/0006/0007/0008. Every
// future Blueprint consumer (UI, PDF, Parent Portal, University/Employer
// views) reads this shape — no consumer may invent another Blueprint
// structure or compose sections independently (Sprint 12G mission).
//
// Two identity spaces exist in this codebase: Core's `learners.id`
// (school_id-scoped — Identity, Attendance, Report Cards) and the legacy
// `students.id` (Projection, Compass, Career, Learner Model).
// `docs/architecture/learner-record-layer-decisions.md` Decision 3 names
// this explicitly as "deferred, not silently open." As of Sprint 12H,
// Blueprint no longer takes a caller-supplied `legacyStudentId` — it
// resolves one internally via `lib/core/identity.ts`'s
// `resolveLegacyStudentId()`, the single canonical Core<->legacy resolver
// (see composeBlueprint.ts). BlueprintIdentifiers therefore only ever
// carries the Core identity; a learner with no bridged legacy student row
// still composes a valid partial Blueprint (resolver returns null, every
// legacy-space section degrades explicitly) instead of failing outright.

import type { ConfidenceLevel } from '@/lib/learnerIntelligence/insight'
import type { ParentAction } from '@/lib/parentExperience/actions'
import type { EvidenceCoverage, Trend, RiskValue as ProjectionRiskValue, CapabilityValue, CompletenessValue } from '@/lib/projection/types'
import type { BlueprintGradeBand } from './gradeBand'
import type { CareerKnowledgeState } from '@/lib/career/knowledgeLifecycle'
import type { LearnerId } from '@/lib/core/identityTypes'

export type BlueprintSectionStatus = 'available' | 'unavailable' | 'not_implemented'

/**
 * Live | Snapshot | Historical, per ADR-0007 §6 / ADR-0008 §6's per-section
 * classification table — added per Sprint 12J-A's Finding 4 (the
 * architecture specified this; the shipped type didn't carry it yet).
 * This is distinct from `BlueprintMetadata.freshness` (a whole-Blueprint
 * live/partial aggregate describing composition success, not per-section
 * temporal classification) — Sprint 12J-A confirmed these are two
 * legitimately different concepts, not to be merged.
 */
export type SectionFreshness = 'live' | 'snapshot' | 'historical'

/**
 * Every section is wrapped the same way so a consumer can render "this
 * section isn't ready" without special-casing each domain — and so a
 * missing section is always explicit, never a silently-absent key
 * (mission: "No silent failures", "Never fabricate values").
 */
export type BlueprintSection<T> = {
  status: BlueprintSectionStatus
  /** The one owning domain this section's data came from, for traceability (ADR-0008 Part 9). */
  owner: string
  /** ADR-0007 §6 classification — set even when status !== 'available', so a consumer always knows what kind of freshness *would* apply once the section is. */
  freshness: SectionFreshness
  data: T | null
  /** Present when status !== 'available' — why, never left for the reader to guess. */
  unavailableReason?: string
}

export type BlueprintIdentifiers = {
  actorUserId: string
  /**
   * A Core `learners.id`. Blueprint is addressed institutionally and resolves
   * its own legacy `students.id` internally via `resolveLegacyStudentId()` —
   * the two live in the same scope inside `composeBlueprint()`, which is
   * precisely why they are now different types.
   */
  coreLearnerId: LearnerId
  schoolId: string
}

// ── Identity (Core) ─────────────────────────────────────────────────────────

export type GuardianSummary = {
  fullName: string
  relationship: string
}

export type IdentityData = {
  learnerName: string
  admissionNumber: string
  schoolName: string
  /** School's own crest/logo (schools.logo_url), for cover/header branding — null until a school admin uploads one. */
  schoolLogoUrl: string | null
  currentClassName: string | null
  academicYearLabel: string | null
  termLabel: string | null
  guardians: GuardianSummary[]
}

// ── Academic Record (Projection Engine) ──────────────────────────────────────

export type SubjectRecord = {
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  // Per-subject, single-context trend — 'mixed' is structurally part of the
  // shared Trend type (a 2+-context aggregate concept) but can never occur
  // here; kept type-aligned with academicProjector.ts's own SubjectPerformance.trend
  // rather than narrowed with a cast.
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' | 'mixed'
  /** Count of confirmed evidence points behind this subject's level — Projection's own `SubjectPerformance.history.length`, never re-derived. Lets a consumer say "based on N confirmed evidence items" instead of a bare level. */
  evidenceCount: number
  /** Timestamp of the most recent confirmed evidence for this subject, or null if evidenceCount is 0. */
  latestEvidenceAt: string | null
}

export type CompetencyRecord = {
  subject: string
  currentLevel: 1 | 2 | 3 | 4
}

export type AcademicRecordData = {
  // Phase 4B.1 — sourced from the corrected, comparable-context growth
  // projection (lib/projection/growthProjector.ts); 'mixed' is a real,
  // reachable state here (opposing valid subject trends), not decorative.
  overallTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data' | 'mixed' | null
  bySubject: SubjectRecord[]
  competencies: CompetencyRecord[]
  /** Projection's own confidence (0-100) — carried through, never re-derived. */
  confidence: number | null
  lastComputed: string | null
}

// ── Attendance (Attendance service) ──────────────────────────────────────────

export type AttendanceData = {
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  totalSessions: number
  /** Present-share of sessions, 0-100, or null if there are zero sessions (never a fabricated 0). */
  attendancePercentage: number | null
  /**
   * Per ADR-0007 §4: Attendance Trend/Health/Risk/Learning-Time-Lost/Support
   * are ADR-0006/0007 design targets. No Attendance-owned function computing
   * any of them exists yet (confirmed Sprint 12G) — only raw status counts
   * are available today. Recording that gap explicitly rather than inventing
   * a trend/health calculation inside Blueprint (forbidden by this sprint's
   * mission: "Do NOT calculate attendance").
   */
  notes: string[]
}

// ── Learning Compass (Compass service) ───────────────────────────────────────

export type LearningCompassData = {
  currentLearningFocus: { subject: string; subtopic: string | null } | null
  nextRecommendedAction: string | null
  holidayProgrammeAvailable: boolean
  /**
   * ADR-0006 §3 names "Learning Readiness" as a Blueprint field. No
   * Compass-owned function producing a readiness label exists yet
   * (confirmed Sprint 12G) — always null, never guessed.
   */
  learningReadiness: string | null
  notes: string[]
}

// ── Career (Career Intelligence — lib/learnerIntelligence/careerIntelligence.ts) ──

/**
 * Sprint 12N. Deliberately narrower than the pre-Sprint-12N shape: no
 * `careerTitle` — the Architectural Goal is orientation ("what direction"),
 * never a specific job. `confidence` replaces the old always-null
 * `futureReadiness` with the real canonical label Career Intelligence
 * already computes (`confidenceFromAssessmentCount`) — no longer a
 * documented gap, see sprint-12n doc §5 for what's still a gap (`aiOutlook`,
 * `version`).
 */
/** One door, reduced to a single generic-activity sentence — mirrors `lib/learnerIntelligence/careerIntelligence.ts`'s `CareerDoorPreview`. Never a specific job title, never salary/employer/startup-cost detail. */
export type CareerDoorPreview = {
  type: 'employment' | 'self_employment' | 'entrepreneurship' | 'ai_era'
  summary: string
}

export type CareerData = {
  careerCluster: string | null
  strengthProfile: string | null
  futureDirection: string | null
  aiOutlook: string | null
  confidence: ConfidenceLevel | null
  /** Senior/planning mode only — null for Junior/exploration mode, thin evidence, or a failed-soft lookup. See composeCareer.ts. */
  doorsPreview: CareerDoorPreview[] | null
  aiChangeSummary: string | null
  humanAdvantageSummary: string | null
  explorationSuggestions: string[] | null
  /**
   * How current the underlying career knowledge is. Null for Junior/exploration
   * mode, which resolves to a cluster rather than to a career row, so there is
   * no single verification date to report.
   *
   * Any renderer showing content sourced from that career must also render
   * `knowledge.asOfLabel`. The career corpus is hand-written and ages; the
   * defect this prevents is a family reading a salary band or demand claim in
   * the present tense with no idea when it was last confirmed.
   */
  knowledge: CareerKnowledgeState | null
  notes: string[]
}

// ── Pathway Readiness (lib/pathwayCalculator.ts) ─────────────────────────────

/**
 * The single subject improvement that would open the next pathway — the most
 * actionable thing on the whole Blueprint for a Grade 9 learner, because it
 * names one subject and one level rather than "work harder".
 */
export type PathwayKeyLeverData = {
  subject: string
  currentLevel: number
  targetLevel: number
  pointsGained: number
  /** True when this one improvement alone satisfies every gate for the next pathway. */
  wouldUnlock: boolean
}

export type PathwayNextDoorData = {
  pathway: string
  pointsShort: number
  unlockMessage: string
  keyLever: PathwayKeyLeverData
}

/**
 * Where a junior learner stands against the senior-school pathway decision.
 *
 * Every consumer of this section MUST render `disclaimer` and must not present
 * `recommendedPathway` or `qualifiesFor` as a placement result. When
 * `ruleSetVerified` is false the thresholds behind these figures come from
 * secondary reporting rather than a primary KNEC publication — see the
 * verification contract in lib/config/kjseaRules.ts.
 */
export type PathwayReadinessData = {
  gradeBand: BlueprintGradeBand
  /**
   * `accumulating` (Grade 7-8) carries no forecast by design — evidence is
   * being banked but a projection off it would be a guess. `decision_year`
   * (Grade 9) carries the full forecast.
   */
  stage: 'accumulating' | 'decision_year'
  compositeScore: number
  kjseaMaxScore: number
  subjectsEntered: number
  subjectGroupsTotal: number
  /** Fewer than all 9 subject groups have evidence — the composite is a floor, not a score. */
  isPartialComposite: boolean
  /** Levels alone cannot separate the top of a band from the bottom; the true composite may be higher. */
  compositeUnderstated: boolean
  /** Null in `accumulating` stage — deliberately withheld, never guessed. */
  recommendedPathway: string | null
  qualifiesFor: string[]
  nextDoor: PathwayNextDoorData | null
  ruleSetCycle: string
  /** False when the thresholds are unconfirmed reporting. Renderers must show this. */
  ruleSetVerified: boolean
  disclaimer: string
  disclaimerFull: string
  source: string
  stageMessage: string
  notes: string[]
}

// ── Teacher Reflection ────────────────────────────────────────────────────────

/**
 * ADR-0006 §6 / ADR-0007 §7 designed a structured, 5-subfield Teacher
 * Reflection. No such domain, table, or service exists in this codebase
 * (confirmed Sprint 12G by exhaustive search — the only adjacent field is
 * `school_report_cards.class_teacher_comment`, which is Report-Cards-owned
 * and reference-only per ADR-0005 §5, not a live Blueprint source). This
 * type is defined for forward-compatibility; the composer always returns
 * `not_implemented`.
 */
/**
 * Sprint 12O — the canonical Teacher Reflection domain now exists
 * (`lib/teacherReflection/`, `teacher_reflections` table); this shape
 * matches what that domain actually stores and publishes, replacing the
 * speculative ADR-0006 §6 field list (`reflection`/`parentPartnership`)
 * this type carried while the domain didn't exist yet.
 */
export type TeacherReflectionData = {
  strengths: string
  growthArea: string
  learningHabits: string
  recommendedSupport: string
  holidayFocus: string | null
  teacherSignature: string | null
  writtenAt: string
  publishedAt: string | null
  version: number
}

// ── Portfolio (lib/learnerPortfolio/ — Sprint 12V, ADR-0011) ────────────────
//
// Blueprint's frozen field budget for Portfolio (ADR-0011 Phase 4): counts
// and highlights only. Blueprint never contains a Portfolio entry's full
// title/description/reflection/media — a consumer follows `portfolioUrl`
// (once a Portfolio surface exists) for that.

export type PortfolioHighlight = {
  title: string
  category: string
  publishedAt: string
}

export type PortfolioData = {
  publishedCount: number
  latestItem: PortfolioHighlight | null
  featuredItem: PortfolioHighlight | null
  portfolioUrl: string | null
}

// ── Achievement (lib/learnerAchievement/ — Sprint 12W, ADR-0012) ────────────
//
// Blueprint's frozen field budget for Achievement (Phase 6/7): count,
// latest verified, highest-level, URL, availability. Never a full
// achievement record, never a raw score — Achievement's own future
// full-detail surface is where that lives.

export type AchievementHighlightData = {
  title: string
  category: string
  achievementType: string
  publishedAt: string
}

export type AchievementData = {
  achievementCount: number
  latestVerifiedAchievement: AchievementHighlightData | null
  highestLevelAchievement: AchievementHighlightData | null
  profileUrl: string | null
}

// ── Projects (lib/learnerProjects/ — Sprint 12Z, ADR-0013) ──────────────────
//
// Blueprint's frozen field budget for Projects (Phase 2/6): count, latest
// published, current active, featured, URL. Never a full project record,
// never internal lifecycle state.

export type ProjectHighlightData = {
  title: string
  category: string
  publishedAt: string | null
}

export type ProjectsData = {
  projectCount: number
  latestPublishedProject: ProjectHighlightData | null
  currentActiveProject: { title: string; category: string } | null
  featuredProject: ProjectHighlightData | null
  projectsUrl: string | null
}

// ── Competitions (lib/learnerCompetitions/ — Sprint 13B, ADR-0014) ─────────
//
// Blueprint's frozen field budget for Competitions (mission Phase 7):
// total, verified count, latest, current participation, URL. Never a full
// Competition Entry, never judging, never raw feedback, never unpublished
// work.

export type CompetitionHighlightData = {
  name: string
  level: string
  category: string
  publishedAt: string
}

export type CompetitionsData = {
  totalCompetitions: number
  verifiedCompetitions: number
  latestCompetition: CompetitionHighlightData | null
  currentParticipation: { name: string; level: string; category: string } | null
  competitionsUrl: string | null
}

// ── Leadership (lib/learnerLeadership/ — Sprint 13D, ADR-0015) ─────────────
//
// Blueprint's frozen field budget for Leadership (mission Phase 6):
// current role, completed verified service, brief service summary, URL.
// Never review notes, election data, meeting history, mentor comments, or
// disciplinary information.

export type LeadershipHighlightData = {
  title: string
  scope: string | null
  publishedAt: string
}

export type LeadershipData = {
  currentRole: { title: string; scope: string | null } | null
  completedRoleCount: number
  latestCompletedRole: LeadershipHighlightData | null
  leadershipUrl: string | null
}

// ── Innovation (lib/learnerInnovation/ — Sprint 13I, ADR-0018) ─────────────
//
// Blueprint's frozen field budget for Innovation (mission Phase 6):
// availability, current stage, iteration count, latest milestone, latest
// implementation date, URL. Never iteration history, teacher notes,
// internal review, artifacts, or testing data.

export type InnovationsData = {
  currentStage: { problemAddressed: string; status: string } | null
  iterationCount: number
  latestMilestone: string | null
  latestImplementationDate: string | null
  innovationsUrl: string | null
}

// ── Parent Summary (presentation composition only) ───────────────────────────

export type ParentSummaryData = {
  headline: string | null
  detail: string | null
  action: string | null
}

// ── Educational Identity (placeholder — architecture only, ADR-0006 §9) ──────

export type EducationalIdentityData = {
  label: string
  evidencePhrase: string
  confidenceBand: 'Emerging' | 'Established'
}

// ── Growth Timeline (placeholder — future sprint, ADR-0006 §10) ──────────────

export type GrowthTimelineEntry = {
  windowStart: string
  windowEnd: string
  direction: Trend
  earliestScore: number
  latestScore: number
  delta: number
  trajectory: string
  supportingEvidenceIds: string[]
  confidence: number
  coverage: EvidenceCoverage
}

export type RiskData = ProjectionRiskValue & {
  supportingEvidenceIds: string[]
  confidence: number
  coverage: EvidenceCoverage
  lastComputed: string
}

export type LearningStoryData = {
  narrative: string
  evidence: string
  interpretation: string
  opportunity: string
  trajectory: string
  nextConcern: string
  uncertainty: string
  confidenceStatement: string
  missingEvidence: string
}

export type LearningStoryInputs = {
  identity: BlueprintSection<IdentityData>
  academicRecord: BlueprintSection<AcademicRecordData>
  learningCompass: BlueprintSection<LearningCompassData>
  career: BlueprintSection<CareerData>
  growthTimeline: BlueprintSection<GrowthTimelineEntry[]>
  risk: BlueprintSection<RiskData>
  capability: {
    value: CapabilityValue
    confidence: number
    coverage: EvidenceCoverage
  } | null
  completeness: {
    value: CompletenessValue
    confidence: number
    coverage: EvidenceCoverage
  } | null
}

// ── Recommended Next Steps (Parent Action Centre — Sprint 12S) ───────────────
//
// The one new Blueprint section this sprint adds. Populated by
// `lib/parentExperience/actions.ts`'s `composeParentActions()` — a pure
// selector over this same Blueprint's own already-composed sibling
// sections (Learning Compass, Teacher Reflection, Attendance, Career) plus
// the latest Blueprint Snapshot. No educational summary, no duplicated
// reasoning — only the action list itself.

export type RecommendedNextStepsData = {
  actions: ParentAction[]
}

// ── Metadata (Blueprint lifecycle helper — no persistence) ───────────────────


export type BlueprintMetadata = {
  blueprintVersion: string
  generatedAt: string
  /** ADR-0008 Part 2/Part 3 — describes what THIS composition is, never conflated with a state. */
  snapshotState: 'current' | 'snapshot'
  /** ADR-0008 Part 6 — whether every included section is live, or the composition mixes live and unavailable sections. */
  freshness: 'live' | 'partial'
  evidenceWindow: { start: string | null; end: string }
  /** Per-section source-function identifiers, for traceability (ADR-0008 Part 9). */
  ownerVersions: Record<string, string>
  /**
   * Which stage of the CBE journey this learner was at when the Blueprint was
   * composed. Resolved once here rather than re-derived per render, because it
   * now decides section CONTENT (a junior learner's pathway is a forecast; a
   * senior learner's is already settled) and two renders of the same learner
   * must never disagree about it. Stamped onto snapshots too, so a historical
   * Blueprint keeps being read at the stage it was actually taken.
   */
  gradeBand: BlueprintGradeBand
}

// ── The canonical Blueprint ───────────────────────────────────────────────────

export type LearnerBlueprint = {
  metadata: BlueprintMetadata
  identity: BlueprintSection<IdentityData>
  academicRecord: BlueprintSection<AcademicRecordData>
  attendance: BlueprintSection<AttendanceData>
  learningCompass: BlueprintSection<LearningCompassData>
  career: BlueprintSection<CareerData>
  pathwayReadiness: BlueprintSection<PathwayReadinessData>
  portfolio: BlueprintSection<PortfolioData>
  achievement: BlueprintSection<AchievementData>
  teacherReflection: BlueprintSection<TeacherReflectionData>
  parentSummary: BlueprintSection<ParentSummaryData>
  growthTimeline: BlueprintSection<GrowthTimelineEntry[]>
  risk: BlueprintSection<RiskData>
  learningStory: BlueprintSection<LearningStoryData>
  recommendedNextSteps: BlueprintSection<RecommendedNextStepsData>
}
