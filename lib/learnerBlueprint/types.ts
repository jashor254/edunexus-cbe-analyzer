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
  coreLearnerId: string
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
  currentClassName: string | null
  academicYearLabel: string | null
  termLabel: string | null
  guardians: GuardianSummary[]
}

// ── Academic Record (Projection Engine) ──────────────────────────────────────

export type SubjectRecord = {
  subject: string
  latestLevel: 1 | 2 | 3 | 4
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
}

export type CompetencyRecord = {
  subject: string
  currentLevel: 1 | 2 | 3 | 4
}

export type AcademicRecordData = {
  overallTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data' | null
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
export type CareerData = {
  careerCluster: string | null
  strengthProfile: string | null
  futureDirection: string | null
  aiOutlook: string | null
  confidence: ConfidenceLevel | null
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
  date: string
  label: string
  category: string
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
}

// ── The canonical Blueprint ───────────────────────────────────────────────────

export type LearnerBlueprint = {
  metadata: BlueprintMetadata
  identity: BlueprintSection<IdentityData>
  academicRecord: BlueprintSection<AcademicRecordData>
  attendance: BlueprintSection<AttendanceData>
  learningCompass: BlueprintSection<LearningCompassData>
  career: BlueprintSection<CareerData>
  portfolio: BlueprintSection<PortfolioData>
  achievement: BlueprintSection<AchievementData>
  projects: BlueprintSection<ProjectsData>
  teacherReflection: BlueprintSection<TeacherReflectionData>
  parentSummary: BlueprintSection<ParentSummaryData>
  educationalIdentity: BlueprintSection<EducationalIdentityData>
  growthTimeline: BlueprintSection<GrowthTimelineEntry[]>
  recommendedNextSteps: BlueprintSection<RecommendedNextStepsData>
}
