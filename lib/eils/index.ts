// lib/eils/index.ts
// EduNexus Intelligence Learning System — Public API
//
// Import from here. Never import directly from individual EILS modules.
//
// EILS is the cognitive coordination layer above all EduNexus services.
// It coordinates without duplicating. It reasons without replacing.

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  // Core
  EILSEventType,
  EILSEventSource,
  EILSEvent,
  ActionType,
  RecommendationStatus,
  RecommendationOutcome,
  EILSRecommendation,
  RecommendationEvidence,
  ReasoningType,
  ReasoningEvidence,
  ReasoningResult,
  ActionRecommendation,
  InterventionType,
  InterventionOutcome,
  EILSIntervention,
  EILSReasoningLog,
  EILSMilestoneType,
  EILSMilestone,
  // Layer 1
  IntelligenceSnapshot,
  IntelligenceSummary,
  // Layer 4
  LearningStyleHint,
  TeachingApproach,
  EILSCoordinationContext,
  // Layer 5
  CurriculumGap,
  ResourceNeed,
  RiskCluster,
  TeacherEffectivenessRow,
  // Layer 6
  EILSTeacherPanel,
  StudentAttentionItem,
  MisconceptionAlert,
  AccelerationCandidate,
  MasteryHeatmapRow,
  // Layer 7
  EILSParentInsight,
  // Layer 8
  EILSSchoolIntelligence,
} from './types'

// ── Layer 1 — Learner Intelligence Profile ───────────────────────────────────

export {
  buildIntelligenceSnapshot,
  buildLightweightSnapshot,
  riskOrder,
} from './profile'

// ── Layer 2 — Education Reasoning Engine ─────────────────────────────────────

export {
  whyIsLearnerStruggling,
  isLearnerImproving,
  whichInterventionIsLikelyToWork,
  shouldTeacherIntervene,
} from './reasoningEngine'

// ── Layer 3 — Next Best Learning Action ──────────────────────────────────────

export {
  computeNextBestActions,
  markRecommendationActioned,
} from './nextAction'

// ── Layer 4 — Knowledge Graph Intelligence ────────────────────────────────────

export {
  buildPersonalisedLearningPath,
} from './kgIntelligence'

export type {
  LearningPathStep,
  PersonalisedLearningPath,
  MasteryCluster,
  FutureReadiness,
} from './kgIntelligence'

// ── Layer 5 — Career Intelligence ────────────────────────────────────────────

export {
  computeCareerReadinessDelta,
  detectEmergingInterests,
  buildCareerIntelligenceSummary,
  detectAndRecordCareerMilestones,
} from './careerIntelligence'

export type {
  CareerReadinessDelta,
  EmergingInterest,
  CareerIntelligenceSummary,
} from './careerIntelligence'

// ── Layer 6 — Teacher Intelligence ───────────────────────────────────────────

export {
  buildTeacherPanel,
} from './teacherIntelligence'

// ── Layer 7 — Parent Intelligence ────────────────────────────────────────────

export {
  buildParentInsight,
} from './parentIntelligence'

// ── Layer 8 — School Intelligence ────────────────────────────────────────────

export {
  buildSchoolIntelligence,
} from './schoolIntelligence'

// ── Layer 9 — AI Coordination ─────────────────────────────────────────────────

export {
  getContextForTutor,
  getContextForLessonPlan,
  getContextForAssessmentGenerator,
  getContextForCareerExplorer,
  getContextForHolidayPlanner,
} from './coordinator'

// ── Layer 10 — Continuous Learning ────────────────────────────────────────────

export {
  emitEvent,
  afterAssessment,
  afterCompassSession,
  afterFormativeSignal,
  afterParentObservation,
  afterRemedialPlanStarted,
  afterRemedialPlanCompleted,
  recordIntervention,
} from './continuousLearning'
