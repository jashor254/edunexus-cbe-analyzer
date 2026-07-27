// lib/learnerBlueprint/actionPlan/candidateGeneration.ts
//
// The smallest safe candidate-generation seam (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md §7 Phase 1 /
// "Candidate generation"). Reads canonical Projection
// (`recomputeLearnerProjection`) and reuses the one shared adaptive
// classifier (`buildAdaptiveTask`/`classifyGroup`,
// lib/adaptiveLearning/recommend.ts) that Remedial Planner and Holiday
// Planner already both call — this module does not reimplement
// classification, invent a new score, or duplicate either planner's
// logic. It produces exactly one candidate for one explicitly-named
// subject per call — no automatic loop over every subject, no automatic
// creation of multiple conflicting actions, no cross-feature dedup (that
// remains explicitly deferred, per the audit's §7 Phase 5).
//
// A candidate returned here is NOT yet persisted — the caller (a teacher,
// via a future route, or a test harness in this phase) reviews it and
// then calls `proposeBlueprintAction` with `proposalSource: 'system'` to
// actually save it. This module never writes to blueprint_action_items,
// never writes evidence, and never auto-approves anything.

import { resolveLegacyStudentId } from '@/lib/core/identity'
import { getLearner } from '@/lib/core/learners'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { buildAdaptiveTask, neutralGroupLabel } from '@/lib/adaptiveLearning/recommend'
import type { BlueprintActionPriority, BlueprintActionEvidenceBasis } from './types'

export const DETERMINISTIC_CANDIDATE_GENERATOR_ID = 'deterministic-adaptive-v1'

export type ActionCandidate = {
  context: 'current_term'
  proposalSource: 'system'
  sourceGenerator: string
  title: string
  rationale: string
  intendedOutcome: string
  teacherAction: string
  successIndicator: string
  targetCapability: string | null
  evidenceBasis: BlueprintActionEvidenceBasis
  priority: BlueprintActionPriority
}

const PRIORITY_BY_GROUP: Record<string, BlueprintActionPriority> = {
  critical_gap: 'high',
  prerequisite_gap: 'medium',
  concept_confusion: 'medium',
  on_track: 'low',
}

/**
 * Generates one candidate action for a learner in one subject, or `null`
 * when there isn't enough evidence to responsibly propose anything (no
 * legacy identity bridge yet, or Projection itself reports
 * 'insufficient_data') — never fabricates a candidate from nothing.
 */
export async function generateActionCandidate(
  coreLearnerId: string,
  schoolId: string,
  subject: string
): Promise<ActionCandidate | null> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (!legacyStudentId) return null // No evidence bridge yet — nothing to generate from.

  const [learner, projection] = await Promise.all([
    getLearner(coreLearnerId, schoolId),
    recomputeLearnerProjection(legacyStudentId),
  ])
  const learnerName = [learner.first_name, learner.middle_name, learner.last_name].filter(Boolean).join(' ')

  const task = buildAdaptiveTask(legacyStudentId, learnerName, subject, projection)
  if (task.groupType === 'insufficient_data') return null // Never fabricate a candidate from no evidence.

  const academic = projection.academic

  return {
    context: 'current_term',
    proposalSource: 'system',
    sourceGenerator: DETERMINISTIC_CANDIDATE_GENERATOR_ID,
    title: `${subject}: ${neutralGroupLabel(task.groupType)}`,
    rationale: task.observation,
    intendedOutcome: `Move ${learnerName} toward the next CBC level in ${subject}.`,
    teacherAction: task.action,
    successIndicator: `${learnerName}'s next confirmed ${subject} evidence shows improvement from the current level.`,
    targetCapability: task.curriculum ? `${task.curriculum.strandTitle} — ${task.curriculum.subStrandTitle}` : subject,
    evidenceBasis: {
      projectorType: 'academic',
      supportingEvidenceIds: task.evidence,
      confidence: academic?.confidence ?? null,
      lastComputed: academic?.lastComputed ?? null,
      projectionVersion: academic?.projectionVersion ?? null,
    },
    priority: PRIORITY_BY_GROUP[task.groupType] ?? 'medium',
  }
}
