// lib/ai/educationalContext.ts
// Sprint 7A (ADR-0028 consolidation) — the canonical educational context
// contract for AI invocation. Introduces ZERO new reasoning: every field is
// read directly from `buildAdaptiveTask()` (lib/adaptiveLearning/recommend.ts,
// itself Evidence→Projection→Curriculum→Recommendation, already canonical).
// This module reshapes that already-computed output into a stable,
// AI-invocation-oriented shape — it does not recompute a learner's level,
// band, or curriculum node a second time, and it never will.
//
// Supersedes lib/ai/ragContext.ts (`buildStudentRAGContext`), which computed
// its own independent "learner summary for AI" from legacy assessment
// tables (`repos.teachers.findLegacyAssessmentsByStudent`), bypassing
// Evidence/Projection/Recommendation entirely — confirmed, by grep, to have
// zero callers anywhere in the repository despite its own header claiming
// it powers "Academic Clinic reports and Career matching." Named here, not
// deleted: same "leave the dormant thing alone, don't resurrect it, don't
// duplicate it a second time" discipline ADR-0027 already applied to
// `kicd_curriculum_lessons`.
//
// `precision` and `instructionalKnowledge` are reserved fields, always null
// today — ARDS (ADR-0023) and IKL (ADR-0027) are both design-only, unbuilt.
// They exist on this type now so a future caller's context shape doesn't
// change when those systems ship; they are never fabricated placeholders.

import { buildAdaptiveTask, type AdaptiveTask } from '@/lib/adaptiveLearning/recommend'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { CurriculumService } from '@/lib/curriculum/service'
import type { ConfidenceLevel } from '@/lib/learnerIntelligence/insight'

export type EducationalAIContext = {
  learnerId:    string
  subject:      string
  /** The one canonical instructional band (lib/adaptiveLearning/recommend.ts::classifyGroup) — never recomputed here. */
  band:         AdaptiveTask['groupType']
  /** 'subStrand' when Projection has real evidence for the assigned sub-strand; 'subject' as the honest fallback; null only when band is 'insufficient_data'. */
  academicGrain: AdaptiveTask['academicGrain']
  /** Real Strand/Sub-strand/Learning Outcome, or null — never a fabricated curriculum node. */
  curriculum:    AdaptiveTask['curriculum']
  /** States the curriculum-grounding gap explicitly when curriculum is null or incomplete — never silently absent. */
  curriculumNotice: AdaptiveTask['curriculumNotice']
  /** Plain-language statement of the learner's current standing — already-derived text, not raw evidence. */
  observation:  string
  /** The Recommendation layer's own suggested instructional action — context for, not a substitute for, the AI's own generation. */
  action:       string
  /** IDs of the confirmed Evidence rows backing this context — provenance only, never dereferenced by the AI itself. */
  supportingEvidenceIds: string[]
  confidence:   ConfidenceLevel
  /** Reserved for ARDS (ADR-0023). Always null until that system exists — never a fabricated precision claim. */
  precision:    null
  /** Reserved for IKL (ADR-0027). Always null until that system exists — never a fabricated pedagogy claim. */
  instructionalKnowledge: null
  resolvedAt:   string
}

/**
 * Pure — reshapes an already-computed AdaptiveTask into the canonical AI
 * context shape. No DB access, no recomputation. This is the one place a
 * future consumer's exact field mapping lives; everything upstream of this
 * function is unmodified canonical Recommendation/Projection/Curriculum code.
 */
export function deriveEducationalAIContext(task: AdaptiveTask): EducationalAIContext {
  return {
    learnerId:              task.learnerId,
    subject:                task.subject,
    band:                   task.groupType,
    academicGrain:          task.academicGrain,
    curriculum:             task.curriculum,
    curriculumNotice:       task.curriculumNotice,
    observation:            task.observation,
    action:                 task.action,
    supportingEvidenceIds:  task.evidence,
    confidence:             task.confidence,
    precision:              null,
    instructionalKnowledge: null,
    resolvedAt:             new Date().toISOString(),
  }
}

/**
 * The thin IO wrapper every future AI workflow should call instead of
 * independently fetching Projection/Curriculum itself. Composes exactly the
 * same functions holiday/planner.ts and differentiation.ts already call —
 * no new read path into Projection or Curriculum is introduced.
 */
export async function buildEducationalAIContext(params: {
  learnerId:   string
  learnerName: string
  subject:     string
  subStrandId?: string | null
}): Promise<EducationalAIContext> {
  const [projection, curriculum] = await Promise.all([
    recomputeLearnerProjection(params.learnerId),
    params.subStrandId ? CurriculumService.resolveSubstrandContext(params.subStrandId) : Promise.resolve(null),
  ])

  const task = buildAdaptiveTask(
    params.learnerId,
    params.learnerName,
    params.subject,
    projection,
    { curriculumContext: curriculum },
  )

  return deriveEducationalAIContext(task)
}
