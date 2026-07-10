// lib/adaptiveLearning/differentiation.ts
// Classroom Differentiation — Adaptive Learning v2 Architecture §3
// (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN).
//
// Generates a per-class differentiation set from the Recommendation Layer
// (lib/adaptiveLearning/recommend.ts, Projection-sourced — not
// lib/remedial/planner.ts, which reads legacy learner_profiles; see
// recommend.ts's own header for why that dependency was deliberately
// avoided). Persists as a draft; nothing reaches a learner until a
// teacher reviews, optionally adjusts, and approves it (§3, §9) — the
// same draft/approve interaction shape as the Holiday Publish Gate.

import { repos } from '@/lib/repositories'
import { recommendForClass, neutralGroupLabel, type ClassGroups } from './recommend'

export type DifferentiationInput = {
  classId:   string
  teacherId: string
  subject:   string
  term:      number
  year:      number
  /**
   * Teacher-assigned curriculum scope for this differentiation run (Topic
   * Picker, an assigned SOW substrand) — Curriculum Integrity mandate:
   * without this, generated tasks are honestly subject-level only, each
   * carrying an explicit `curriculumNotice` rather than an invented
   * Strand/Sub-Strand. Teacher Professional Autonomy: the teacher chooses
   * this, the system never guesses it.
   */
  subStrandId?: string | null
}

export type DifferentiationPlan = {
  id:           string | null
  classId:      string
  subject:      string
  term:         number
  year:         number
  groups:       ClassGroups
  isPublished:  boolean
  publishedAt:  string | null
}

/**
 * Generates (or regenerates) a class's differentiation set and persists it
 * as a draft. Regenerating always resets to draft — matches
 * upsertHolidayPlan's rule that re-saving replaces previously approved
 * content.
 */
export async function generateClassDifferentiation(input: DifferentiationInput): Promise<DifferentiationPlan> {
  const studentIds = await repos.learnerIntelligence.getClassEnrollment(input.classId)
  if (studentIds.length === 0) {
    throw new Error(`No students enrolled in class ${input.classId}`)
  }

  const names = await repos.learnerIntelligence.getStudentNamesByIds(studentIds)
  const nameById = new Map(names.map(n => [n.id, n.name?.trim() || 'Student']))

  const learners = studentIds.map(id => ({ learnerId: id, learnerName: nameById.get(id) ?? 'Student' }))
  const groups = await recommendForClass(learners, input.subject, { subStrandId: input.subStrandId })

  const id = await repos.learnerIntelligence.upsertClassDifferentiationPlan({
    class_id:   input.classId,
    teacher_id: input.teacherId,
    subject:    input.subject,
    term:       input.term,
    year:       input.year,
    plan_data:  groups,
  })

  return {
    id, classId: input.classId, subject: input.subject, term: input.term, year: input.year,
    groups, isPublished: false, publishedAt: null,
  }
}

/** Reads back the persisted draft/approved plan without recomputing — used by the teacher review screen. */
export async function getClassDifferentiation(params: {
  classId: string; subject: string; term: number; year: number
}): Promise<DifferentiationPlan | null> {
  const row = await repos.learnerIntelligence.getClassDifferentiationPlan({
    class_id: params.classId, subject: params.subject, term: params.term, year: params.year,
  })
  if (!row) return null

  return {
    id: row.id, classId: params.classId, subject: params.subject, term: params.term, year: params.year,
    groups: row.plan_data as ClassGroups, isPublished: row.is_published, publishedAt: row.published_at,
  }
}

/**
 * Teacher approval — Review → Adjust → Approve (§3). `adjustedGroups`, when
 * provided, is what gets persisted — an adjusted plan is never silently
 * reverted to the AI's original proposal. Returns 0 if the plan doesn't
 * belong to this teacher (ownership enforced in the repository layer).
 */
export async function approveClassDifferentiation(params: {
  classId:   string
  teacherId: string
  subject:   string
  term:      number
  year:      number
  adjustedGroups?: ClassGroups
}): Promise<number> {
  return repos.learnerIntelligence.publishClassDifferentiationPlan({
    class_id:   params.classId,
    teacher_id: params.teacherId,
    subject:    params.subject,
    term:       params.term,
    year:       params.year,
    plan_data:  params.adjustedGroups,
  })
}

/**
 * Neutral, class-facing rendering of an approved plan — the labels a
 * printed page or shared view may show a learner. Internal group taxonomy
 * names (`critical_gap` etc.) never appear here (§3's explicit rule).
 */
export function renderNeutralGroups(groups: ClassGroups): Array<{ label: string; taskCount: number }> {
  return (Object.keys(groups) as Array<keyof ClassGroups>)
    .filter(g => groups[g].length > 0)
    .map(g => ({ label: neutralGroupLabel(g), taskCount: groups[g].length }))
}
