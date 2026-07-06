// lib/eir/index.ts
// Education Intelligence Research — Public API
//
// Import from here. Never import directly from individual EIR modules.
//
// EIR is the scientific layer above EILS.  It studies educational interactions,
// discovers patterns, validates hypotheses, and feeds evidence back to improve
// every decision EILS produces.

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  // Shared
  EvidenceStrength,
  ResearchStatus,
  ResearchPillar,
  // Pillar 1
  MisconceptionType,
  CorrectionEffectiveness,
  EIRMisconception,
  MisconceptionPattern,
  MisconceptionLibrary,
  // Pillar 2
  TrajectoryClass,
  EIRLearningTrajectory,
  TrajectoryModel,
  // Pillar 3
  EIRInterventionType,
  EIRInterventionRecord,
  InterventionEffectivenessReport,
  InterventionTypeStats,
  // Pillar 4
  ExplanationStyle,
  EngagementPattern,
  ChallengeResponse,
  FeedbackResponse,
  EIRPersonalizationModel,
  // Pillar 5
  EIRCareerDevelopmentSnapshot,
  CareerDevelopmentModel,
  // Pillar 6
  KGDiscoveryType,
  EIRKGDiscovery,
  // Pillar 7
  EIRRiskType,
  EIRRiskPrediction,
  RiskPredictionResult,
  // Pillar 8
  EducationalTheory,
  EIRRecommendationOutcome,
  AlternativeAction,
  ExplainedRecommendation,
  // Pillar 9
  ValidationSignal,
  ValidationSummary,
  // Pillar 10
  EIRHypothesis,
  EIRFinding,
  KnowledgeBaseReport,
  // Engine
  EIRResearchCycle,
} from './types'

// ── Pillar 1 — Misconception Discovery ───────────────────────────────────────

export {
  discoverMisconceptions,
  markMisconceptionResolved,
  buildMisconceptionLibrary,
} from './misconceptions'

// ── Pillar 2 — Learning Trajectories ─────────────────────────────────────────

export {
  computeTrajectoryModel,
  getTrajectoryModel,
  recordBreakthrough,
  recordRecoveryAfterIntervention,
} from './trajectories'

// ── Pillar 3 — Intervention Effectiveness ────────────────────────────────────

export {
  recordInterventionOutcome,
  bestInterventionForLearner,
  buildInterventionEffectivenessReport,
} from './interventionEffectiveness'

// ── Pillar 4 — Personalization Models ────────────────────────────────────────

export {
  buildPersonalizationModel,
  getPersonalizationModel,
  getPersonalizationContext,
} from './personalization'

// ── Pillar 5 — Career Development ────────────────────────────────────────────

export {
  takeCareerSnapshot,
  buildCareerDevelopmentModel,
} from './careerDevelopment'

// ── Pillar 6 — Knowledge Graph Evolution ─────────────────────────────────────

export {
  discoverKGImprovements,
  validateKGDiscovery,
  getOpenKGDiscoveries,
  markKGDiscoveryApplied,
} from './kgEvolution'

// ── Pillar 7 — Early Risk Detection ──────────────────────────────────────────

export {
  predictRisks,
  evaluatePastPredictions,
  getRiskPredictions,
} from './riskDetection'

// ── Pillar 8 — Educational Explainability ────────────────────────────────────

export {
  explainRecommendation,
  getExplanation,
  recordFeedback,
} from './explainability'

// ── Pillar 9 — Continuous Validation ─────────────────────────────────────────

export {
  markRecommendationAccepted,
  markRecommendationDismissed,
  recordRecommendationOutcome,
  buildValidationSummary,
  expireStalePendingOutcomes,
  getPendingOutcomes,
} from './validation'

// ── Pillar 10 — Educational Knowledge Base ────────────────────────────────────

export {
  proposeHypothesis,
  startTestingHypothesis,
  addEvidenceToHypothesis,
  validateHypothesis,
  rejectHypothesis,
  publishFinding,
  getFindings,
  buildKnowledgeBaseReport,
  autoProposeHypothesis,
} from './knowledgeBase'

// ── Research Engine ───────────────────────────────────────────────────────────

export {
  runLearnerResearchCycle,
  runPlatformResearchCycle,
  afterInterventionResolved,
  afterRecommendationCreated,
  scheduleOutcomeMeasurement,
} from './engine'
