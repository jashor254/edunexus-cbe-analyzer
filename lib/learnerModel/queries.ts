// lib/learnerModel/queries.ts
// DB read/write for the Permanent Learner Memory.
// All writes go through upsert — the model is always current, never historical.
// Historical snapshots are in capability_history (separate table).

import { repos } from '@/lib/repositories'
import type {
  LearnerProfile, KnowledgeState, CapabilityDimensions,
  CareerSignals, EngagementPatterns, RiskFlag, RiskLevel,
  FormativeSignalSnapshot, LearningBehaviour,
  GrowthMilestone, RiskHistoryRecord, ParentObservation,
  PathwayReadiness, TermSnapshot,
} from './types'

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLearnerProfile(studentId: string): Promise<LearnerProfile | null> {
  return repos.learnerModel.getLearnerProfile(studentId)
}

export async function getOrCreateLearnerProfile(studentId: string): Promise<LearnerProfile> {
  return repos.learnerModel.getOrCreateLearnerProfile(studentId)
}

export async function getClassLearnerProfiles(classId: string): Promise<LearnerProfile[]> {
  return repos.learnerModel.getClassLearnerProfiles(classId)
}

export async function getAtRiskStudents(
  classId:  string,
  minRisk:  RiskLevel = 'watch',
): Promise<LearnerProfile[]> {
  const profiles = await getClassLearnerProfiles(classId)
  const order: Record<RiskLevel, number> = { normal: 0, watch: 1, at_risk: 2, critical: 3 }
  return profiles.filter(p => order[p.overall_risk_level] >= order[minRisk])
}

// ── Patch Helpers — each engine calls only what it changed ────────────────────

export async function patchKnowledgeState(
  studentId: string,
  patch:     Partial<KnowledgeState>,
): Promise<void> {
  return repos.learnerModel.patchKnowledgeState(studentId, patch)
}

export async function patchCapabilityDimensions(
  studentId:  string,
  dimensions: Partial<CapabilityDimensions>,
): Promise<void> {
  return repos.learnerModel.patchCapabilityDimensions(studentId, dimensions)
}

export async function patchCareerSignals(
  studentId: string,
  signals:   Partial<CareerSignals>,
): Promise<void> {
  return repos.learnerModel.patchCareerSignals(studentId, signals)
}

export async function patchEngagementPatterns(
  studentId: string,
  patterns:  Partial<EngagementPatterns>,
): Promise<void> {
  return repos.learnerModel.patchEngagementPatterns(studentId, patterns)
}

export async function patchLearningBehaviour(
  studentId: string,
  patch:     Partial<LearningBehaviour>,
): Promise<void> {
  return repos.learnerModel.patchLearningBehaviour(studentId, patch)
}

export async function patchPathwayReadiness(
  studentId: string,
  patch:     Partial<PathwayReadiness>,
): Promise<void> {
  return repos.learnerModel.patchPathwayReadiness(studentId, patch)
}

export async function addFormativeSignal(
  studentId: string,
  signal:    FormativeSignalSnapshot,
): Promise<void> {
  return repos.learnerModel.addFormativeSignal(studentId, signal)
}

export async function addParentObservation(
  studentId:   string,
  observation: ParentObservation,
): Promise<void> {
  return repos.learnerModel.addParentObservation(studentId, observation)
}

export async function addGrowthMilestone(
  studentId:  string,
  milestone:  GrowthMilestone,
): Promise<void> {
  return repos.learnerModel.addGrowthMilestone(studentId, milestone)
}

export async function updateRiskProfile(
  studentId:   string,
  flags:       RiskFlag[],
  riskLevel:   RiskLevel,
  riskHistory: RiskHistoryRecord[],
): Promise<void> {
  return repos.learnerModel.updateRiskProfile(studentId, flags, riskLevel, riskHistory)
}

export async function updateConfirmedGaps(
  studentId:      string,
  confirmedGaps:  string[],
  persistentGaps: string[],
): Promise<void> {
  return repos.learnerModel.updateConfirmedGaps(studentId, confirmedGaps, persistentGaps)
}

export async function markAssessmentDate(
  studentId:  string,
  assessedAt: string,
  term:       number,
  year:       number,
): Promise<void> {
  return repos.learnerModel.markAssessmentDate(studentId, assessedAt, term, year)
}

export async function snapshotTermEnd(
  studentId: string,
  term:      number,
  year:      number,
): Promise<void> {
  return repos.learnerModel.snapshotTermEnd(studentId, term, year)
}
