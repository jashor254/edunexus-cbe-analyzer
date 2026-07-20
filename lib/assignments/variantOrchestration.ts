// lib/assignments/variantOrchestration.ts
// Sprint 8 (Assessment Excellence) — the one place that resolves "given an
// assignment + a question, gather what generateAdaptiveVariants() needs and
// call it." Extracted from the single-question generate route so the new
// "Generate All" batch route (Review Dashboard) can reuse the exact same
// lookup + call, never a second copy of the class-enrollment/subject
// resolution logic. generateAdaptiveVariants() itself (the actual AI
// pipeline) is untouched — this module only orchestrates its inputs.

import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { generateAdaptiveVariants, type GenerationResult } from './variantGeneration'

export type AssignmentGenerationContext = {
  classId: string
  subject: string
  subStrandId: string | null
}

/** Resolves the class/subject/substrand a variant-generation call needs for this assignment. Throws if the assignment doesn't exist — callers already know it does (they resolved classId for auth before calling this). */
export async function loadAssignmentGenerationContext(assignmentId: string): Promise<AssignmentGenerationContext | null> {
  const db = createServiceClient()
  const { data } = await db.from('assignments').select('class_id, subject, substrand_id').eq('id', assignmentId).maybeSingle()
  if (!data) return null
  return { classId: data.class_id, subject: data.subject, subStrandId: data.substrand_id }
}

/**
 * Generates variants for one question of one assignment — identical
 * lookups and call the single-question route already performed, now
 * shared so the batch "Generate All" route doesn't reimplement them.
 * Caller must already have authorized the assignment's class.
 */
export async function generateVariantsForAssignmentQuestion(
  assignmentId: string,
  questionId: string,
  ctx: AssignmentGenerationContext
): Promise<GenerationResult> {
  const studentIds = await repos.learnerIntelligence.getClassEnrollment(ctx.classId)
  if (studentIds.length === 0) {
    return { created: [], failed: [{ tier: 'foundation', reason: 'Class has no enrolled students to ground generation in' }], tiersConsidered: [] }
  }

  const names = await repos.learnerIntelligence.getStudentNamesByIds(studentIds)
  const nameById = new Map(names.map(n => [n.id, n.name?.trim() || 'Student']))
  const learners = studentIds.map(sid => ({ learnerId: sid, learnerName: nameById.get(sid) ?? 'Student' }))

  return generateAdaptiveVariants({
    questionId,
    learners,
    subject: ctx.subject,
    subStrandId: ctx.subStrandId,
  })
}
